// Disposable fixture server: environment loading disabled, no live DB/provider.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('../server/node_modules/dotenv').config = () => ({});
process.env.JWT_SECRET = 'isolated-assistant-fixture';
const express = require('../server/node_modules/express');
const User = require('../server/src/models/User');
const { generateToken } = require('../server/src/config/jwt');
async function main() {
    const adminId = await User.create({name:'QA Administrator',email:'admin@example.invalid',password:'QaPass123',role:'admin'});
    const tenantId = await User.create({name:'QA Tenant',email:'tenant@example.invalid',password:'QaPass123',role:'tenant'});
    const Stall = require('../server/src/models/Stall');
    await Stall.create({stall_number:'A-101',location:'Dela Costa Market',monthly_rent:5000,status:'available'});
    const token = generateToken(adminId,'admin');
    const tenantToken = generateToken(tenantId,'tenant');
    const app = express();app.use(express.json());app.use('/api/v1',require('../server/src/routes'));
    app.use(express.static(path.join(__dirname,'../webapp/dist')));
    app.use((req,res)=>res.sendFile(path.join(__dirname,'../webapp/dist/index.html')));
    const server = app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function ask(message,bearer=token){const r=await fetch(base+'/api/v1/assistant',{method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify({message})});return {status:r.status,body:await r.json()};}
    assert.equal((await ask('available stalls',null)).status,401);
    assert.equal((await ask('')).status,400);
    assert.equal((await ask('a'.repeat(501))).status,400);
    assert.equal((await ask({bad:true})).status,400);
    assert.match((await ask('available stalls')).body.data.reply,/A-101/);
    assert.match((await ask('due dates',tenantToken)).body.data.reply,/no lease linked/i);
    assert.equal((await ask('what is the weather')).body.data.topic,'outside');
    fs.writeFileSync(path.join(__dirname,'browser-fixture.json'),JSON.stringify({base,token,user:{id:adminId,name:'QA Administrator',email:'admin@example.invalid',role:'admin'}}));
    console.log('7 assistant HTTP checks passed; fixture ready at '+base);
}
main().catch(e=>{console.error(e);process.exit(1);});
