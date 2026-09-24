import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaArrowLeft, FaExpandAlt, FaHeadset, FaPaperPlane } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import api from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useSupport } from '../../context/supportContext';
import './SupportInbox.css';

const statusName = { bot: 'Assistant', waiting: 'Waiting for an admin', live: 'Live conversation' };
export default function SupportInbox({ compact = false }) {
    const { user } = useAuth();
    const { conversations, waitingCount, loading, error: inboxError, refresh } = useSupport();
    const [params, setParams] = useSearchParams();
    const [compactSelection, setCompactSelection] = useState('');
    const selected = compact ? compactSelection : params.get('tenant') || '';
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [thread, setThread] = useState(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const end = useRef(null);
    const current = useRef(selected);
    const lock = useRef(false);
    const retry = useRef(null);
    useEffect(() => { current.current = selected; }, [selected]);
    const choose = id => { current.current = id; setThread(null); setDraft(''); setError(''); retry.current = null; if (compact) setCompactSelection(id); else setParams(id ? { tenant: id } : {}); };
    useEffect(() => {
        if (!selected) return;
        let active = true; let polling = false;
        const controller = new AbortController();
        async function load() {
            if (polling || document.hidden) return;
            polling = true;
            try {
                const { data } = await api.get(`/support/threads/${selected}?read=true`, { signal: controller.signal });
                if (active) { setThread(old => old?.tenant_id === selected && old.version > data.data.version ? old : data.data); setError(''); }
            } catch (err) { if (active && err.code !== 'ERR_CANCELED') setError('Could not load this conversation. Retrying shortly…'); }
            finally { polling = false; }
        }
        load(); const interval = setInterval(load, 3000);
        return () => { active = false; clearInterval(interval); controller.abort(); };
    }, [selected]);
    useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [thread?.messages.length, selected]);
    const activeThread = thread?.tenant_id === selected ? thread : null;
    const owned = activeThread?.status === 'live' && activeThread.assigned_to === user.id;
    async function action(kind) {
        if (!selected || lock.current) return;
        const tenantId = selected; lock.current = true; setBusy(true); setError('');
        try {
            const { data } = await api.post(`/support/threads/${tenantId}/${kind}`);
            if (current.current === tenantId) setThread(old => old?.version > data.data.version ? old : data.data);
            refresh();
        } catch (err) { if (current.current === tenantId) setError(err.response?.data?.message || 'The action failed. Please retry.'); }
        finally { lock.current = false; setBusy(false); }
    }
    async function send(event) {
        event.preventDefault();
        const text = draft.trim(); const tenantId = selected;
        if (!text || !owned || lock.current) return;
        lock.current = true; setBusy(true); setError('');
        const clientId = retry.current?.tenantId === tenantId && retry.current.text === text ? retry.current.id : crypto.randomUUID();
        retry.current = { tenantId, text, id: clientId };
        try {
            const { data } = await api.post(`/support/threads/${tenantId}/messages`, { message: text, client_id: clientId });
            if (current.current === tenantId) { setThread(old => old?.version > data.data.version ? old : data.data); setDraft(''); retry.current = null; }
            refresh();
        } catch (err) { if (current.current === tenantId) setError(err.response?.data?.message || 'Message not confirmed. Your draft is ready to retry.'); }
        finally { lock.current = false; setBusy(false); }
    }
    const items = conversations.filter(c => c.tenant_name.toLowerCase().includes(search.toLowerCase()) && (filter !== 'waiting' || c.status === 'waiting'));
    return <div className={`support-workspace ${compact ? 'support-compact' : ''}`}>
        {!compact && <div className="support-page-heading"><div><h3>Tenant conversations</h3><p>Read assistant history, respond to requests, and message a tenant.</p></div><span className="support-queue-count"><FaHeadset /> {waitingCount} waiting</span></div>}
        {inboxError && <div className="support-error" role="alert">{inboxError} <button onClick={refresh}>Retry</button></div>}
        <div className={`support-layout ${selected ? 'support-has-selection' : ''}`}>
            <aside className="support-contacts" aria-label="Tenant conversations">
                <div className="support-search"><input aria-label="Search tenant conversations" placeholder="Search tenants…" value={search} onChange={e => setSearch(e.target.value)} /><div className="support-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All tenants</button><button className={filter === 'waiting' ? 'active' : ''} onClick={() => setFilter('waiting')}>Waiting ({waitingCount})</button></div></div>
                <div className="support-contact-list">
                    {loading && <p className="support-empty">Loading conversations…</p>}
                    {!loading && !items.length && <p className="support-empty">No matching tenant accounts.</p>}
                    {items.map(c => <button key={c.tenant_id} className={`support-contact ${selected === c.tenant_id ? 'selected' : ''}`} onClick={() => choose(c.tenant_id)}>
                        <span className="support-contact-top"><strong>{c.tenant_name}</strong>{c.unread > 0 && <span className="support-unread">{c.unread}</span>}</span>
                        <span className={`support-status support-status-${c.status}`}>{statusName[c.status]}</span>
                        <span className="support-preview">{c.last_message}</span>
                    </button>)}
                </div>
            </aside>
            <section className="support-thread" aria-label="Selected tenant conversation">
                {!selected ? <div className="support-empty support-start"><FaHeadset size={36} /><h4>Your tenant inbox</h4><p>Select a tenant to see their conversation or start a live chat.</p></div> : <>
                    <header className="support-thread-header"><button className="support-back" onClick={() => choose('')} aria-label="Back to tenant list"><FaArrowLeft /></button><div><strong>{activeThread?.tenant_name || conversations.find(c => c.tenant_id === selected)?.tenant_name || 'Loading…'}</strong><small>{activeThread ? statusName[activeThread.status] : 'Loading conversation…'}{activeThread?.assigned_name ? ` · ${activeThread.assigned_name}` : ''}</small></div>{compact && <Link to={`/conversations?tenant=${encodeURIComponent(selected)}`} aria-label="Open full inbox"><FaExpandAlt /></Link>}</header>
                    {activeThread && <div className="support-actions">{owned ? <><span>You are replying as {user.name}</span><button disabled={busy} onClick={() => action('resume')}>Return to assistant</button></> : activeThread.status === 'live' ? <span>{activeThread.assigned_name} is handling this chat.</span> : <><span>{activeThread.status === 'waiting' ? 'This tenant is waiting for an administrator.' : 'Take over to send a personal message.'}</span><button disabled={busy} onClick={() => action('claim')}>{activeThread.status === 'waiting' ? 'Accept request' : 'Take over chat'}</button></>}</div>}
                    <div className="support-messages" role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions">
                        {!activeThread && <p className="support-empty">Loading conversation…</p>}
                        {activeThread?.messages.length === 0 && <p className="support-empty">No messages yet. Take over the chat to contact this tenant.</p>}
                        {activeThread?.messages.map(m => <div key={m.id} className={`support-message support-message-${m.sender_role}`}><span className="support-sender">{m.sender_role === 'assistant' ? 'Assistant' : m.sender_name}</span><div>{m.text}</div><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>)}<div ref={end} />
                    </div>
                    {error && <div className="support-error" role="alert">{error}</div>}
                    <form className="support-compose" onSubmit={send}><label className="visually-hidden" htmlFor={compact ? 'support-compact-message' : 'support-message'}>Message this tenant</label><textarea id={compact ? 'support-compact-message' : 'support-message'} value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} rows={2} disabled={!owned || busy} placeholder={owned ? 'Write a message to this tenant…' : 'Take over the chat to reply'} /><button type="submit" disabled={!owned || busy || !draft.trim()} aria-label="Send message to tenant"><FaPaperPlane /></button></form>
                </>}
            </section>
        </div>
    </div>;
}
