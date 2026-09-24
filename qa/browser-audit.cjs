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
 const chrome=spawn(edge?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(__dirname,prefix+'chrome-profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
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
  let seq=0;const pending=new Map();const errors=[];const requests=[];
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
  const pages=[];
  async function inspect(route,width,label){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   const before=errors.length;
   await cdp('Page.navigate',{url:fixture.base+route});await delay(1300);
   const dom=await evaluate(`({title:document.title,path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,text:document.body.innerText.slice(0,1600),inputs:[...document.querySelectorAll('input,select,textarea')].map(e=>({type:e.type,name:e.name,labels:e.labels?.length||0,aria:e.getAttribute('aria-label'),placeholder:e.placeholder})),emptyButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&!e.innerText.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')).length,navTiming:performance.getEntriesByType('navigation').map(n=>({domContentLoadedMs:n.domContentLoadedEventEnd,loadMs:n.loadEventEnd}))})`);
   pages.push({label,...dom,errors:errors.slice(before)});
   const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,prefix+label+'.png'),Buffer.from(shot.data,'base64'));
  }
  await inspect('/login',1440,'login-desktop');
  await inspect('/login',375,'login-mobile');
  await evaluate(`localStorage.setItem('token',${JSON.stringify(fixture.token)});localStorage.setItem('user',${JSON.stringify(JSON.stringify(fixture.user))})`);
  if(support){
   const assert=require('node:assert/strict');
   const clickText=async(selector,text)=>evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);
   const input=async(selector,value)=>evaluate(`Object.getOwnPropertyDescriptor(${selector.includes('textarea')?'HTMLTextAreaElement':'HTMLInputElement'}.prototype,'value').set.call(document.querySelector(${JSON.stringify(selector)}),${JSON.stringify(value)});document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('input',{bubbles:true}))`);
   const tenantCall=async(route,token=fixture.tenantToken,body)=>{const r=await fetch(fixture.base+'/api/v1'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});return (await r.json()).data;};
   const capture=async name=>{const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'support-'+name+'.png'),Buffer.from(shot.data,'base64'));};
   await inspect('/conversations',1440,'inbox');
   assert.match(await evaluate('document.body.innerText'),/Ana Santos/);assert.match(await evaluate('document.body.innerText'),/Ben Cruz/);
   assert.match(await evaluate('document.body.innerText'),/requested a live agent/);
   await clickText('.support-contact','Ana Santos');await delay(700);
   assert.match(await evaluate(`document.querySelector('.support-messages').innerText`),/A-101/);
   await clickText('.support-actions button','Accept request');await delay(600);
   assert.equal((await tenantCall('/support/thread')).status,'live');
   await tenantCall('/support/messages',fixture.tenantToken,{message:'Is someone there?',client_id:'browser-live-001'});await delay(3300);
   assert.match(await evaluate(`document.querySelector('.support-messages').innerText`),/Is someone there/);
   await input('.support-compose textarea','Hello Ana, I can help with your application.');await evaluate(`document.querySelector('.support-compose').requestSubmit()`);await delay(600);
   let thread=await tenantCall('/support/thread');assert.equal(thread.messages.at(-1).sender_role,'admin');assert.match(thread.messages.at(-1).text,/Hello Ana/);
   assert.equal(thread.messages.filter(m=>m.sender_role==='assistant').length,1);
   await capture('live-desktop');
   await clickText('.support-actions button','Return to assistant');await delay(500);
   thread=await tenantCall('/support/messages',fixture.tenantToken,{message:'available stalls',client_id:'browser-bot-002'});assert.equal(thread.messages.at(-1).sender_role,'assistant');
   await evaluate(`document.querySelector('[aria-label="Open stall leasing assistant"]').click()`);await clickText('.hoa-chat-tabs button','Tenant inbox');await delay(200);
   await clickText('.hoa-chat .support-contact','Ben Cruz');await delay(500);await clickText('.hoa-chat .support-actions button','Take over chat');await delay(400);
   await input('.hoa-chat .support-compose textarea','Hello Ben, this message is just for you.');await evaluate(`document.querySelector('.hoa-chat .support-compose').requestSubmit()`);await delay(500);
   const ben=await tenantCall('/support/thread',fixture.otherToken);assert.match(ben.messages.at(-1).text,/Hello Ben/);
   assert.ok(!(await tenantCall('/support/thread')).messages.some(m=>m.text.includes('Hello Ben')));
   await capture('compact-inbox');
   await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});await delay(200);
   assert.ok(await evaluate(`document.querySelector('.hoa-chat').getBoundingClientRect().right<=innerWidth`));await capture('compact-mobile');
   await evaluate(`document.querySelector('[aria-label="Close assistant"]').click()`);
   await clickText('.support-thread-header button','');await delay(200);
   assert.ok(await evaluate(`document.querySelector('.support-contacts').getBoundingClientRect().width>0`));
   fs.writeFileSync(path.join(__dirname,'support-browser-results.json'),JSON.stringify({passed:true,checks:['all tenant accounts listed','live-agent alert','bot history visible','admin accepts request','live tenant message arrives','admin reply received by tenant','bot paused during live chat','return to assistant','compact inbox proactive message','no cross-tenant delivery','375px layout and back navigation'],errors},null,2));
   console.log('Support browser handoff and messaging checks passed');return;
  }
  if(assistant){
   const assert=require('node:assert/strict');
   await inspect('/dashboard',1440,'dashboard');
   assert.equal(await evaluate(`document.body.innerText.includes('Register Tenant')`),false);
   await inspect('/tenants',1440,'tenants');
   assert.equal(await evaluate(`document.body.innerText.includes('Add New Tenant')`),false);
   await cdp('Page.navigate',{url:fixture.base+'/tenants/new'});await delay(1000);
   assert.equal(await evaluate('location.pathname'),'/tenants');
   await evaluate(`document.querySelector('[aria-label="Open stall leasing assistant"]').click()`);await delay(200);
   for(const text of ['Which stalls are available?','Check rent due dates','Show maintenance reports']){
    await evaluate(`[...document.querySelectorAll('.hoa-chat-suggestions button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`);await delay(800);
   }
   assert.match(await evaluate(`document.querySelector('.hoa-chat-messages').innerText`),/A-101/);
   await evaluate(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(document.querySelector('#hoa-chat-question'),'What is the weather?');document.querySelector('#hoa-chat-question').dispatchEvent(new Event('input',{bubbles:true}))`);
   await evaluate(`document.querySelector('.hoa-chat-compose').requestSubmit()`);await delay(800);
   assert.match(await evaluate(`document.querySelector('.hoa-chat-messages').innerText`),/I don't know/);
   const desktop=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'assistant-chat-desktop.png'),Buffer.from(desktop.data,'base64'));
   await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});await delay(200);
   assert.ok(await evaluate(`document.querySelector('.hoa-chat').getBoundingClientRect().left>=0 && document.querySelector('.hoa-chat').getBoundingClientRect().right<=innerWidth`));
   const mobile=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'assistant-chat-mobile.png'),Buffer.from(mobile.data,'base64'));
   await evaluate(`document.querySelector('[aria-label="Close assistant"]').click()`);
   assert.equal(await evaluate(`!!document.querySelector('.hoa-chat')`),false);
   const narrow=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'assistant-header-mobile.png'),Buffer.from(narrow.data,'base64'));
   await evaluate(`localStorage.clear()`);await cdp('Page.navigate',{url:fixture.base+'/login'});await delay(500);
   assert.equal(await evaluate(`!!document.querySelector('.hoa-chat-head')`),false);
   assert.equal(await evaluate('document.title'),'Dela Costa HOA Stall Leasing');
   fs.writeFileSync(path.join(__dirname,'assistant-browser-results.json'),JSON.stringify({passed:true,checks:['dashboard shortcut removed','directory shortcut removed','new-tenant route redirected','available stalls response','due date question','maintenance question','off-topic refusal','375px chat fits viewport','close chat','logged-out chat hidden','document title'],pages,errors},null,2));
   console.log('Assistant browser interaction checks passed');return;
  }
  for(const route of ['/dashboard','/stalls','/tenants','/applications','/payments','/maintenance','/announcements','/reports','/users','/stalls/new','/tenants/new'])await inspect(route,1440,route.slice(1).replaceAll('/','-'));
  await inspect('/dashboard',375,'dashboard-mobile');
  await inspect('/payments',375,'payments-mobile');
  await inspect('/stalls/qa-missing-route',1440,'qr-route');
  await inspect('/payments',375,'payments-idle');
  const start=requests.length;await delay(10500);const idleRequests=requests.slice(start);
  await evaluate(`localStorage.setItem('user','{broken')`);
  await inspect('/dashboard',1440,'corrupt-session');
  fs.writeFileSync(path.join(__dirname,prefix+'browser-results.json'),JSON.stringify({browser:edge?'local headless Edge':'local headless Chrome',fixture:'production web build; API intercepted to isolated fallback server',pages,idleRequestsOver10_5Seconds:idleRequests},null,2));
  console.log(JSON.stringify({pages:pages.map(p=>({label:p.label,path:p.path,overflow:p.scrollWidth>p.width,emptyButtons:p.emptyButtons,errors:p.errors})),idleRequests:idleRequests.length},null,2));
 }finally{socket?.close();chrome.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
