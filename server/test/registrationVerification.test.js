const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRegistrationService, profile } = require('../src/services/registrationVerification');
test('contact validation rejects missing name and malformed Philippine numbers', () => {
    assert.throws(()=>profile({name:'',phone:'+639123456789'}));
    assert.throws(()=>profile({name:'Tenant',phone:'123'}));
    assert.deepEqual(profile({name:' Tenant ',phone:'+639123456789'}),{name:'Tenant',phone:'+639123456789'});
});
test('verification uses transactional storage, expires, limits guesses and cannot be replayed', {skip:process.env.RUN_DB_AUTH_TESTS!=='1'}, async () => {
    require('dotenv').config({quiet:true});
    const {Client}=require('pg');
    const db=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false,connectionTimeoutMillis:10000});
    await db.connect();
    try {
        await db.query('BEGIN');
        await db.query('DROP TABLE IF EXISTS pg_temp.registration_verifications, pg_temp.users');
        // Session-local tables shadow application tables. No real accounts are changed.
        await db.query(`CREATE TEMP TABLE users(id UUID DEFAULT gen_random_uuid(),name TEXT,email TEXT UNIQUE,phone TEXT UNIQUE,password TEXT,role TEXT,supabase_user_id UUID)`);
        const migration=fs.readFileSync(path.join(__dirname,'../migrations/20261015_registration_verification.sql'),'utf8');
        await db.query(migration.slice(migration.indexOf('CREATE TABLE'),migration.indexOf('ALTER TABLE')).replace('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE'));
        assert.match((await db.query("SELECT 'users'::regclass::oid::regclass::text AS name, relpersistence FROM pg_class WHERE oid='users'::regclass")).rows[0].relpersistence,/t/);
        let queue=Promise.resolve();
        const pool={withTransaction: fn=>{const job=queue.then(async()=>{await db.query('SAVEPOINT verification_case');try{const value=await fn(db);await db.query('RELEASE SAVEPOINT verification_case');return value;}catch(e){await db.query('ROLLBACK TO SAVEPOINT verification_case');throw e;}});queue=job.catch(()=>{});return job;}};
        const sent=[];
        const codes=new Map();
        const service=createRegistrationService({pool,sendCode:async(email)=>{const code=String(123450+sent.length);codes.set(email,code);sent.push({email,code});},verifyCode:async(email,code)=>{
            if(codes.get(email)!==code)return null; codes.delete(email); return {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
        }});
        const input={name:'Test Tenant',email:'TENANT@example.com',phone:'+639123456789',password:'secret123',confirmPassword:'secret123',role:'admin'};
        await assert.rejects(service.start({...input,confirmPassword:'different'}),/match/);
        const first=await service.start(input);
        assert.equal(first.email,'tenant@example.com');
        assert.match(sent[0].code,/^\d{6}$/);
        assert.equal((await db.query('SELECT * FROM users')).rowCount,0);
        const stored=(await db.query('SELECT * FROM registration_verifications')).rows[0];
        assert.notEqual(stored.password_hash,input.password);
        const ttl=new Date(first.expiresAt)-new Date(first.serverNow);
        assert.ok(ttl>59000 && ttl<=60000);
        await assert.rejects(service.resend(first.challengeId),e=>e.status===429);
        await assert.rejects(service.start(input),e=>e.status===429);
        const wrong=sent[0].code==='000000'?'000001':'000000';
        for(let i=0;i<5;i++) await assert.rejects(service.verify(first.challengeId,wrong),/Incorrect/);
        await assert.rejects(service.verify(first.challengeId,sent[0].code),/Too many/);
        await db.query("UPDATE registration_verifications SET resend_at=NOW()-INTERVAL '1 second', expires_at=NOW()-INTERVAL '1 second'");
        await assert.rejects(service.verify(first.challengeId,sent[0].code),/expired/);
        const second=await service.resend(first.challengeId);
        assert.notEqual(sent[0].code,sent[1].code);
        await assert.rejects(service.verify(first.challengeId,sent[0].code),/Incorrect/);
        const results=await Promise.allSettled([service.verify(second.challengeId,sent[1].code),service.verify(second.challengeId,sent[1].code)]);
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
        assert.equal((await db.query('SELECT * FROM users')).rowCount,1);
        assert.equal((await db.query('SELECT role FROM users')).rows[0].role,'tenant');
        assert.equal((await db.query('SELECT * FROM registration_verifications')).rowCount,0);
        await assert.rejects(service.start(input),e=>e.status===409);
        const failure=createRegistrationService({pool,sendCode:async()=>{throw new Error('Mail failed');}});
        await assert.rejects(failure.start({...input,email:'other@example.com',phone:'+639123456780'}),/Mail failed/);
        assert.equal((await db.query('SELECT * FROM registration_verifications')).rowCount,0);
    } finally { await db.query('ROLLBACK'); await db.query('DROP TABLE IF EXISTS pg_temp.registration_verifications, pg_temp.users'); await db.end(); }
});
