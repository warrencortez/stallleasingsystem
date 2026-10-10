const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'browser-fixture.json')));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const edge=process.argv.includes('--edge');
const assistant=process.argv.includes('--assistant');
const support=process.argv.includes('--support');
const prefix=support?'support-':assistant?'assistant-':edge?'edge-':'';
async function main(){
 const chrome=spawn(edge?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+'D:/stall-leasing-qa-20261002/current-chrome-profile','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let stderr='';
 chrome.stderr.on('data',d=>stderr+=d);
 let socket;
 try{
  for(let i=0;i<100&&!stderr.includes('DevTools listening on');i++)await delay(100);
  const match=stderr.match(/DevTools listening on ws:\/\/127.0.0.1:(\d+)/);
  if(!match)throw Error('Chrome did not expose debugging endpoint: '+stderr);
  const targets=await(await fetch(`http://127.0.0.1:${match[1]}/json/list`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let seq=0;const pending=new Map();const errors=[];const requests=[];const apiErrors=[];
  function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
  socket.addEventListener('message',async event=>{
   const m=JSON.parse(event.data);
   if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
   if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
   if(m.method==='Fetch.requestPaused'){
    const {requestId,request}=m.params;
    try{
     requests.push(request.url);
     if(request.method==='OPTIONS'){await cdp('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE,OPTIONS'}]});return;}
     const res=await fetch(request.url.replace('http://localhost:5000',fixture.base),{method:request.method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+fixture.token},...(request.postData?{body:request.postData}:{})});
     if(res.status>=400)apiErrors.push({url:request.url,status:res.status});
     await cdp('Fetch.fulfillRequest',{requestId,responseCode:res.status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(await res.text()).toString('base64')});
    }catch(e){
     // Navigation can cancel an intercepted request before its response arrives.
     if(!String(e).includes('Invalid InterceptionId'))errors.push(String(e));
     await cdp('Fetch.failRequest',{requestId,errorReason:'Failed'}).catch(()=>{});
    }
   }
  });
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'http://localhost:5000/*'}]});
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const pages=[]; const assert=require('node:assert/strict'); const checks=[];
  async function inspect(route,width,label){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   const before=errors.length;
   await cdp('Page.navigate',{url:fixture.base+route});await delay(1300);
   const dom=await evaluate(`({buttons:[...document.querySelectorAll('button,a')].filter(e=>e.getBoundingClientRect().width).map(e=>({text:e.innerText.trim(),label:e.getAttribute('aria-label')||e.title,href:e.getAttribute('href')})),title:document.title,path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,text:document.body.innerText.slice(0,1600),inputs:[...document.querySelectorAll('input,select,textarea')].map(e=>({type:e.type,name:e.name,labels:e.labels?.length||0,aria:e.getAttribute('aria-label'),placeholder:e.placeholder})),emptyButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&!e.innerText.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')).length,navTiming:performance.getEntriesByType('navigation').map(n=>({domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd}))})`);
   assert.ok(!/UI Component Diagnostic Alert|An unhandled UI exception/.test(dom.text),'Page error boundary: '+route);
   pages.push({label,...dom,errors:errors.slice(before)});
   const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join('D:/stall-leasing-qa-20261002',label+'.png'),Buffer.from(shot.data,'base64'));
  }

  const click=async text=>{assert.equal(await evaluate(`[...document.querySelectorAll('button,a')].filter(e=>e.getBoundingClientRect().width).some(e=>e.textContent.trim().includes(${JSON.stringify(text)}) && (e.click(),true))`),true,'Missing button '+text);await delay(500);};
  const input=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(100);};
  const check=(label)=>{checks.push(label);console.log('PASS '+label)};
  await inspect('/login',1440,'current-login');
  await input('input[type=email]','admin@example.invalid');await input('input[type=password]','QaPass123');await evaluate(`document.querySelector('form').requestSubmit()`);await delay(1000);
  assert.equal(await evaluate('location.pathname'),'/dashboard');check('Real admin login and dashboard redirect');
  for(const route of ['/dashboard','/stalls','/tenants','/applications','/payments','/payments/stats','/maintenance','/announcements','/reports','/users','/stalls/new','/tenants/new','/conversations', '/stalls/edit/'+fixture.stall,'/tenants/'+fixture.tenant,'/tenants/edit/'+fixture.tenant]) await inspect(route,1440,'current-'+route.slice(1).replaceAll('/','-'));
  check('16 admin routes rendered');
  await inspect('/users',1440,'current-users');
  assert.equal(await evaluate(`[...document.querySelectorAll('option')].some(e=>e.value==='staff')`),false);check('Staff role absent from user filter');
  await evaluate(`document.querySelector('[aria-label="Open tenant messages"]').click()`);await delay(500);
  assert.equal(await evaluate(`!!document.querySelector('.hoa-chat-tabs')`),false);
  assert.match(await evaluate(`document.querySelector('.hoa-chat').innerText`),/Tenant messages/);check('Admin floating chat contains tenant inbox only');
  await evaluate(`[...document.querySelectorAll('.hoa-chat .support-contact')].find(e=>e.textContent.includes('QA Tenant')).click()`);await delay(600);await click('Take over chat');
  await input('.hoa-chat textarea','Your office payment can be recorded by the administrator.');await evaluate(`document.querySelector('.hoa-chat .support-compose').requestSubmit()`);await delay(500);
  assert.match(await evaluate(`document.querySelector('.hoa-chat .support-messages').innerText`),/Your office payment/);check('Admin tenant inbox takeover and message submission still work');
  await inspect('/stalls/new',1440,'current-stall-create');await input('[name=stall_number]','QA-BROWSER');await input('[name=location]','QA Office');
  await evaluate(`document.querySelector('input[value=daily]').click()`);await delay(100);await input('[name=daily_rent]','155');await evaluate(`document.querySelector('form').requestSubmit()`);await delay(800);assert.equal(await evaluate('location.pathname'),'/stalls');
  const stallResponse=await fetch(fixture.base+'/api/v1/stalls',{headers:{Authorization:'Bearer '+fixture.token}});const createdStall=(await stallResponse.json()).data.find(s=>s.stall_number==='QA-BROWSER');assert.ok(createdStall);assert.equal(createdStall.rent_type,'daily');assert.equal(Number(createdStall.daily_rent),155);
  await inspect('/stalls/edit/'+createdStall.id,1440,'current-stall-edit');assert.equal(await evaluate(`document.querySelector('[name=daily_rent]').value`),'155');await input('[name=daily_rent]','160');await evaluate(`document.querySelector('form').requestSubmit()`);await delay(600);assert.equal(await evaluate('location.pathname'),'/stalls');check('Create and edit daily stall through real forms');
  await inspect('/maintenance',1440,'current-maintenance-dialog');await click('Report New Stall Issue');assert.match(await evaluate('document.body.innerText'),/Submit Report/);await click('Cancel');check('Admin maintenance report dialog opens and cancels');
  await inspect('/payments',1440,'current-payments');
  await click('Record Walk-in Payment');await input('#office-invoice',fixture.invoice);await input('#office-amount','130');await input('#office-receipt','OR-BROWSER-001');
  await evaluate(`document.querySelector('#office-invoice').closest('form').requestSubmit()`);await delay(800);
  let body=await evaluate('document.body.innerText');assert.match(body,/VERIFIED & SETTLED/);assert.match(body,/OR-BROWSER-001/);assert.match(body,/Total Paid Amount:\s*\u20b1130/);check('Walk-in payment with late fee produces settled receipt and correct total');
  await click('Close Receipt');await click('Generate Rent Bills');await input('#billing-frequency','daily');await input('#billing-day','2026-10-02');await click('Generate Invoices');await delay(600);
  const res=await fetch(fixture.base+'/api/v1/payments',{headers:{Authorization:'Bearer '+fixture.token}});const payments=(await res.json()).data;assert.ok(payments.some(p=>p.billing_type==='daily'&&Number(p.amount)===120));check('Daily generation modal creates a daily lease invoice');
  for(const route of ['/dashboard','/payments','/maintenance','/users','/conversations','/stalls'])await inspect(route,375,'current-mobile-'+route.slice(1));
  assert.equal(apiErrors.length,0,JSON.stringify(apiErrors));
  assert.equal(errors.length,0,errors.join('\n'));check('No uncaught browser exceptions');
  await evaluate(`localStorage.setItem('user','{broken')`);await inspect('/dashboard',1440,'current-corrupt-session');assert.equal(await evaluate('location.pathname'),'/dashboard');assert.equal(await evaluate("JSON.parse(localStorage.getItem('user')).role"),'admin');check('Corrupt cached profile recovers from authenticated database profile');
  fs.writeFileSync(path.join(__dirname,'current-browser-results.json'),JSON.stringify({checks,pages,errors,apiErrors,requests},null,2));
  console.log(JSON.stringify(pages.map(p=>({path:p.path,width:p.width,overflow:p.scrollWidth>p.width,errors:p.errors})),null,2));
 }finally{socket?.close();chrome.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
