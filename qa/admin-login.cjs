// Verify actual database login using credentials supplied only through the process environment.
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const email=process.env.QA_ADMIN_EMAIL,password=process.env.QA_ADMIN_PASSWORD;
 assert.ok(email && password,'Supply QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD');
 const login=async supplied=>fetch('http://localhost:5000/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:supplied})});
 assert.equal((await login('admin123')).status,401,'Old default password must not work');
 const signed=await login(password);assert.equal(signed.status,200);const session=(await signed.json()).data;
 assert.equal(session.user.role,'admin');assert.equal(session.user.email,email);assert.equal(session.user.password,undefined);
 const profile=await fetch('http://localhost:5000/api/v1/auth/me',{headers:{Authorization:'Bearer '+session.token}});assert.equal(profile.status,200);
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir=D:/stall-leasing-dev/admin-login-browser-profile','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
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
  const evaluate=async expression=>(await cdp('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  await cdp('Page.navigate',{url:'http://localhost:5173/login'});await delay(3000);
  if(!await evaluate("!!document.querySelector('#admin-email')")) console.log(await evaluate('({path:location.pathname,text:document.body.innerText.slice(0,1500)})'));
  assert.equal(await evaluate("document.querySelector('#admin-email').value"),'');
  assert.equal(await evaluate("document.querySelector('#admin-password').value"),'');
  checks.push('Login fields are empty; no embedded administrator credentials');
  const input=async(id,value)=>{await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
  await input('admin-email',email);await input('admin-password',password);
  await evaluate("document.querySelector('form').requestSubmit()");await delay(2200);
  assert.equal(await evaluate('location.pathname'),'/dashboard');checks.push('Database administrator signs in through the actual website form');
  await evaluate("localStorage.setItem('user',JSON.stringify({id:'forged',name:'Forged user',role:'tenant'}))");
  await cdp('Page.reload');await delay(1800);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('user')).id"),session.user.id);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('user')).role"),'admin');
  checks.push('Reload restores real database identity rather than forged cached profile');
  checks.push('Old default password rejected; authenticated profile succeeds; password hash never returned');
  assert.deepEqual(errors,[]);checks.push('No uncaught browser exceptions');
  fs.writeFileSync(path.join(__dirname,'admin-login-results.json'),JSON.stringify({checks,errors},null,2));
  for(const check of checks)console.log('PASS '+check);
 } finally {socket?.close();chrome.kill();}
})().then(()=>process.exit()).catch(e=>{console.error(e.message);process.exit(1)});
