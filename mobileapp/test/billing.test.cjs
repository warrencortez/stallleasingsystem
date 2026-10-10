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
async function mountBilling({ offline = false, cancel = false, onlineReady = true } = {}) {
    const state = [], effects = [], calls = [], alerts = [];
    let cursor = 0, initial = true;
    const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
        Fragment: 'Fragment', useState: value => { const index = cursor++; if (!(index in state)) state[index] = value; return [state[index], value => state[index] = typeof value === 'function' ? value(state[index]) : value]; },
        useEffect: effect => { if (initial) effects.push(effect); }
    };
    let payment = { id: 'invoice', tenant_id: 'lease', amount: 1000, late_fee: 50, due_date: '2026-10-28', status: 'unpaid' };
    const api = {
        get: async route => { if (offline && route === '/payments') throw new Error('offline'); return { data: { success: true, data: route === '/payments/online-status' ? {ready:onlineReady,message:onlineReady?'':'Online payments are not available yet. Please pay at the HOA office.'} : route === '/payments' ? [payment] : [] } }; },
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
test('checkout explains online and office options without asking for a reference', async () => {
    const app=await mountBilling();
    assert.match(app.text(),/1,050/);
    await app.press('Pay Rent');
    assert.match(app.text(),/Continue to PayMongo/);
    assert.match(app.text(),/Visit the HOA office/);
    assert.doesNotMatch(app.text(),/Receipt \/ Bank Reference No.|Submit for Verification/);
    assert.equal(app.calls.length,0);
});
test('closing unpaid checkout only asks the server to verify; no manual paid write', async () => {
    const app = await mountBilling({ cancel: true });
    await app.press('Pay Rent'); await app.press('Continue to PayMongo');
    assert.equal(app.calls.filter(c => c.method === 'patch').length, 0);
    assert.equal(app.calls[1].body.checkout_id, 'cs_owned');
    assert.match(app.text(), /Receipts \(0\)/);
    assert.equal(app.alerts.at(-1)[0], 'Payment not confirmed');
});
test('server-confirmed checkout moves invoice into receipts', async () => {
    const app = await mountBilling();
    await app.press('Pay Rent'); await app.press('Continue to PayMongo');
    assert.match(app.text(), /Receipts \(1\)/);
    assert.equal(app.alerts.at(-1)[0], 'Payment confirmed');
});
test('unconfigured online payments show office instructions and cannot start checkout', async () => {
    const app=await mountBilling({onlineReady:false});
    await app.press('Pay Rent');
    assert.match(app.text(),/Online payments are not available yet/);
    await app.press('Continue to PayMongo');
    assert.equal(app.calls.length,0);
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

test('dashboard Report Fix callback lands on the registered maintenance tab', () => {
    const state = []; let cursor = 0;
    const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
        useState: value => [value, () => {}], useEffect() {}, useCallback: fn => fn };
    const native = Object.fromEntries(['View','Text','ScrollView','TouchableOpacity','RefreshControl','ActivityIndicator'].map(n => [n,n]));
    native.StyleSheet = { create: x => x };
    const Screen = compile('screens/dashboard/DashboardScreen.js', { react: React, 'react-native': native, '@react-navigation/native': { useFocusEffect() {} },
        '@expo/vector-icons': { Ionicons: 'Icon' }, '../../context/AuthContext': { useAuth: () => ({ user: { id:'tenant', name:'Tenant' } }) },
        '../../context/NotificationContext': { useNotifications: () => ({ unreadCount:0, fetchNotifications() {} }) }, '../../config/api': {}, '../../styles/theme': { theme } }).default;
    let target;
    const tree = Screen({ navigation: { navigate: name => { target = name; } } });
    const text = n => typeof n === 'string' ? n : (n?.children || []).map(text).join('');
    const nodes = n => n && typeof n === 'object' ? [n,...(n.children||[]).flatMap(nodes)] : [];
    const button = nodes(tree).find(n => n.type === 'TouchableOpacity' && text(n).includes('Report Fix'));
    assert.ok(button); button.props.onPress(); assert.equal(target, 'Fix Hub');
    const routes = fs.readFileSync(path.join(root,'navigation/BottomTabNavigator.js'),'utf8');
    assert.match(routes, /name="Fix Hub" component=\{MaintenanceScreen\}/);
});

test('every literal mobile navigation target has a registered route', () => {
    const routes = ['Main','Login','Register','Notifications', ...[...fs.readFileSync(path.join(root,'navigation/BottomTabNavigator.js'),'utf8').matchAll(/name="([^"]+)"/g)].map(m=>m[1])];
    const failures = [];
    function scan(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
        const filename=path.join(dir,entry.name); if(entry.isDirectory()) scan(filename); else if(filename.endsWith('.js')) {
            for(const m of fs.readFileSync(filename,'utf8').matchAll(/(?:navigation\.)?navigate\(['"]([^'"]+)['"]/g)) if(!routes.includes(m[1])) failures.push(path.relative(root,filename)+': '+m[1]);
        }
    } }
    scan(root); assert.deepEqual(failures,[]);
});

async function mountMaintenance({ offline=false, leased=true }={}) {
    const state=[],effects=[],calls=[],alerts=[];let cursor=0,initial=true;
    const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useCallback:fn=>fn,useState:value=>{const i=cursor++;if(!(i in state))state[i]=value;return[state[i],value=>state[i]=typeof value==='function'?value(state[i]):value];},useEffect:fn=>{if(initial)effects.push(fn);}};
    const native=Object.fromEntries(['View','Text','FlatList','TouchableOpacity','TextInput','Modal','ActivityIndicator','KeyboardAvoidingView','ScrollView'].map(x=>[x,x]));Object.assign(native,{StyleSheet:{create:x=>x},Alert:{alert:(...a)=>alerts.push(a)}});
    const api={get:async route=>{if(offline)throw Error('offline');return {data:{success:true,data:route==='/tenants'&&leased?[{id:'lease',user_id:'owner',status:'active',stall_id:'stall',stall_number:'A-101'}]:[]}};},post:async(route,body)=>{calls.push({route,body});return {data:{success:true}};}};
    const Screen=compile('screens/maintenance/MaintenanceScreen.js',{react:React,'react-native':native,'@react-navigation/native':{useFocusEffect:fn=>{if(initial)effects.push(fn);}},'@react-native-async-storage/async-storage':{getItem:async()=>null,setItem:async()=>{}},'@expo/vector-icons':{Ionicons:'Icon'},'../../context/AuthContext':{useAuth:()=>({user:{id:'owner'}})},'../../config/api':api,'../../styles/theme':{theme}}).default;
    const render=()=>{cursor=0;const tree=Screen({navigation:{navigate(){}},route:{}});initial=false;return tree;};let tree=render();effects.forEach(fn=>fn());await flush();tree=render();
    const nodes=n=>!n||typeof n!=='object'||(n.type==='Modal'&&!n.props.visible)?[]:[n,...(n.children||[]).flatMap(nodes)];
    const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join('');
    return {calls,alerts,text:()=>text(tree),press:async label=>{const button=nodes(tree).find(n=>n.type==='TouchableOpacity'&&text(n).includes(label));assert.ok(button,'Button '+label);await button.props.onPress();await flush();tree=render();},enter:(placeholder,value)=>{const node=nodes(tree).find(n=>n.type==='TextInput'&&n.props.placeholder.includes(placeholder));assert.ok(node);node.props.onChangeText(value);tree=render();}};
}
test('Fix Hub submits a report for the owned leased stall',async()=>{const screen=await mountMaintenance();await screen.press('Report Issue');screen.enter('Front shutter','Broken lock');screen.enter('Describe','Door lock needs repair');await screen.press('Submit Ticket');assert.equal(screen.calls[0].route,'/maintenance');assert.equal(screen.calls[0].body.stall_id,'stall');assert.equal(screen.calls[0].body.tenant_id,'lease');assert.match(screen.alerts.at(-1)[0],/Submitted/);});
test('Fix Hub distinguishes a failed connection from an account with no lease',async()=>{const failed=await mountMaintenance({offline:true});assert.match(failed.text(),/Unable to load/);assert.ok(!failed.text().includes("You don't have any active rent"));await failed.press('Retry');const unleased=await mountMaintenance({leased:false});assert.match(unleased.text(),/You don't have any active rent/);});
