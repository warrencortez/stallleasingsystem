const { createClient } = require('@supabase/supabase-js');

function auth() {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = process.env;
    if (!url?.startsWith('https://') || !key) throw new Error('Recovery email configuration unavailable');
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(4000) }) }
    }).auth;
}

async function sendRecoveryCode(email) {
    const { error } = await auth().resetPasswordForEmail(email);
    return !error;
}

async function verifyRecoveryCode(email, token) {
    const { data, error } = await auth().verifyOtp({ email, token, type: 'recovery' });
    if (error && (error.status >= 500 || error.name === 'AuthRetryableFetchError')) throw new Error('Recovery verification unavailable');
    const user = data?.user;
    return !error && user?.email_confirmed_at && user.email?.toLowerCase() === email ? user.id : null;
}

module.exports = { sendRecoveryCode, verifyRecoveryCode };
