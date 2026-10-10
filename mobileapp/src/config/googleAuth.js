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
let client;
export async function googleAccessToken() {
    if (!googleConfigured) throw new Error('Google sign-in is not available yet. Please use your mobile number and password.');
    if (Constants.appOwnership === 'expo') throw new Error('Google sign-in needs the installed tenant app. Please use password login in Expo Go.');
    client ||= createClient(url, key, { auth: { flowType: 'pkce', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' }
    } });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null;
    const callback = new URL(result.url);
    if (`${callback.protocol}//${callback.host}${callback.pathname}` !== redirectTo) throw new Error('Unexpected sign-in redirect.');
    if (callback.searchParams.has('error')) throw new Error('Google sign-in was not completed. Please try again.');
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Google did not return a sign-in code.');
    const session = await client.auth.exchangeCodeForSession(code);
    if (session.error || !session.data.session?.access_token) throw new Error('Google sign-in expired. Please try again.');
    return session.data.session.access_token;
}
