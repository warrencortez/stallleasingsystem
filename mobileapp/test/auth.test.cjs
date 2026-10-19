const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

function mountAuth(success = true, responseData = null) {
    const state = [], writes = [], requests = [];
    let cursor = 0;
    const react = {
        createContext: () => ({ Provider: 'Provider' }),
        createElement: (type, props) => ({ type, props }),
        useEffect() {},
        useContext() {},
        useState(initial) {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], value => { state[index] = value; }];
        }
    };
    const mocks = {
        react,
        '@react-native-async-storage/async-storage': { multiSet: async pairs => writes.push(pairs) },
        '../config/api': { post: async (route, body) => {
            requests.push({ route, body });
            return { data: { success, message: 'Registration failed', data: responseData || {
                token: 'server-token', user: { id: 'tenant-id', role: 'tenant' }
            } } };
        } }
    };
    const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/context/AuthContext.js'), 'utf8'), {
        configFile: false, babelrc: false,
        plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')]
    }).code;
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, require: name => {
        if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
        return mocks[name];
    } });
    return { writes, requests, render() {
        cursor = 0;
        return module.exports.AuthProvider({ children: null }).props.value;
    } };
}

test('registration leaves the tenant signed out even when the server returns a token', async () => {
    const app = mountAuth();
    const result = await app.render().register({ name: 'Tenant', phone: '+639123456789', password: 'secret123' });
    assert.equal(result.success, true);
    assert.equal(app.requests[0].route, '/auth/register');
    assert.equal(app.writes.length, 0);
    assert.equal(app.render().isAuthenticated, false);
    assert.equal(app.render().user, null);
    assert.equal(app.render().token, null);
    await app.render().login('+639123456789', 'secret123');
    assert.equal(app.writes.length, 1);
    assert.equal(app.render().isAuthenticated, true);
});

test('failed registration leaves the tenant signed out and returns the error', async () => {
    const app = mountAuth(false);
    const result = await app.render().register({});
    assert.equal(result.success, false);
    assert.equal(result.message, 'Registration failed');
    assert.equal(app.writes.length, 0);
    assert.equal(app.render().isAuthenticated, false);
});

test('Google login establishes a tenant session through the backend', async () => {
    const app = mountAuth();
    const result = await app.render().loginWithGoogle('supabase-token', 'existing-password', '+639123456789');
    assert.equal(result.success, true);
    assert.equal(app.requests[0].route, '/auth/google');
    assert.equal(app.requests[0].body.audience, 'tenant');
    assert.equal(app.requests[0].body.existingIdentifier, '+639123456789');
    assert.equal(app.render().isAuthenticated, true);
    assert.equal(app.render().token, 'server-token');
});

test('new Google identities cannot start a session before completing their contacts', async () => {
    const app=mountAuth(true,{profileRequired:true,email:'verified@example.com',name:'Verified Name'});
    const result=await app.render().loginWithGoogle('google-access-token');
    assert.equal(result.profileRequired,true);
    assert.equal(app.render().isAuthenticated,false);
    assert.equal(app.writes.length,0);
    assert.equal(app.render().googleSetup.email,'verified@example.com');
    await app.render().completeGoogleProfile({name:'Full Name',phone:'+639123456789'});
    assert.equal(app.requests[1].body.accessToken,'google-access-token');
    assert.equal(app.requests[1].body.profile.phone,'+639123456789');
});
test('pending email registration returns only challenge information without a session', async () => {
    const app=mountAuth(true,{challengeId:'challenge',email:'tenant@example.com',expiresAt:'expiry',resendAt:'resend',serverNow:'now'});
    const result=await app.render().register({email:'tenant@example.com',password:'secret123',confirmPassword:'secret123'});
    assert.equal(result.challengeId,'challenge');
    assert.equal(app.render().isAuthenticated,false);
    assert.equal(app.writes.length,0);
});
