const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
function fixture(result, appOwnership = 'standalone') {
    const calls = [];
    const mocks = {
        'react-native-url-polyfill/auto': {},
        'expo-crypto': { getRandomValues() {}, CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest() {} },
        'expo-constants': { appOwnership },
        'expo-web-browser': { openAuthSessionAsync: async () => result },
        '@supabase/supabase-js': { createClient: (url, key, options) => {
            assert.equal(options.auth.flowType, 'pkce');
            return { auth: {
                signInWithOAuth: async () => ({ data: { url: 'https://auth.example/authorize' } }),
                exchangeCodeForSession: async code => { calls.push(code); return { data: { session: { access_token: 'verified-session' } } }; }
            } };
        } }
    };
    const module = { exports: {} };
    const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/config/googleAuth.js'), 'utf8'), {
        configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')]
    }).code;
    vm.runInNewContext(code, { module, exports: module.exports, URL, process: { env: {
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable'
    } }, require: key => { if (!(key in mocks)) throw new Error(`Missing mock ${key}`); return mocks[key]; } });
    return { calls, login: module.exports.googleAccessToken };
}
test('cancelled browser login does not exchange a code or log in', async () => {
    const app = fixture({ type: 'cancel' });
    assert.equal(await app.login(), null);
    assert.equal(app.calls.length, 0);
});
test('only the registered callback can exchange a Google code', async () => {
    const wrong = fixture({ type: 'success', url: 'https://attacker.invalid/auth/callback?code=stolen' });
    await assert.rejects(wrong.login(), /Unexpected sign-in redirect/);
    assert.equal(wrong.calls.length, 0);
    const good = fixture({ type: 'success', url: 'leasehub://auth/callback?code=one-time-code' });
    assert.equal(await good.login(), 'verified-session');
    assert.deepEqual(good.calls, ['one-time-code']);
});
test('Expo Go gives an actionable message instead of opening a broken callback', async () => {
    const app = fixture({}, 'expo');
    await assert.rejects(app.login(), /installed tenant app/);
});
