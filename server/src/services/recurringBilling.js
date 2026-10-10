const { pool } = require('../config/database');
const Notification = require('../models/Notification');
const {dateOnly,todayManila,nextDue,initialDue,validDate}=require('./billingCalendar');
const status={running:false,lastRun:null,lastSuccess:null,lastError:null,lastCount:0};
async function runDueBilling(today=todayManila()) {
 if(!validDate(today))throw new Error('Invalid billing run date.');
 return pool.withTransaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(739105)');
  const leases=(await client.query(`SELECT t.*,s.rent_type,s.daily_rent,s.monthly_rent,s.stall_number FROM tenants t JOIN stalls s ON s.id=t.stall_id WHERE t.status='active' FOR UPDATE OF t,s`)).rows;
  let count=0;const skipped=[];
  for(const lease of leases){
   const anchor=dateOnly(lease.contract_start),end=lease.contract_end?dateOnly(lease.contract_end):null;
   if(!validDate(anchor)){skipped.push({tenant_id:lease.id,reason:'Missing or invalid lease start date'});continue;}
   let schedule=(await client.query('SELECT * FROM lease_billing_schedules WHERE tenant_id=$1',[lease.id])).rows[0];
   if(!schedule){
    const frequency=lease.rent_type==='daily'?'daily':'monthly',amount=Number(frequency==='daily'?lease.daily_rent:lease.monthly_rent);
    if(!validDate(anchor)||!Number.isFinite(amount)||amount<=0){skipped.push({tenant_id:lease.id,reason:'Invalid lease date or rate'});continue;}
    const due=initialDue(anchor,frequency,today);
    schedule=(await client.query(`INSERT INTO lease_billing_schedules(tenant_id,stall_id,frequency,amount,anchor_date,next_billing_date,activated_on) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[lease.id,lease.stall_id,frequency,amount,anchor,due,today])).rows[0];
   }
   if(schedule.stall_id!==lease.stall_id||dateOnly(schedule.anchor_date)!==anchor){skipped.push({tenant_id:lease.id,reason:'Lease changed; billing schedule requires review'});continue;}
   let due=dateOnly(schedule.next_billing_date),limit=0;
   while(due<=today&&(!end||due<=end)&&limit++<366){
    // Respect older invoices already issued for the same billing period.
    const duplicate=(await client.query(`SELECT id FROM payments WHERE tenant_id=$1 AND stall_id=$2 AND ((billing_type=$3 AND billing_period=$4) OR ($3='monthly' AND description LIKE 'Monthly Lease Rent for %' AND date_trunc('month',due_date)=date_trunc('month',$4::date))) LIMIT 1`,[lease.id,lease.stall_id,schedule.frequency,due])).rows[0];
    if(!duplicate){
     const bill=(await client.query(`INSERT INTO payments(tenant_id,stall_id,amount,due_date,status,description,billing_type,billing_period) VALUES($1,$2,$3,$4,'unpaid',$5,$6,$4) ON CONFLICT DO NOTHING RETURNING id`,[lease.id,lease.stall_id,schedule.amount,due,`${schedule.frequency==='daily'?'Daily':'Monthly'} lease rent for ${lease.stall_number} due ${due}`,schedule.frequency])).rows[0];
     if(bill){if(lease.user_id)await Notification.create({user_id:lease.user_id,title:'Rent bill issued',message:`Your ${schedule.frequency} rent for stall ${lease.stall_number} is PHP ${Number(schedule.amount).toFixed(2)}, due ${due}.`,type:'rent_due',link:'/payments'});count++;}
    }
    due=nextDue(anchor,schedule.frequency,due);
   }
   await client.query('UPDATE lease_billing_schedules SET next_billing_date=$1 WHERE tenant_id=$2',[due,lease.id]);
  }
  return {count,skipped};
 });
}
async function tick(){
 if(status.running)return;status.running=true;status.lastRun=new Date().toISOString();
 try{const result=await runDueBilling();status.lastSuccess=new Date().toISOString();status.lastCount=result.count;status.lastError=result.skipped.length?`${result.skipped.length} lease schedules require review`:null;if(result.count)console.log(`[Billing] Issued ${result.count} scheduled invoices.`);}
 catch(error){status.lastError=error.message;console.error('[Billing] Scheduled billing failed:',error.message);}
 finally{status.running=false;}
}
function start(){void tick();const timer=setInterval(tick,60000);timer.unref();return ()=>clearInterval(timer);}
module.exports={runDueBilling,start,status};
