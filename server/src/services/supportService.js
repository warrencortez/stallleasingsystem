const { randomUUID } = require('node:crypto');
const isAgent = user => ['admin', 'staff'].includes(user.role);
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function validateText(text) {
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail(400, 'Enter a message between 1 and 1,000 characters.');
    return text.trim();
}
function validateKey(key) {
    if (typeof key !== 'string' || !/^[\w-]{8,100}$/.test(key)) fail(400, 'A valid message request ID is required.');
}
function ensure(state, tenant) {
    if (!Object.hasOwn(state.threads, tenant.id)) state.threads[tenant.id] = {
        tenant_id: tenant.id, tenant_name: tenant.name, status: 'bot', assigned_to: null, assigned_name: null,
        requested_at: null, version: 0, bot_epoch: 0, tenant_read: 0, agent_reads: {}, messages: [], updated_at: new Date().toISOString(),
    };
    state.threads[tenant.id].tenant_name = tenant.name;
    return state.threads[tenant.id];
}
function append(thread, role, name, text, extra = {}) {
    const message = { id: randomUUID(), seq: thread.messages.length + 1, sender_role: role, sender_name: name, text, created_at: new Date().toISOString(), ...extra };
    thread.messages.push(message); thread.version++; thread.updated_at = message.created_at;
    return message;
}
function dto(thread, user) {
    const seen = isAgent(user) ? thread.agent_reads[user.id] || 0 : thread.tenant_read;
    const unread = thread.messages.filter(m => m.seq > seen && (isAgent(user) ? m.sender_role === 'tenant' : m.sender_role !== 'tenant')).length;
    return { tenant_id: thread.tenant_id, tenant_name: thread.tenant_name, status: thread.status, assigned_to: thread.assigned_to,
        assigned_name: thread.assigned_name, requested_at: thread.requested_at, updated_at: thread.updated_at,
        version: thread.version, unread, messages: thread.messages };
}
function createSupportService({ store, User, notify, answer }) {
    async function target(actor, tenantId) {
        if (actor.role === 'tenant') {
            if (tenantId && tenantId !== actor.id) fail(403, 'You can only access your own conversation.');
            return actor;
        }
        if (!isAgent(actor)) fail(403, 'This account cannot access conversations.');
        const user = await User.findById(tenantId);
        if (!user || user.role !== 'tenant') fail(404, 'Tenant account not found.');
        return user;
    }
    async function get(actor, tenantId, read = false) {
        const tenant = await target(actor, tenantId);
        const state = await store.snapshot();
        let thread = ensure(state, tenant);
        const last = thread.messages.length;
        const seen = isAgent(actor) ? thread.agent_reads[actor.id] || 0 : thread.tenant_read;
        if (read && last > seen) thread = await store.mutate(s => {
            const t = ensure(s, tenant);
            if (isAgent(actor)) t.agent_reads[actor.id] = Math.max(t.agent_reads[actor.id] || 0, last);
            else t.tenant_read = Math.max(t.tenant_read, last);
            return t;
        });
        return dto(thread, actor);
    }
    async function inbox(actor) {
        if (!isAgent(actor)) fail(403, 'Only administrators and staff can view the tenant inbox.');
        const [users, state] = await Promise.all([User.getAll({ role: 'tenant' }), store.snapshot()]);
        return users.filter(u => u.role === 'tenant').map(user => {
            const thread = ensure(state, user); const data = dto(thread, actor);
            return { ...data, messages: undefined, tenant_active: user.is_active !== false, last_message: thread.messages.at(-1)?.text || 'No messages yet', message_count: thread.messages.length };
        }).sort((a, b) => (b.status === 'waiting') - (a.status === 'waiting') || b.unread - a.unread || new Date(b.updated_at) - new Date(a.updated_at));
    }
    async function notifyAgents(tenant, message) {
        const users = await User.getAll();
        await Promise.allSettled(users.filter(u => isAgent(u) && u.is_active).map(u => notify({ user_id: u.id, title: 'Tenant requesting a live agent', message, type: 'general', link: `/conversations?tenant=${encodeURIComponent(tenant.id)}` })));
    }
    async function requestAgent(actor) {
        if (actor.role !== 'tenant') fail(403, 'Only tenants can request a live agent.');
        const result = await store.mutate(state => {
            const t = ensure(state, actor);
            if (t.status !== 'bot') return { thread: t, changed: false };
            t.status = 'waiting'; t.bot_epoch = (t.bot_epoch || 0) + 1; t.requested_at = new Date().toISOString();
            append(t, 'system', 'Support', 'A live agent has been requested. An administrator will join when available. You can leave a message while you wait.');
            return { thread: t, changed: true };
        });
        // The inbox queue remains authoritative even if legacy notifications fail.
        if (result.changed) await notifyAgents(actor, `${actor.name} would like to speak with an administrator.`).catch(error => console.error('Support notification failed:', error.message));
        return dto(result.thread, actor);
    }
    async function claim(actor, tenantId) {
        if (!isAgent(actor)) fail(403, 'Only administrators and staff can take over a conversation.');
        const tenant = await target(actor, tenantId);
        return dto(await store.mutate(state => {
            const t = ensure(state, tenant);
            if (t.status === 'live' && t.assigned_to !== actor.id) fail(409, `${t.assigned_name || 'Another administrator'} is already handling this conversation.`);
            if (t.status !== 'live') {
                t.status = 'live'; t.bot_epoch = (t.bot_epoch || 0) + 1; t.assigned_to = actor.id; t.assigned_name = actor.name;
                append(t, 'system', 'Support', `${actor.name} has joined the conversation. You are now chatting with a live administrator.`);
            }
            return t;
        }), actor);
    }
    async function resume(actor, tenantId) {
        const tenant = await target(actor, tenantId);
        return dto(await store.mutate(state => {
            const t = ensure(state, tenant);
            if (isAgent(actor) && t.status === 'live' && t.assigned_to !== actor.id) fail(409, 'Only the assigned administrator can end this live conversation.');
            if (t.status !== 'bot') {
                t.status = 'bot'; t.bot_epoch = (t.bot_epoch || 0) + 1; t.assigned_to = null; t.assigned_name = null; t.requested_at = null;
                append(t, 'system', 'Support', 'The live-agent session has ended. The assistant is available again. Your conversation history has been kept.');
            }
            return t;
        }), actor);
    }
    async function send(actor, tenantId, text, clientId) {
        text = validateText(text); validateKey(clientId);
        const tenant = await target(actor, tenantId);
        const result = await store.mutate(state => {
            const t = ensure(state, tenant);
            const previous = t.messages.find(m => m.client_id === clientId && m.sender_id === actor.id);
            if (previous) {
                if (previous.text !== text) fail(409, 'This request ID was already used for a different message.');
                return { thread: t, duplicate: true, message: previous };
            }
            if (isAgent(actor) && (t.status !== 'live' || t.assigned_to !== actor.id)) fail(409, 'Take over this conversation before sending a message.');
            const message = append(t, isAgent(actor) ? 'admin' : 'tenant', actor.name, text, { sender_id: actor.id, client_id: clientId, expects_assistant: actor.role === 'tenant' && t.status === 'bot', bot_epoch: t.bot_epoch || 0 });
            return { thread: t, duplicate: false, message };
        });
        if (actor.role === 'tenant' && result.thread.status === 'bot' && result.message.expects_assistant && (result.thread.bot_epoch || 0) === result.message.bot_epoch) {
            // Claim/resume races cannot produce a bot reply in a live session.
            const alreadyAnswered = result.thread.messages.some(m => m.reply_to === result.message.id);
            if (!alreadyAnswered) {
                let reply;
                try { reply = (await answer(text, actor)).reply; }
                catch { reply = 'I could not check the system records right now. Please try again, or request a live agent.'; }
                await store.mutate(state => {
                    const t = ensure(state, tenant);
                    if (t.status === 'bot' && (t.bot_epoch || 0) === result.message.bot_epoch && !t.messages.some(m => m.reply_to === result.message.id)) {
                        append(t, 'assistant', 'Stall Leasing Assistant', reply, { reply_to: result.message.id });
                    }
                    return t;
                });
            }
        }
        return get(actor, tenant.id);
    }
    return { get, inbox, requestAgent, claim, resume, send };
}
module.exports = { createSupportService };
