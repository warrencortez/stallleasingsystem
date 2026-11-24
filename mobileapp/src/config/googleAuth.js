import 'react-native-url-polyfill/auto';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { createClient } from '@supabase/supabase-js';

// Supabase PKCE must use cryptographic randomness and SHA-256 on native Hermes.
globalThis.crypto ||= {};
globalThis.crypto.getRandomValues ||= Crypto.getRandomValues;
globalThis.crypto.subtle ||= {
    digest: async (algorithm, bytes) => {
        if (algorithm !== 'SHA-256') throw new Error('Unsupported digest algorithm');
        return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    }
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const googleConfigured = !!url && !!key;
const redirectTo = 'leasehub://auth/callback';
const flowParameter = 'sb_flow_id';

export async function googleAccessToken() {
    if (!googleConfigured) throw new Error('Google sign-in is not available yet. Please use your mobile number and password.');
    if (Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo') throw new Error('Google sign-in needs the installed tenant app. Please use password login in Expo Go.');
    if (!url.startsWith('https://')) throw new Error('Google sign-in requires an HTTPS Supabase project URL.');
    const client = createClient(url, key, { auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' }
    } });
    if (error || !data?.url) throw new Error('Unable to start Google sign-in. Check your connection and try again.');
    const request = new URL(data.url);
    const requestRedirect = request.searchParams.get('redirect_to');
    const requestedFlow = requestRedirect ? new URL(requestRedirect).searchParams.get(flowParameter) : null;
    let result;
    try {
        result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    } catch {
        throw new Error('Unable to open Google sign-in. Check that a browser is installed and try again.');
    }
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success' || !result.url) throw new Error('The browser could not complete Google sign-in. Please try again.');
    const callback = new URL(result.url);
    if (`${callback.protocol}//${callback.host}${callback.pathname}` !== redirectTo || callback.username || callback.password) throw new Error('Unexpected sign-in redirect.');
    if (callback.searchParams.has('error')) throw new Error('Google sign-in was not completed. Please try again.');
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Google did not return a sign-in code.');
    const returnedFlow = callback.searchParams.get(flowParameter);
    if (returnedFlow && returnedFlow !== requestedFlow) throw new Error('Unexpected Google sign-in session. Please try again.');
    const session = await client.auth.exchangeCodeForSession(code, requestedFlow ? { flowId: requestedFlow } : undefined);
    if (session.error?.name === 'AuthRetryableFetchError') throw new Error('Unable to reach Google sign-in services. Check your internet connection and try again.');
    if (session.error || !session.data.session?.access_token) throw new Error('Google sign-in expired. Please try again.');
    return session.data.session.access_token;
}
