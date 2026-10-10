const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {nextDue,initialDue,todayManila}=require('../src/services/billingCalendar');
const {validSignature,confirmedPayment}=require('../src/services/paymentSettlement');
const provider=require('../src/services/paymongoService');
test('production sandbox is explicit and rejects live keys in test mode', () => {
 const original={key:provider.secretKey,env:process.env.NODE_ENV,mode:process.env.PAYMENT_MODE};
 try {
  process.env.NODE_ENV='production';delete process.env.PAYMENT_MODE;provider.secretKey='sk_test_fixture';
  assert.equal(provider.modeAllowed(),false);
  process.env.PAYMENT_MODE='test';assert.equal(provider.modeAllowed(),true);
  provider.secretKey='sk_live_fixture';assert.equal(provider.modeAllowed(),false);
  process.env.PAYMENT_MODE='live';assert.equal(provider.modeAllowed(),true);
  provider.secretKey='sk_test_fixture';assert.equal(provider.modeAllowed(),false);
 } finally {
  provider.secretKey=original.key;
  if(original.env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original.env;
  if(original.mode===undefined)delete process.env.PAYMENT_MODE;else process.env.PAYMENT_MODE=original.mode;
 }
});
test('daily and monthly first bills are after the lease start',()=>{
 assert.equal(nextDue('2026-06-01','monthly','2026-06-01'),'2026-07-01');
 assert.equal(nextDue('2026-06-01','daily','2026-06-01'),'2026-06-02');
 assert.equal(nextDue('2026-06-01','daily','2026-06-02'),'2026-06-03');
});
test('monthly anniversaries recover after short months and leap years',()=>{
 assert.equal(nextDue('2026-01-31','monthly','2026-01-31'),'2026-02-28');
 assert.equal(nextDue('2026-01-31','monthly','2026-02-28'),'2026-03-31');
 assert.equal(nextDue('2028-01-31','monthly','2028-01-31'),'2028-02-29');
 assert.equal(nextDue('2026-12-31','monthly','2026-12-31'),'2027-01-31');
});
test('existing leases activate without historical backfill and use Manila date',()=>{
 assert.equal(initialDue('2025-06-01','monthly','2026-10-02'),'2026-11-01');
 assert.equal(initialDue('2025-06-01','daily','2026-10-02'),'2026-10-02');
 assert.equal(todayManila(new Date('2026-06-01T16:01:00Z')),'2026-06-02');
 assert.throws(()=>nextDue('2026-02-30','monthly','2026-03-01'));
});
test('webhook signature rejects altered bytes, old timestamps and wrong modes',()=>{
 const raw=Buffer.from('{"data":{"id":"evt_test"}}'),t=1800000000,secret='fixture';
 const digest=crypto.createHmac('sha256',secret).update(`${t}.`).update(raw).digest('hex');
 const header=`t=${t},te=${digest},li=`;
 assert.equal(validSignature(raw,header,secret,false,t*1000),true);
 assert.equal(validSignature(raw,header,secret,true,t*1000),false);
 assert.equal(validSignature(raw,header,secret,false,(t+301)*1000),false);
 assert.equal(validSignature(Buffer.from('{}'),header,secret,false,t*1000),false);
 assert.equal(validSignature(raw,`t=${t},te=invalid`,secret,false,t*1000),false);
});
test('settlement requires the correct invoice, mode, currency and full balance',()=>{
 const oldKey=provider.secretKey;provider.secretKey='sk_test_fixture';
 try {
  const invoice={id:'bill',amount:100,late_fee:5,paymongo_checkout_id:'cs_owned'};
  const session={id:'cs_owned',attributes:{livemode:false,metadata:{invoice_id:'bill'},payments:[{id:'pay_owned',attributes:{status:'paid',amount:10500,currency:'PHP'}}]}};
  assert.equal(confirmedPayment(invoice,session).id,'pay_owned');
  for(const mutate of [s=>s.id='cs_other',s=>s.attributes.metadata.invoice_id='foreign',s=>s.attributes.livemode=true,s=>s.attributes.payments[0].attributes.currency='USD',s=>s.attributes.payments[0].attributes.amount=10000,s=>s.attributes.payments[0].attributes.status='pending']) {
   const wrong=structuredClone(session);mutate(wrong);assert.equal(confirmedPayment(invoice,wrong),null);
  }
 } finally {provider.secretKey=oldKey;}
});
test('online checkout stays unavailable until HTTPS and webhook are configured',()=>{
 const original={key:provider.secretKey,success:provider.successUrl,cancel:provider.cancelUrl,secret:process.env.PAYMONGO_WEBHOOK_SECRET};
 try {
  provider.secretKey='sk_test_fixture';provider.successUrl='http://localhost:5173/payments';
  assert.throws(()=>provider.assertReady(),/HTTPS/);
  provider.successUrl=provider.cancelUrl='https://hoa.example/payments';delete process.env.PAYMONGO_WEBHOOK_SECRET;
  assert.throws(()=>provider.assertReady(),/confirmation/);
  process.env.PAYMONGO_WEBHOOK_SECRET='fixture';assert.doesNotThrow(()=>provider.assertReady());
  assert.equal(new URL(provider.returnUrl(provider.successUrl,'invoice')).searchParams.get('payment_id'),'invoice');
 } finally {provider.secretKey=original.key;provider.successUrl=original.success;provider.cancelUrl=original.cancel;if(original.secret===undefined)delete process.env.PAYMONGO_WEBHOOK_SECRET;else process.env.PAYMONGO_WEBHOOK_SECRET=original.secret;}
});
