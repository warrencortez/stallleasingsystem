const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture({sendError=null,verifyError=null,email='tenant@example.com',confirmed=true}={}) {
    const calls=[],clients=[];
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/services/verificationEmail.js'),'utf8'),{
        module,exports:module.exports,process:{env:{SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key'}},
        AbortSignal,fetch:()=>{throw new Error('No real network calls allowed');},
        require:name=>{assert.equal(name,'@supabase/supabase-js');return {createClient:(url,key,options)=>{
            clients.push(options);
            return {auth:{signInWithOtp:async args=>{calls.push(args);return {error:sendError};},verifyOtp:async args=>{calls.push(args);return {error:verifyError,data:{user:{id:'verified-id',email,email_confirmed_at:confirmed?'2026-10-15':null},session:{access_token:'must-not-return'}}};}}};
        }}}});
    return {...module.exports,calls,clients};
}
test('Supabase sends OTP with isolated non-persistent clients',async()=>{
    const app=fixture();await app.sendCode('tenant@example.com');await app.sendCode('other@example.com');
    assert.equal(app.calls[0].email,'tenant@example.com');
    assert.equal(app.calls[0].options.shouldCreateUser,true);
    assert.equal(app.clients.length,2);
    assert.equal(app.clients[0].auth.persistSession,false);
    assert.equal(app.clients[0].auth.autoRefreshToken,false);
});
test('email delivery failures and provider limits never report success',async()=>{
    await assert.rejects(fixture({sendError:{status:429}}).sendCode('tenant@example.com'),e=>e.status===429);
    await assert.rejects(fixture({sendError:{status:400}}).sendCode('tenant@example.com'),e=>e.status===503);
});
test('OTP verification returns only the matching verified identity, never its session',async()=>{
    const app=fixture();const verified=await app.verifyCode('tenant@example.com','123456');
    assert.equal(verified.id,'verified-id');assert.equal(verified.session,undefined);
    assert.equal(app.calls[0].type,'email');assert.equal(app.calls[0].token,'123456');
    assert.equal(await fixture({email:'attacker@example.com'}).verifyCode('tenant@example.com','123456'),null);
    assert.equal(await fixture({confirmed:false}).verifyCode('tenant@example.com','123456'),null);
    assert.equal(await fixture({verifyError:{code:'otp_expired'}}).verifyCode('tenant@example.com','123456'),null);
    await assert.rejects(fixture({verifyError:{status:500}}).verifyCode('tenant@example.com','123456'),e=>e.status===503);
});
