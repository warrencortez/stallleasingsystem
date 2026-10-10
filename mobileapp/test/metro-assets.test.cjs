const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAssetUrl } = require('../scripts/metro-assets.cjs');
const root = 'D:/stall-leasing-dev/expo57-upgrade/node_modules';
test('cross-drive icon/font requests resolve to the watched dependency folder', () => {
    const file = root + '/@expo/vector-icons/Fonts/Ionicons.ttf';
    const input = '/assets/?unstable_path=' + encodeURIComponent('./' + file) + '&platform=android&hash=abc';
    const result = new URL(normalizeAssetUrl(input, [root]), 'http://localhost');
    assert.equal(result.searchParams.get('unstable_path'), file);
    assert.equal(result.searchParams.get('platform'), 'android');
    assert.equal(result.searchParams.get('hash'), 'abc');
});
test('asset rewrite never expands access outside the dependency watch root', () => {
    for (const file of ['D:/private/secret.txt',root+'/../../../secret.txt','C:/Windows/file.ttf']) {
        const input='/assets/?unstable_path='+encodeURIComponent('./'+file);
        assert.equal(normalizeAssetUrl(input,[root]),input);
    }
    for(const input of ['/index.bundle?platform=android','/assets/?unstable_path=./src/icon.png']) assert.equal(normalizeAssetUrl(input,[root]),input);
});
