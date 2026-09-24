// Isolated QA: no .env, no database connection, no payment-provider requests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dep = name => require(path.join(root, 'server/node_modules', name));
dep('dotenv').config = () => ({});
process.env.JWT_SECRET = 'isolated-qa-only-secret';
const express = dep('express');
const models = name => require(path.join(root, 'server/src/models', name));
const User = models('User');
const Tenant = models('Tenant');
const Payment = models('Payment');
const Stall = models('Stall');
const Application = models('Application');
const results = [];
function check(name, passed, actual, mode = 'isolated HTTP with repository fallback store') {
  results.push({ name, passed, actual, mode });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(actual)}`);
}
async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', require('../server/src/routes'));
  app.use(express.static(path.join(root, 'webapp/dist')));
  app.use((req, res) => res.sendFile(path.join(root, 'webapp/dist/index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, token, body, method = body ? 'POST' : 'GET') {
    const res = await fetch(base + '/api/v1' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) });
    return {status:res.status, body:await res.json()};
  }
  check('Unauthenticated users blocked', (await request('/payments')).status === 401, 'GET /payments');
  const reg = await request('/auth/register', null, {name:'QA admin',email:'qa-admin@example.invalid',password:'QaPass123',role:'admin'});
  check('Public registration cannot grant admin', reg.body.data?.user?.role !== 'admin', {status:reg.status,role:reg.body.data?.user?.role});
  const adminToken = reg.body.data.token;
  const tenantReg = await request('/auth/register', null, {name:'QA tenant',email:'qa-tenant@example.invalid',password:'QaPass123'});
  const tenantToken = tenantReg.body.data.token;
  const tenantUserId = tenantReg.body.data.user.id;
  check('Registration does not expose password hashes', !tenantReg.body.data.user.password, {passwordFieldPresent:!!tenantReg.body.data.user.password});
  const firstLogin = await request('/auth/login',null,{email:'qa-tenant@example.invalid',password:'QaPass123'});
  const secondLogin = await request('/auth/login',null,{email:'qa-tenant@example.invalid',password:'QaPass123'});
  check('Repeated valid login succeeds in fallback',firstLogin.status===200 && secondLogin.status===200,{first:firstLogin.status,second:secondLogin.status});
  const hash = await dep('bcryptjs').hash('DifferentPassword987',10);
  const acceptsDemo = await User.comparePassword('tenant123', '$2a$'+hash.slice(4));
  check('Wrong demo password rejected for bcrypt 2a hashes',!acceptsDemo,{accepted:acceptsDemo},'isolated model test');
  const stallId = await Stall.create({stall_number:'QA-01',location:'QA',size:10,monthly_rent:1000,status:'available'});
  const ownerId = await Tenant.create({user_id:'other-user',stall_id:stallId,name:'Other tenant',email:'other@example.invalid',status:'active'});
  const paymentId = await Payment.create({tenant_id:ownerId,stall_id:stallId,amount:1000,due_date:'2026-10-01',description:'QA rent'});
  const tenants = await request('/tenants',tenantToken);
  check('Tenant cannot list other tenants private records',!tenants.body.data?.some(x=>x.id===ownerId),{status:tenants.status,count:tenants.body.data?.length});
  const list = await request('/payments',tenantToken);
  check('Unlinked tenant cannot list another tenant invoices',!list.body.data?.some(x=>x.id===paymentId),{status:list.status,count:list.body.data?.length});
  const bill = await request('/payments/'+paymentId,tenantToken);
  check('Tenant cannot read another tenant invoice by ID',bill.status===403||bill.status===404,{status:bill.status});
  // Observe the real route/controller decision; replace only persistence to avoid
  // fallback SQL emulator masking the status the controller writes.
  const originalRecord = Payment.recordPayment;
  let recorded;
  Payment.recordPayment = async (id,data) => (recorded={id,...data});
  const manual = await request('/payments/'+paymentId+'/record',tenantToken,{is_manual_verify:true,payment_method:'cash'},'PATCH');
  check('Unlinked tenant cannot self-approve another invoice',manual.status===403,{status:manual.status,writtenStatus:recorded?.status},'HTTP; payment write captured');
  const service = require('../server/src/services/paymongoService');
  service.retrieveCheckoutSession = async () => null;
  recorded = null;
  const verify = await request('/payments/'+paymentId+'/verify-paymongo',tenantToken,{checkout_id:'qa-invalid'});
  check('Failed provider verification cannot mark invoice paid',recorded?.status!=='paid',{status:verify.status,writtenStatus:recorded?.status},'HTTP; provider returns null; payment write captured');
  Payment.recordPayment = originalRecord;
  // Verify Express 5 request-query mutation independently of fallback filtering.
  const originalFindTenant = Tenant.findByUserId;
  const originalFindPayments = Payment.findAll;
  Tenant.findByUserId = async () => ({id:'qa-owned-tenant',user_id:tenantUserId});
  let filters;
  Payment.findAll = async f => (filters=f, []);
  await request('/payments',tenantToken);
  check('Express 5 tenant filter reaches payment model',filters?.tenant_id==='qa-owned-tenant',{tenant_id:filters?.tenant_id??null},'HTTP; model filter captured');
  Tenant.findByUserId = originalFindTenant;
  Payment.findAll = originalFindPayments;
  const oldFind = User.findById;
  User.findById = async id => {const u=await oldFind(id);if(!u)return u;const copy={...u};delete copy.password;return copy;};
  const change = await request('/auth/change-password',adminToken,{currentPassword:'QaPass123',newPassword:'NewPass123'},'PUT');
  check('Change-password works with live SQL user projection',change.status===200,{status:change.status,message:change.body.message},'HTTP; exact live SELECT projection simulated');
  User.findById = oldFind;
  const neg = await request('/payments',adminToken,{tenant_id:ownerId,amount:-100,due_date:'2026-10-01'});
  check('Negative invoice rejected',neg.status===400||neg.status===422,{status:neg.status,amount:neg.body.data?.amount});
  const appCreate = await request('/applications',tenantToken,{full_name:'QA applicant',business_name:'QA shop',stall_id:stallId});
  check('Fallback application creation works',appCreate.status===201,{status:appCreate.status});
  // Real controller with isolated models, reproducing occupied-stall ordering.
  const originals = [Application.findById,Application.updateStatus,Stall.findById];
  let appStatus='pending';
  Application.findById=async()=>({id:'qa-app',status:appStatus,stall_id:'occupied-stall'});
  Application.updateStatus=async(id,status)=>(appStatus=status,true);
  Stall.findById=async()=>({id:'occupied-stall',status:'occupied'});
  const approval = await request('/applications/qa-app/review',adminToken,{status:'approved'},'PATCH');
  check('Rejected approval leaves application pending',appStatus==='pending',{httpStatus:approval.status,storedStatus:appStatus},'HTTP; isolated application/stall models');
  [Application.findById,Application.updateStatus,Stall.findById]=originals;
  const timings=[];
  for(let i=0;i<30;i++){const t=performance.now();await request('/payments',adminToken);timings.push(performance.now()-t);}
  timings.sort((a,b)=>a-b);
  const performanceResult={scope:'30 sequential requests, local fallback, two invoices; not production load',p50ms:timings[15],p95ms:timings[28]};
  fs.writeFileSync(path.join(__dirname,'api-results.json'),JSON.stringify({results,performance:performanceResult},null,2));
  fs.writeFileSync(path.join(__dirname,'browser-fixture.json'),JSON.stringify({base,token:adminToken,user:reg.body.data.user}));
  console.log('QA_FIXTURE_READY '+base);
  if(!process.argv.includes('--serve')) server.close(()=>process.exit(0));
}
main().catch(e=>{console.error(e);process.exit(1);});
