const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {testConnection}=require('../server/src/config/database');
(async()=>{assert.equal(await testConnection(),true);
 const User=require('../server/src/models/User');const admin=(await User.getAll({role:'admin'})).find(u=>u.role==='admin'&&u.is_active);assert.ok(admin);
 const token=require('../server/src/config/jwt').generateToken(admin.id,'admin');const app=require('../server/node_modules/express')();app.use('/api/v1',require('../server/src/routes'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const results=[];for(const route of ['/payments/billing-status','/payments/online-status','/payments/stalls-overview','/payments/stats','/payments/analytics?timeframe=monthly','/payments/analytics?timeframe=daily','/payments/analytics?timeframe=weekly','/payments/analytics?timeframe=yearly','/payments/report?month=10&year=2026','/stalls/stats','/tenants/stats','/applications/stats','/maintenance/stats','/maintenance','/announcements']){const res=await fetch((process.env.QA_HTTP_BASE || 'http://127.0.0.1:'+server.address().port)+'/api/v1'+route,{headers:{Authorization:'Bearer '+token}});const body=await res.json();results.push({route,status:res.status,success:body.success});assert.equal(res.status,200,route);assert.equal(body.success,true,route);console.log('PASS '+route);}
 fs.writeFileSync(path.join(__dirname,'current-live-http-results.json'),JSON.stringify(results,null,2));}finally{server.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
