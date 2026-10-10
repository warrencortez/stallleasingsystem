let authClient, storageClient;
function client(key) {
    const url = process.env.SUPABASE_URL;
    if (!url || !key) throw Object.assign(new Error('Supabase is not configured on the server.'), { status: 503 });
    if (!url.startsWith('https://')) throw new Error('Supabase requires HTTPS.');
    return require('@supabase/supabase-js').createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
}
module.exports = {
    auth: () => authClient ||= client(process.env.SUPABASE_PUBLISHABLE_KEY),
    storage: () => storageClient ||= client(process.env.SUPABASE_SERVICE_ROLE_KEY)
};
