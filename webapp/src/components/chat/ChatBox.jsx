import React, { useState, useEffect, useRef } from 'react';
import { messageAPI, userAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
    FaComments,
    FaPaperPlane,
    FaUserCircle,
    FaCircle,
    FaSearch
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const ChatBox = () => {
    const { user, isAdmin, isStaff } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (activeContact) {
            loadMessages(activeContact.id || activeContact.contact_id);
            const interval = setInterval(() => {
                loadMessages(activeContact.id || activeContact.contact_id, true);
            }, 5000); // 5s chat poll
            return () => clearInterval(interval);
        }
    }, [activeContact]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        try {
            const res = await messageAPI.getConversations();
            if (res.data?.success) {
                const convs = res.data.data || [];
                setConversations(convs);

                // If no active contact and conversations exist, select first
                if (convs.length > 0 && !activeContact) {
                    setActiveContact(convs[0]);
                } else if (convs.length === 0 && !isAdmin) {
                    // Default fallback contact for tenants: Management
                    setActiveContact({
                        id: 'a0000000-0000-0000-0000-000000000001',
                        contact_name: 'Management Admin',
                        contact_role: 'admin'
                    });
                }
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    };

    const loadMessages = async (contactId, isSilent = false) => {
        if (!contactId) return;
        try {
            if (!isSilent) setLoading(true);
            const res = await messageAPI.getThread(contactId);
            if (res.data?.success) {
                setMessages(res.data.data || []);
            }
        } catch (error) {
            console.error('Error loading thread:', error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !activeContact) return;

        const targetId = activeContact.id || activeContact.contact_id;
        const msgText = inputText;
        setInputText('');

        try {
            const res = await messageAPI.send({
                receiver_id: targetId,
                message: msgText
            });

            if (res.data?.success) {
                setMessages((prev) => [...prev, res.data.data]);
                loadConversations();
            }
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="mb-4">
                <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                    <FaComments className="text-primary" /> Direct Communication & Support
                </h3>
                <p className="text-muted mb-0">Live messaging channel between Stall Tenants and Center Management.</p>
            </div>

            <div className="modern-card overflow-hidden" style={{ height: '620px' }}>
                <div className="row g-0 h-100">
                    {/* Contacts List Column */}
                    <div className="col-12 col-md-4 border-end bg-light d-flex flex-column h-100">
                        <div className="p-3 border-bottom bg-white">
                            <h6 className="fw-bold mb-0">Conversations</h6>
                        </div>

                        <div className="flex-grow-1 overflow-auto p-2">
                            {conversations.length === 0 ? (
                                <div className="p-3 text-center text-muted small">
                                    {isAdmin ? 'No active tenant chats yet.' : 'Chatting with Management Support'}
                                </div>
                            ) : (
                                conversations.map((c) => {
                                    const contactId = c.contact_id || c.id;
                                    const isSelected = (activeContact?.contact_id || activeContact?.id) === contactId;
                                    return (
                                        <div
                                            key={contactId}
                                            className={`p-3 rounded-3 mb-2 cursor-pointer transition ${
                                                isSelected ? 'bg-primary text-white shadow-sm' : 'bg-white text-dark hover-bg-secondary'
                                            }`}
                                            onClick={() => setActiveContact(c)}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <strong className="small text-truncate">{c.contact_name || 'User'}</strong>
                                                <span className={`badge ${isSelected ? 'bg-light text-primary' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                                                    {c.contact_role || 'User'}
                                                </span>
                                            </div>
                                            <div className={`small text-truncate ${isSelected ? 'text-white text-opacity-75' : 'text-muted'}`}>
                                                {c.last_message || 'Start conversation...'}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Message Thread Column */}
                    <div className="col-12 col-md-8 d-flex flex-column h-100 bg-white">
                        {/* Chat Header */}
                        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>
                                    <FaUserCircle />
                                </div>
                                <div>
                                    <h6 className="fw-bold mb-0 text-dark">
                                        {activeContact?.contact_name || (isAdmin ? 'Select a Tenant' : 'Center Management')}
                                    </h6>
                                    <small className="text-success d-flex align-items-center gap-1">
                                        <FaCircle size={8} /> Online Support Channel
                                    </small>
                                </div>
                            </div>
                        </div>

                        {/* Messages Feed */}
                        <div className="chat-container flex-grow-1">
                            {loading ? (
                                <div className="text-center py-5 text-muted">
                                    <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                                    Loading messages...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <FaComments size={32} className="text-muted opacity-50 mb-2" />
                                    <p className="small">No messages exchanged yet. Send a message to start.</p>
                                </div>
                            ) : (
                                messages.map((m) => {
                                    const isMe = m.sender_id === user?.id;
                                    return (
                                        <div
                                            key={m.id}
                                            className={`chat-bubble ${isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}`}
                                        >
                                            <div className="small fw-semibold mb-1 opacity-75">
                                                {isMe ? 'You' : m.sender_name || 'Admin'}
                                            </div>
                                            <div>{m.message}</div>
                                            <div className="text-end" style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 border-top bg-light d-flex gap-2">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Type a message or inquiry..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2 px-4" disabled={!inputText.trim()}>
                                <FaPaperPlane /> Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatBox;
