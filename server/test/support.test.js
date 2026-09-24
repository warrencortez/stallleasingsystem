const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SupportStore } = require('../src/services/supportStore');
const { createSupportService } = require('../src/services/supportService');
const tenant = { id: 'tenant-a', name: 'Ana', role: 'tenant', is_active: true };
const other = { id: 'tenant-b', name: 'Ben', role: 'tenant', is_active: true };
const admin = { id: 'admin-a', name: 'Admin One', role: 'admin', is_active: true };
const second = { id: 'admin-b', name: 'Admin Two', role: 'admin', is_active: true };
async function fixture(t, customAnswer) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hoa-support-test-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const filename = path.join(dir, 'support.json');
    const users = [tenant, other, admin, second]; const notifications = []; let botCalls = 0;
    const deps = { store: new SupportStore(filename), User: { getAll: async () => users, findById: async id => users.find(u => u.id === id) }, notify: async n => notifications.push(n), answer: customAnswer || (async () => { botCalls++; return { reply: 'Available stall: A-101' }; }) };
    return { service: createSupportService(deps), deps, filename, notifications, calls: () => botCalls };
}
test('bot questions and replies persist across store instances', async t => {
    const f = await fixture(t);
    const chat = await f.service.send(tenant, tenant.id, 'available stalls', 'request-0001');
    assert.equal(chat.messages.length, 2); assert.equal(chat.messages[1].sender_role, 'assistant');
    const reloaded = createSupportService({ ...f.deps, store: new SupportStore(f.filename) });
    assert.equal((await reloaded.get(tenant)).messages[1].text, 'Available stall: A-101');
});
test('live request is idempotent and notifies active agents only', async t => {
    const f = await fixture(t);
    await f.service.requestAgent(tenant); await f.service.requestAgent(tenant);
    assert.equal(f.notifications.length, 2);
    assert.ok(f.notifications.every(n => n.type === 'general' && n.link.includes(tenant.id)));
    const chat = await f.service.get(tenant); assert.equal(chat.status, 'waiting'); assert.equal(chat.messages.length, 1);
});
test('waiting/live conversations suppress bot replies; resuming restores assistant', async t => {
    const f = await fixture(t);
    await f.service.requestAgent(tenant);
    await f.service.send(tenant, tenant.id, 'Please help', 'request-0001'); assert.equal(f.calls(), 0);
    await f.service.claim(admin, tenant.id);
    await f.service.send(admin, tenant.id, 'How can I help?', 'request-0002');
    await f.service.send(tenant, tenant.id, 'My bill', 'request-0003'); assert.equal(f.calls(), 0);
    await f.service.resume(admin, tenant.id);
    await f.service.send(tenant, tenant.id, 'available stalls', 'request-0004'); assert.equal(f.calls(), 1);
});
test('tenants cannot read others, list inbox, or impersonate an agent', async t => {
    const f = await fixture(t);
    await assert.rejects(f.service.get(tenant, other.id), { status: 403 });
    await assert.rejects(f.service.send(tenant, other.id, 'hello', 'request-0001'), { status: 403 });
    await assert.rejects(f.service.inbox(tenant), { status: 403 });
    await assert.rejects(f.service.claim(tenant, tenant.id), { status: 403 });
    await assert.rejects(f.service.resume(tenant, other.id), { status: 403 });
});
test('all tenant accounts appear in inbox, including those with no chat', async t => {
    const f = await fixture(t);
    const inbox = await f.service.inbox(admin); assert.equal(inbox.length, 2);
    assert.ok(inbox.every(c => !c.messages && !c.password && !c.email));
    await f.service.claim(admin, other.id); const result = await f.service.send(admin, other.id, 'Hello Ben', 'request-0001');
    assert.equal(result.messages.at(-1).text, 'Hello Ben');
});
test('simultaneous claims grant ownership to exactly one admin', async t => {
    const f = await fixture(t);
    const results = await Promise.allSettled([f.service.claim(admin, tenant.id), f.service.claim(second, tenant.id)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    await assert.rejects(f.service.send(second, tenant.id, 'Hijack', 'request-0001'), { status: 409 });
    await assert.rejects(f.service.resume(second, tenant.id), { status: 409 });
});
test('retrying a message does not duplicate tenant/assistant entries', async t => {
    const f = await fixture(t);
    await Promise.all([f.service.send(tenant, tenant.id, 'stalls', 'request-0001'), f.service.send(tenant, tenant.id, 'stalls', 'request-0001')]);
    const thread = await f.service.get(tenant); assert.equal(thread.messages.length, 2);
    await assert.rejects(f.service.send(tenant, tenant.id, 'different text', 'request-0001'), { status: 409 });
});
test('in-flight bot reply is suppressed when an admin takes over and releases', async t => {
    let entered; const started = new Promise(r => { entered = r; }); let release;
    const f = await fixture(t, async () => { entered(); return new Promise(r => { release = r; }); });
    const sending = f.service.send(tenant, tenant.id, 'stalls', 'request-0001'); await started;
    await f.service.claim(admin, tenant.id); await f.service.resume(admin, tenant.id);
    release({ reply: 'This stale reply must not appear' }); await sending;
    assert.ok(!(await f.service.get(tenant)).messages.some(m => m.sender_role === 'assistant'));
});
test('read markers are scoped per tenant and per agent', async t => {
    const f = await fixture(t);
    await f.service.requestAgent(tenant); await f.service.send(tenant, tenant.id, 'Help', 'request-0001');
    assert.equal((await f.service.inbox(admin)).find(c => c.tenant_id === tenant.id).unread, 1);
    await f.service.get(admin, tenant.id, true);
    assert.equal((await f.service.inbox(admin)).find(c => c.tenant_id === tenant.id).unread, 0);
    assert.equal((await f.service.inbox(second)).find(c => c.tenant_id === tenant.id).unread, 1);
    await f.service.claim(admin, tenant.id); await f.service.send(admin, tenant.id, 'Hello', 'request-0002');
    assert.ok((await f.service.get(tenant)).unread > 0);
    assert.equal((await f.service.get(tenant, tenant.id, true)).unread, 0);
});
test('tenant can cancel request and return to the assistant', async t => {
    const f = await fixture(t);
    await f.service.requestAgent(tenant); assert.equal((await f.service.resume(tenant)).status, 'bot');
});
test('notification failure does not lose the live-agent request', async t => {
    const f = await fixture(t); f.deps.notify = async () => { throw new Error('offline'); };
    const service = createSupportService(f.deps);
    assert.equal((await service.requestAgent(tenant)).status, 'waiting');
    assert.equal((await service.inbox(admin))[0].status, 'waiting');
});
test('bad messages and request keys are rejected before saving', async t => {
    const f = await fixture(t);
    await assert.rejects(f.service.send(tenant, tenant.id, ' ', 'request-0001'), { status: 400 });
    await assert.rejects(f.service.send(tenant, tenant.id, 'x'.repeat(1001), 'request-0001'), { status: 400 });
    await assert.rejects(f.service.send(tenant, tenant.id, 'Hello', ''), { status: 400 });
    assert.equal((await f.service.get(tenant)).messages.length, 0);
});
test('damaged persistent storage fails visibly instead of discarding history', async t => {
    const f = await fixture(t); await fs.writeFile(f.filename, 'broken JSON');
    await assert.rejects(new SupportStore(f.filename).snapshot());
});
