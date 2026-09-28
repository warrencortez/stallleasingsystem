const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '../src');
function compile(file, mocks) {
    const code = babel.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), {
        filename: file, configFile: false, babelrc: false,
        plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')]
    }).code;
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: name => {
        if (!(name in mocks)) throw new Error('Missing mock: ' + name); return mocks[name];
    }, console, setInterval: () => 1, clearInterval() {}, __DEV__: true, process });
    return module.exports;
}
const theme = compile('styles/theme.js', {}).theme;
const flush = () => new Promise(resolve => setImmediate(resolve));
async function mountBilling({ offline = false, cancel = false } = {}) {
    const state = [], effects = [], calls = [], alerts = [];
    let cursor = 0, initial = true;
    const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
        Fragment: 'Fragment', useState: value => { const index = cursor++; if (!(index in state)) state[index] = value; return [state[index], value => state[index] = typeof value === 'function' ? value(state[index]) : value]; },
        useEffect: effect => { if (initial) effects.push(effect); }
    };
    let payment = { id: 'invoice', tenant_id: 'lease', amount: 1000, late_fee: 50, due_date: '2026-10-28', status: 'unpaid' };
    const api = {
        get: async route => { if (offline && route === '/payments') throw new Error('offline'); return { data: { success: true, data: route === '/payments' ? [payment] : [] } }; },
        patch: async (route, body) => { calls.push({ method: 'patch', route, body }); payment = { ...payment, status: 'pending_verification' }; return { data: { success: true, data: payment } }; },
        post: async (route, body) => { calls.push({ method: 'post', route, body });
            if (route.endsWith('/paymongo-checkout')) return { data: { success: true, data: { checkoutUrl: 'https://checkout.example.invalid', checkoutId: 'cs_owned' } } };
            if (cancel) throw { response: { data: { message: 'Payment is not confirmed.' } } };
            payment = { ...payment, status: 'paid' }; return { data: { success: true, data: payment } };
        }
    };
    const native = Object.fromEntries(['View','Text','FlatList','TouchableOpacity','Modal','ActivityIndicator','ScrollView','TextInput'].map(x => [x, x]));
    Object.assign(native, { StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) } });
    const Screen = compile('screens/billing/BillingScreen.js', { react: React, 'react-native': native,
        'expo-web-browser': { openBrowserAsync: async () => ({ type: 'dismiss' }) }, '@expo/vector-icons': { Ionicons: 'Icon' },
        '../../context/AuthContext': { useAuth: () => ({ user: { id: 'owner', email: 'owner@example.invalid' } }) },
        '../../config/api': api, '../../styles/theme': { theme }
    }).default;
    const render = () => { cursor = 0; const tree = Screen(); initial = false; return tree; };
    let tree = render(); effects.forEach(fn => fn()); await flush(); tree = render();
    const nodes = value => {
        if (!value || typeof value !== 'object') return [];
        if (value.type === 'Modal' && !value.props.visible) return [];
        const children = value.type === 'FlatList' ? (value.props.data.length ? value.props.data.map(item => value.props.renderItem({ item })) : [value.props.ListEmptyComponent]) : value.children;
        return [value, ...(children || []).flatMap(nodes)];
    };
    const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : (node?.children || []).map(text).join('');
    const findButton = label => nodes(tree).find(n => n.type === 'TouchableOpacity' && text(n).includes(label));
    return {
        calls, alerts,
        text: () => nodes(tree).filter(n => n.type === 'Text').map(text).join(' '),
        press: async label => { const button = findButton(label); assert.ok(button, 'Button exists: ' + label); await button.props.onPress(); await flush(); tree = render(); },
        enterReference: value => { const input = nodes(tree).find(n => n.type === 'TextInput'); assert.ok(input); input.props.onChangeText(value); tree = render(); }
    };
}
test('manual payment submits reference for review and never fabricates a paid receipt', async () => {
    const app = await mountBilling();
    assert.match(app.text(), /1,050/);
    await app.press('Select Payment'); app.enterReference('actual-bank-reference');
    await app.press('Submit for Verification');
    assert.equal(app.calls[0].body.is_manual_verify, undefined);
    assert.equal(app.calls[0].body.reference_number, 'actual-bank-reference');
    assert.match(app.text(), /pending_verification/);
    assert.match(app.text(), /Receipts \(0\)/);
    assert.equal(app.alerts.at(-1)[0], 'Submitted for review');
});
test('closing unpaid checkout only asks the server to verify; no manual paid write', async () => {
    const app = await mountBilling({ cancel: true });
    await app.press('Select Payment'); await app.press('PayMongo Portal');
    assert.equal(app.calls.filter(c => c.method === 'patch').length, 0);
    assert.equal(app.calls[1].body.checkout_id, 'cs_owned');
    assert.match(app.text(), /Receipts \(0\)/);
    assert.equal(app.alerts.at(-1)[0], 'Payment not confirmed');
});
test('server-confirmed checkout moves invoice into receipts', async () => {
    const app = await mountBilling();
    await app.press('Select Payment'); await app.press('PayMongo Portal');
    assert.match(app.text(), /Receipts \(1\)/);
    assert.equal(app.alerts.at(-1)[0], 'Payment confirmed');
});
test('network failure shows retry instead of a false all-caught-up state', async () => {
    const app = await mountBilling({ offline: true });
    assert.match(app.text(), /Unable to load your bills/);
    assert.doesNotMatch(app.text(), /All Caught Up/);
});

test('stored mobile sessions recover from malformed JSON and reject staff accounts', async () => {
    for (const savedUser of ['{invalid', JSON.stringify({ id: 'admin', role: 'admin' }), JSON.stringify({ id: 'owner', role: 'tenant' })]) {
        const state = [], effects = []; let cursor = 0, first = true, cleared = false;
        const React = { createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }), useContext() {},
            useState: value => { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], v => state[i] = v]; },
            useEffect: fn => { if (first) effects.push(fn); } };
        const storage = { getItem: async key => key === 'user_token' ? 'token' : key === 'user_data' ? savedUser : null,
            multiRemove: async () => { cleared = true; } };
        const Provider = compile('context/AuthContext.js', { react: React, '@react-native-async-storage/async-storage': storage, '../config/api': { defaults: {} } }).AuthProvider;
        Provider({}); first = false; effects.forEach(fn => fn()); await flush(); cursor = 0;
        const value = Provider({}).props.value;
        const valid = savedUser.includes('tenant');
        assert.equal(value.isAuthenticated, valid); assert.equal(cleared, !valid); assert.equal(value.loading, false);
    }
});
