import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { SupportContext } from './supportContext';

export default function SupportProvider({ children }) {
    const [conversations, setConversations] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const inFlight = useRef(false);
    const mounted = useRef(false);
    const seenRequests = useRef(new Set());
    const navigate = useNavigate();
    const refresh = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            const { data } = await api.get('/support/inbox');
            if (!mounted.current) return;
            setConversations(data.data); setError('');
            for (const item of data.data) {
                const key = `${item.tenant_id}:${item.requested_at}`;
                if (item.status === 'waiting' && !seenRequests.current.has(key)) {
                    seenRequests.current.add(key);
                    toast(t => <button className="support-toast" onClick={() => { toast.dismiss(t.id); navigate(`/conversations?tenant=${encodeURIComponent(item.tenant_id)}`); }}><strong>{item.tenant_name} requested a live agent</strong><span>Open conversation →</span></button>, { id: `support-${key}`, duration: 8000, icon: '💬' });
                }
            }
        } catch {
            if (mounted.current) setError('The tenant inbox could not be refreshed. Please retry.');
        } finally { inFlight.current = false; if (mounted.current) setLoading(false); }
    }, [navigate]);
    useEffect(() => {
        mounted.current = true;
        const initial = setTimeout(refresh, 0);
        const poll = setInterval(() => { if (!document.hidden) refresh(); }, 4000);
        const wake = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', wake);
        return () => { mounted.current = false; clearTimeout(initial); clearInterval(poll); document.removeEventListener('visibilitychange', wake); };
    }, [refresh]);
    const waitingCount = conversations.filter(c => c.status === 'waiting').length;
    const unreadCount = conversations.reduce((n, c) => n + c.unread, 0);
    return <SupportContext.Provider value={{ conversations, waitingCount, unreadCount, loading, error, refresh }}>{children}</SupportContext.Provider>;
}
