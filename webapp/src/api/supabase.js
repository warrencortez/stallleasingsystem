import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let client;
export function supabase() {
    if (!url || !key) throw new Error('Google sign-in is not available yet. Please use your email and password.');
    client ||= createClient(url, key, { auth: {
        flowType: 'pkce', storage: window.sessionStorage, autoRefreshToken: false, detectSessionInUrl: false
    } });
    return client;
}
export async function startGoogleLogin() {
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' }
    } });
    if (error) throw error;
}
let callbackPromise;
export function finishGoogleLogin() {
    // Reuse the exchange during React StrictMode's repeated mount. Codes are single-use.
    if (!callbackPromise) callbackPromise = (async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        window.history.replaceState({}, '', '/auth/callback');
        if (params.has('error') || !code) throw new Error('Google sign-in was cancelled or expired. Please try again.');
        const { data, error } = await supabase().auth.exchangeCodeForSession(code);
        if (error || !data.session?.access_token) throw new Error('Google sign-in expired. Please try again.');
        return data.session.access_token;
    })();
    return callbackPromise;
}
