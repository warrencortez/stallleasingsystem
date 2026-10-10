// Isolated PostgreSQL fixtures, no real provider calls, always roll back.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pool,testConnection}=require('../server/src/config/database');
const {runDueBilling}=require('../server/src/services/recurringBilling');
const {dateOnly}=require('../server/src/services/billingCalendar');
const provider=require('../server/src/services/paymongoService');
const {settleInvoice}=require('../server/src/services/paymentSettlement');
const results=[];
function pass(name){results.push({name,passed:true});console.log('PASS '+name);}
(async()=>{
 if(!await testConnection())throw Error('Database unavailable');
 const rollback=Error('QA_ROLLBACK');
 try {await pool.withTransaction(async client=>{
  await client.query('CREATE SCHEMA qa_recurring_integration');
  await client.query('SET LOCAL search_path TO qa_recurring_integration, public');
  for(const table of ['users','stalls','tenants','payments','notifications'])await client.query(`CREATE TABLE qa_recurring_integration.${table} (LIKE public.${table} INCLUDING ALL)`);
  const User=require('../server/src/models/User'),Stall=require('../server/src/models/Stall'),Tenant=require('../server/src/models/Tenant');
  const owner=await User.create({name:'QA',email:'recurring@example.invalid',password:'QATest123',role:'tenant'});
  const monthly=await Stall.create({stall_number:'QA-M',location:'QA',monthly_rent:1000,rent_type:'monthly'});
  const daily=await Stall.create({stall_number:'QA-D',location:'QA',monthly_rent:100,daily_rent:100,rent_type:'daily'});
  const old=await Tenant.create({user_id:owner,stall_id:monthly,status:'active',name:'Existing',contract_start:'2025-01-01'});
  const migration=fs.readFileSync(path.join(__dirname,'../server/migrations/20261002_recurring_billing.sql'),'utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,'');
  // Explicitly create the schedule table here: IF NOT EXISTS must not resolve the public table.
  await client.query(`CREATE TABLE lease_billing_schedules (tenant_id UUID PRIMARY KEY,stall_id UUID NOT NULL,frequency VARCHAR(10) NOT NULL,amount NUMERIC(12,2) NOT NULL,anchor_date DATE NOT NULL,next_billing_date DATE NOT NULL,activated_on DATE NOT NULL,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(migration);
  await runDueBilling('2026-06-02');
  assert.equal((await client.query('SELECT * FROM payments')).rows.length,0);
  assert.equal(dateOnly((await client.query('SELECT next_billing_date FROM lease_billing_schedules WHERE tenant_id=$1',[old])).rows[0].next_billing_date),'2026-07-01');
  await client.query("UPDATE tenants SET status='inactive' WHERE id=$1",[old]);
  pass('Existing leases are activated without historical bills');
  const m=await Tenant.create({user_id:owner,stall_id:monthly,status:'active',name:'Monthly',contract_start:'2026-06-01',contract_end:'2026-08-01'});
  const d=await Tenant.create({user_id:owner,stall_id:daily,status:'active',name:'Daily',contract_start:'2026-06-01',contract_end:'2026-06-04'});
  assert.equal((await runDueBilling('2026-06-01')).count,0);
  assert.equal((await runDueBilling('2026-06-02')).count,1);
  assert.equal((await runDueBilling('2026-06-02')).count,0);
  assert.equal((await runDueBilling('2026-06-04')).count,2);
  assert.equal((await runDueBilling('2026-06-05')).count,0);
  assert.equal((await runDueBilling('2026-07-01')).count,1);
  assert.equal((await runDueBilling('2026-07-01')).count,0);
  assert.equal((await client.query("SELECT * FROM payments WHERE tenant_id=$1",[d])).rows.length,3);
  pass('First bill next day/month, missed days caught up, duplicates and end dates enforced');
  await client.query('UPDATE stalls SET monthly_rent=2000 WHERE id=$1',[monthly]);
  await runDueBilling('2026-08-01');
  assert.ok((await client.query('SELECT amount FROM payments WHERE tenant_id=$1',[m])).rows.every(p=>Number(p.amount)===1000));
  await client.query("UPDATE tenants SET status='inactive' WHERE id=$1",[m]);
  assert.equal((await runDueBilling('2026-09-01')).count,0);
  pass('Lease rates are preserved; inactive leases are not billed');
  const invoice=(await client.query('SELECT * FROM payments WHERE tenant_id=$1 LIMIT 1',[d])).rows[0];
  await client.query("UPDATE payments SET paymongo_checkout_id='cs_qa' WHERE id=$1",[invoice.id]);
  const original=provider.retrieveCheckoutSession,originalKey=provider.secretKey;
  provider.secretKey='sk_test_fixture';
  provider.retrieveCheckoutSession=async()=>({id:'cs_qa',attributes:{metadata:{invoice_id:invoice.id},livemode:false,payments:[{id:'pay_qa',attributes:{status:'paid',amount:10000,currency:'PHP'}}]}});
  try {
   assert.equal((await settleInvoice(invoice.id,'cs_qa')).status,'paid');
   assert.equal((await settleInvoice(invoice.id,'cs_qa')).status,'paid');
   assert.equal((await client.query("SELECT * FROM notifications WHERE type='payment_success'")).rows.length,1);
   assert.equal((await client.query('SELECT paymongo_payment_id FROM payments WHERE id=$1',[invoice.id])).rows[0].paymongo_payment_id,'pay_qa');
  } finally {provider.secretKey=originalKey;provider.retrieveCheckoutSession=original;}
  pass('Verified payment records provider ID and duplicate delivery sends one confirmation');
  const otherInvoice=(await client.query("SELECT * FROM payments WHERE status='unpaid' LIMIT 1")).rows[0];
  const originalReady=provider.assertReady,originalCreate=provider.createCheckoutSession;
  let created=0;
  provider.assertReady=()=>{};
  provider.createCheckoutSession=async()=>{created++;return {checkoutId:'cs_reuse',checkoutUrl:'https://checkout.example.invalid/reuse',referenceNumber:'fixture'};};
  provider.retrieveCheckoutSession=async()=>({id:'cs_reuse',attributes:{status:'active',checkout_url:'https://checkout.example.invalid/reuse',payments:[]}});
  const controller=require('../server/src/controllers/paymentController');
  const response=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
  try {
   for(let i=0;i<2;i++) {const res=response();await controller.createPaymongoCheckout({params:{id:otherInvoice.id}},res);assert.equal(res.code,200);assert.equal(res.body.data.checkoutId,'cs_reuse');}
   assert.equal(created,1);
   const Payment=require('../server/src/models/Payment');
   assert.equal(await Payment.update(otherInvoice.id,{amount:1}),undefined);
   assert.equal(await Payment.delete(otherInvoice.id),false);
   provider.retrieveCheckoutSession=async()=>({id:'cs_reuse',attributes:{status:'expired',payments:[],payment_intent:{attributes:{status:'processing'}}}});
   const retry=response();await controller.createPaymongoCheckout({params:{id:otherInvoice.id}},retry);assert.equal(retry.code,409);assert.equal(created,1);
   const edited=response();await controller.updatePayment({params:{id:otherInvoice.id},body:{amount:1}},edited);assert.equal(edited.code,409);
  } finally {provider.assertReady=originalReady;provider.createCheckoutSession=originalCreate;provider.retrieveCheckoutSession=original;}
  pass('Repeated checkout reuses one provider session and invoice amount cannot change afterward');
  throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 assert.equal((await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name='qa_recurring_integration'")).rows.length,0);
 pass('QA schema and fixtures rolled back');
 fs.writeFileSync(path.join(__dirname,'recurring-postgres-results.json'),JSON.stringify(results,null,2));
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
