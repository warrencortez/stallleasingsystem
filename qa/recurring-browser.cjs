// Read-only checks against the running local admin UI; never submits a payment.
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {testConnection}=require('../server/src/config/database');assert.equal(await testConnection(),true);
 const admin=(await require('../server/src/models/User').getAll({role:'admin'})).find(x=>x.role==='admin'&&x.is_active);
 const token=require('../server/src/config/jwt').generateToken(admin.id,'admin');
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir=D:/stall-leasing-dev/recurring-browser-profile','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let stderr='',socket;chrome.stderr.on('data',b=>stderr+=b);
 const checks=[],errors=[];
 try {
  for(let i=0;i<100&&!stderr.includes('DevTools listening on');i++)await delay(100);
  const port=stderr.match(/DevTools listening on ws:\/\/127.0.0.1:(\d+)/)?.[1];assert.ok(port);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
  function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('token',${JSON.stringify(token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify({id:admin.id,name:'QA inspection',role:'admin'}))});`});
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  for(const width of [1440,375]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await cdp('Page.navigate',{url:'http://localhost:5173/payments'});await delay(2200);
   assert.equal(await evaluate('location.pathname'),'/payments');
   assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Run Due Billing')&&(b.click(),true))`),true);
   await delay(300);const text=await evaluate('document.body.innerText');
   assert.match(text,/Automatic Lease Billing/);assert.match(text,/same day next month/);
   assert.doesNotMatch(text,/Waiting for the billing worker|Scheduled billing failed|UI Component Diagnostic Alert/);
   assert.equal(await evaluate("!!document.querySelector('#billing-day,#billing-frequency')"),false);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   checks.push(`Billing schedule modal and healthy worker status at ${width}px`);
  }
  await cdp('Page.navigate',{url:'http://localhost:5173/stalls/new'});await delay(1500);
  assert.match(await evaluate('document.body.innerText'),/Vacant stalls are not billed/);checks.push('Stall form explains lease-based automatic billing');
  assert.deepEqual(errors,[]);checks.push('No uncaught browser exceptions');
  fs.writeFileSync(path.join(__dirname,'recurring-browser-results.json'),JSON.stringify({checks,errors},null,2));
  for(const check of checks)console.log('PASS '+check);
 } finally {socket?.close();chrome.kill();}
})().then(()=>process.exit()).catch(e=>{console.error(e.message);process.exit(1)});
