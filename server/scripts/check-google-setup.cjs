// Read-only configuration check. Never print API keys, database credentials or user records.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
async function main() {
    const url = new URL(process.env.SUPABASE_URL);
    const ref = url.hostname.split('.')[0];
    const matches = (process.env.DB_HOST || '').includes(ref) || (process.env.DB_USER || '').endsWith(`.${ref}`);
    console.log('Database credentials point to the configured Supabase project:', matches);
    if (!matches) throw new Error('Database project mismatch; no migration should be applied.');
    const response = await fetch(`${url.origin}/auth/v1/settings`, {
        headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Supabase Auth settings returned HTTP ${response.status}.`);
    const settings = await response.json();
    console.log('Google provider enabled:', settings.external?.google === true);
    for (const table of ['users', 'tenants', 'payments', 'support_conversation_store']) {
        const check = await fetch(`${url.origin}/rest/v1/${table}?select=*&limit=0`, {
            method: 'HEAD', headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000)
        });
        console.log(`Public API access to ${table}: HTTP ${check.status}`);
        if (check.ok) throw new Error(`Public API access to ${table} must be restricted before sharing the app.`);
        if (![401,403].includes(check.status)) throw new Error(`Unable to verify public API protection for ${table}.`);
    }
    const { createClient } = require('@supabase/supabase-js');
    const authClient = createClient(url.origin, process.env.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' }
    });
    const oauth = await authClient.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: 'http://localhost:5173/auth/callback', skipBrowserRedirect: true
    } });
    if (oauth.error) throw new Error('Could not create the Google authorization request.');
    const authorize = await fetch(oauth.data.url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const destination = authorize.headers.get('location');
    const googleRedirect = destination && new URL(destination).hostname === 'accounts.google.com';
    console.log('Supabase starts Google authorization:', !!googleRedirect);
    if (!googleRedirect) throw new Error(`Google authorization returned an unexpected HTTP ${authorize.status} response.`);
    const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, connectionTimeoutMillis: 15000 });
    try {
        await client.connect();
        const schema = await client.query(`SELECT
            EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='supabase_user_id') AS google_identity,
            to_regclass('public.support_conversation_store') IS NOT NULL AS support_storage,
            to_regclass('public.auth_rate_limits') IS NOT NULL AS rate_limits,
            to_regclass('public.scheduled_job_runs') IS NOT NULL AS job_status,
            to_regclass('public.lease_billing_schedules') IS NOT NULL AS recurring_billing`);
        console.log('Database connected. Schema:', JSON.stringify(schema.rows[0]));
        const tables = await client.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
            AND tablename IN ('users','payments','tenants','support_conversation_store') ORDER BY tablename`);
        console.log('Application table row security:', JSON.stringify(tables.rows));
    } finally { await client.end(); }
}
main().catch(error => { console.error('Setup check failed:', error.code || error.name, error.message); process.exitCode = 1; });
