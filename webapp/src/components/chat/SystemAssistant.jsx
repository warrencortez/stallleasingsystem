import { useEffect, useRef, useState } from 'react';
import { FaCommentDots, FaPaperPlane, FaTimes } from 'react-icons/fa';
import api from '../../api/axiosConfig';
import './SystemAssistant.css';
import SupportInbox from './SupportInbox';
import { useSupport } from '../../context/supportContext';

const suggestions = ['Which stalls are available?', 'Check rent due dates', 'Show maintenance reports', 'Show billing summary', 'Check applications', 'Latest announcements'];
const greeting = { role: 'assistant', text: 'Hello! I’m your Dela Costa HOA Stall Leasing assistant. I can check system records and help you find your way around. What would you like to check?' };

export default function SystemAssistant() {
    const { waitingCount, unreadCount } = useSupport();
    const [tab, setTab] = useState('assistant');
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([greeting]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const input = useRef(null);
    const head = useRef(null);
    const end = useRef(null);
    const pending = useRef(false);
    const controller = useRef(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => { if (open) input.current?.focus(); }, [open]);
    useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy, open]);
    const close = () => { setOpen(false); head.current?.focus(); };
    async function send(text = draft) {
        const question = text.trim();
        if (!question || pending.current) return;
        pending.current = true;
        setBusy(true); setError(''); setDraft('');
        setMessages(old => [...old.slice(-39), { role: 'user', text: question }]);
        controller.current = new AbortController();
        try {
            const { data } = await api.post('/assistant', { message: question }, { signal: controller.current.signal });
            setMessages(old => [...old, { role: 'assistant', text: data.data.reply }]);
        } catch (err) {
            if (err.code !== 'ERR_CANCELED') {
                setError('I couldn’t check the records. Please try again.');
                setDraft(question);
            }
        } finally {
            pending.current = false; setBusy(false);
            input.current?.focus();
        }
    }
    return <div className="hoa-assistant">
        {open && <section className="hoa-chat" role="dialog" aria-labelledby="hoa-chat-title" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
            <header className="hoa-chat-header">
                <span className="hoa-chat-avatar" aria-hidden="true"><FaCommentDots /></span>
                <div><h2 id="hoa-chat-title">Dela Costa HOA Chat</h2><small>System assistant & tenant support</small></div>
                <button className="hoa-chat-close" type="button" aria-label="Close assistant" onClick={close}><FaTimes /></button>
            </header>
            <div className="hoa-chat-tabs" aria-label="Chat views"><button type="button" className={tab === 'assistant' ? 'active' : ''} aria-pressed={tab === 'assistant'} onClick={() => setTab('assistant')}>Assistant</button><button type="button" className={tab === 'inbox' ? 'active' : ''} aria-pressed={tab === 'inbox'} onClick={() => setTab('inbox')}>Tenant inbox {waitingCount + unreadCount > 0 && <span>{waitingCount || unreadCount}</span>}</button></div>
            {tab === 'inbox' ? <SupportInbox compact /> : <>
            <div className="hoa-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Chat messages">
                {messages.map((message, index) => <div key={index} className={`hoa-message hoa-message-${message.role}`}><span className="visually-hidden">{message.role === 'user' ? 'You: ' : 'Assistant: '}</span>{message.text}</div>)}
                {busy && <div className="hoa-message hoa-message-assistant" role="status">Checking system records…</div>}
                <div ref={end} />
            </div>
            <div className="hoa-chat-suggestions" aria-label="Suggested questions">{suggestions.map(text => <button key={text} type="button" disabled={busy} onClick={() => send(text)}>{text}</button>)}</div>
            {error && <p className="hoa-chat-error" role="alert">{error}</p>}
            <form className="hoa-chat-compose" onSubmit={e => { e.preventDefault(); send(); }}>
                <label className="visually-hidden" htmlFor="hoa-chat-question">Ask about the stall leasing system</label>
                <input ref={input} id="hoa-chat-question" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Ask about stalls, dues, repairs…" autoComplete="off" />
                <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question"><FaPaperPlane /></button>
            </form>
            <div className="hoa-chat-footer">Read-only assistance · Only records you can access</div>
            </>}
        </section>}
        <button ref={head} className="hoa-chat-head" type="button" aria-label={open ? 'Close stall leasing assistant' : 'Open stall leasing assistant'} aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>{open ? <FaTimes /> : <FaCommentDots />}{waitingCount + unreadCount > 0 && <span className="hoa-chat-badge">{Math.min(waitingCount || unreadCount, 99)}</span>}</button>
    </div>;
}
