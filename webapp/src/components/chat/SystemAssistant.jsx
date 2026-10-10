import { useRef, useState } from 'react';
import { FaCommentDots, FaTimes } from 'react-icons/fa';
import './SystemAssistant.css';
import SupportInbox from './SupportInbox';
import { useSupport } from '../../context/supportContext';

export default function TenantChat() {
    const { waitingCount, unreadCount } = useSupport();
    const [open, setOpen] = useState(false);
    const head = useRef(null);
    const close = () => { setOpen(false); head.current?.focus(); };
    return <div className="hoa-assistant">
        {open && <section className="hoa-chat" role="dialog" aria-labelledby="hoa-chat-title" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
            <header className="hoa-chat-header">
                <span className="hoa-chat-avatar" aria-hidden="true"><FaCommentDots /></span>
                <div><h2 id="hoa-chat-title">Tenant messages</h2><small>Talk with your tenants</small></div>
                <button className="hoa-chat-close" type="button" aria-label="Close tenant messages" onClick={close}><FaTimes /></button>
            </header>
            <SupportInbox compact />
        </section>}
        <button ref={head} className="hoa-chat-head" type="button" aria-label={open ? 'Close tenant messages' : 'Open tenant messages'} aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>{open ? <FaTimes /> : <FaCommentDots />}{waitingCount + unreadCount > 0 && <span className="hoa-chat-badge">{Math.min(waitingCount || unreadCount, 99)}</span>}</button>
    </div>;
}
