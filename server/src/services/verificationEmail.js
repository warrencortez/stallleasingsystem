const { randomBytes } = require('node:crypto');

// Isolated clients prevent one verification request from retaining another user's session.
function client() {
    const { createClient } = require('@supabase/supabase-js');
    const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw Object.assign(new Error('Email verification is not configured. Please contact the administrator.'),{status:503});
    return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(10000)})}});
}
async function sendCode(email, resend = false) {
    const auth = client().auth;
    // MR99 owns the tenant password. Supabase only needs an independent signup credential.
    const { data, error } = resend
        ? await auth.resend({ email, type: 'signup' })
        : await auth.signUp({ email, password: `${randomBytes(32).toString('hex')}!A1` });
    if (!error) {
        if (!resend && (data?.session || !data?.user)) {
            throw Object.assign(new Error('Email confirmation is temporarily unavailable. Please contact MR99 support.'), { status: 503 });
        }
        if (!resend && data.user.identities?.length === 0) {
            throw Object.assign(new Error('This email is already verified. Try signing in or contact MR99 support.'), { status: 409 });
        }
        return;
    }
    if (['user_already_exists', 'email_exists', 'email_already_confirmed'].includes(error.code)) {
        throw Object.assign(new Error('This email is already verified. Try signing in or contact MR99 support.'), { status: 409 });
    }
    if (error.status===429) throw Object.assign(new Error('Email sending limit reached. Please try again later.'),{status:429,retryAfter:60});
    throw Object.assign(new Error('Unable to send the verification email. Please try again later or contact MR99 support.'),{status:503});
}
async function verifyCode(email,code) {
    const { data,error } = await client().auth.verifyOtp({email,token:code,type:'email'});
    if (error) {
        if (error.code==='otp_expired' || error.status===403 || error.status===422) return null;
        throw Object.assign(new Error('Email verification is temporarily unavailable. Please try again.'),{status:503});
    }
    if (!data?.user?.id || !data.user.email_confirmed_at || data.user.email?.toLowerCase()!==email) return null;
    return { id:data.user.id };
}
module.exports={sendCode,verifyCode};
