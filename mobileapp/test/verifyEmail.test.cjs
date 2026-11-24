const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const source = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/screens/auth/VerifyEmailScreen.js'), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs']
}).code;

function screen(post, recovery = false) {
    const state = [], alerts = [], navigations = [], grants = [];
    let cursor, now = 0, foreground;
    class Clock extends Date { static now() { return now; } }
    const challenge = () => ({ challengeId: 'test', email: 'tenant@example.test',
        serverNow: new Date(now).toISOString(), expiresAt: new Date(now + 300000).toISOString(), resendAt: new Date(now + 60000).toISOString() });
    const react = {
        createElement: (type, props, ...children) => ({ type, props, children }),
        useState(initial) {
            const index = cursor++;
            if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
            return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
        },
        useRef: value => react.useState({ current: value })[0],
        useEffect(effect) { if (!foreground) effect(); }
    };
    const native = Object.fromEntries(['KeyboardAvoidingView', 'ScrollView', 'View', 'Text', 'TextInput', 'TouchableOpacity', 'ActivityIndicator'].map(name => [name, name]));
    native.AppState = { addEventListener: (_event, handler) => { foreground = handler; return { remove() {} }; } };
    native.Alert = { alert: title => alerts.push(title) };
    const mocks = { react, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' }, './onboardingStyles': {},
        '../../config/api': { post: (url, body) => post(url, body, challenge) } };
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports, require: name => mocks[name], Date: Clock, setInterval() {}, clearInterval() {} });
    const route = { params: { challenge: challenge() } };
    const navigation = { reset: value => navigations.push(value) };
    const nodes = node => node?.children ? [node, ...node.children.flatMap(nodes)] : [];
    const render = () => {
        cursor = 0;
        return nodes(module.exports.default({ route, navigation, onRecoveryVerified: recovery ? (...args) => grants.push(args) : undefined }));
    };
    const input = () => render().find(node => node.type === 'TextInput').props;
    const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
    const button = label => render().find(node => node.type === 'TouchableOpacity' && text(node).includes(label)).props;
    return { input, button, alerts, navigations, grants, advance: ms => { now += ms; foreground('active'); } };
}

test('recovery uses separate endpoints and passes the latest challenge and grant to the next step in memory', async () => {
    const app = screen(async (url, body, challenge) => {
        if (url.endsWith('/resend')) {
            assert.equal(url, '/auth/forgot-password/resend');
            return { data: { data: { ...challenge(), challengeId: 'new-challenge' } } };
        }
        assert.equal(url, '/auth/forgot-password/verify');
        assert.equal(body.challengeId, 'new-challenge');
        assert.equal(body.code, '123456');
        return { data: { data: { resetToken: 'mock-grant' } } };
    }, true);
    assert.equal(app.button('Verify Code').disabled, true);
    app.advance(61000);
    await app.button('Resend verification code').onPress();
    app.input().onChangeText('123456');
    await app.button('Verify Code').onPress();
    assert.deepEqual(app.grants, [['new-challenge', 'mock-grant']]);
    assert.equal(app.navigations.length, 0);
});

test('OTP paste enables verification and duplicate taps share one in-flight request', async () => {
    let resolve, requests = 0;
    const app = screen((_url, body) => {
        requests++;
        assert.equal(body.code, '012345');
        return new Promise(done => { resolve = done; });
    });
    assert.equal(app.input().autoFocus, true);
    assert.equal(app.button('Verify Email').disabled, true);
    app.input().onChangeText('012 345');
    const verify = app.button('Verify Email');
    assert.equal(verify.disabled, false);
    verify.onPress(); verify.onPress();
    assert.equal(requests, 1);
    resolve({ data: { data: { verified: true } } });
    await new Promise(setImmediate);
    assert.equal(app.alerts[0], 'Email Successfully Verified');
    assert.equal(app.navigations[0].routes[0].name, 'Login');
});

test('foreground updates expiry and only a successful resend resets the input and cooldown', async () => {
    let attempts = 0;
    const app = screen(async (_url, _body, challenge) => {
        if (++attempts === 1) throw new Error('Offline');
        return { data: { data: challenge() } };
    });
    app.input().onChangeText('123456');
    app.advance(301000);
    assert.equal(app.button('Verify Email').disabled, true);
    await app.button('Resend verification code').onPress();
    assert.equal(app.input().value, '123456');
    assert.equal(app.button('Verify Email').disabled, true);
    await app.button('Resend verification code').onPress();
    assert.equal(app.input().value, '');
    assert.equal(app.button('Resend available').disabled, true);
});
