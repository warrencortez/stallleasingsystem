import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Animated, AppState, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

const suggestions = ['Which stalls are available?', 'Check rent due dates', 'Show maintenance reports', 'Check applications'];
const greeting = 'Hello! I’m your Dela Costa HOA Stall Leasing assistant. Ask about stalls, dues, or maintenance. If you need a person, tap “Talk to an admin”.';
function TypingIndicator() {
    const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
    useEffect(() => {
        let active = true;
        const animations = dots.map((dot, i) => Animated.loop(Animated.sequence([
            Animated.delay(i * 140), Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }), Animated.delay(250),
        ])));
        AccessibilityInfo.isReduceMotionEnabled().then(reduce => { if (active && !reduce) animations.forEach(a => a.start()); });
        return () => { active = false; animations.forEach(a => a.stop()); };
    }, [dots]);
    return <View style={styles.typing} accessibilityLiveRegion="polite" accessibilityLabel="Assistant is typing">
        <View style={styles.dots}>{dots.map((opacity, i) => <Animated.View key={i} style={[styles.dot, { opacity }]} />)}</View>
        <Text style={styles.typingText}>Assistant is typing…</Text>
    </View>;
}
function ChatHead() {
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [thread, setThread] = useState(null);
    const [optimistic, setOptimistic] = useState(null);
    const [busy, setBusy] = useState('');
    const [typing, setTyping] = useState(false);
    const [error, setError] = useState('');
    const [loadError, setLoadError] = useState('');
    const scroll = useRef(null);
    const pending = useRef(false);
    const alive = useRef(false);
    const request = useRef(null);
    const retry = useRef(null);
    const delay = useRef(null);
    const applyThread = next => setThread(old => old && old.version > next.version ? old : next);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; request.current?.abort(); if (delay.current) { clearTimeout(delay.current.timer); delay.current.resolve(); } };
    }, []);
    useEffect(() => {
        let active = true; let loading = false;
        const controller = new AbortController();
        async function load() {
            if (loading || pending.current || AppState.currentState !== 'active') return;
            loading = true;
            try {
                const { data } = await api.get(`/support/thread${open ? '?read=true' : ''}`, { signal: controller.signal });
                if (active && !pending.current) { applyThread(data.data); setLoadError(''); }
            } catch (err) { if (active && err.code !== 'ERR_CANCELED') setLoadError('Could not refresh chat. Reconnecting…'); }
            finally { loading = false; }
        }
        load(); const poll = setInterval(load, 3000);
        const listener = AppState.addEventListener('change', state => { if (state === 'active') load(); });
        return () => { active = false; clearInterval(poll); controller.abort(); listener.remove(); };
    }, [open]);
    async function send(text = draft) {
        const question = text.trim();
        if (!question || pending.current || !thread) return;
        pending.current = true; setBusy('send'); setDraft(''); setError('');
        const id = retry.current?.text === question ? retry.current.id : `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        retry.current = { text: question, id };
        setOptimistic({ id, client_id: id, sender_role: 'tenant', sender_name: 'You', text: question });
        const botMode = thread.status === 'bot'; setTyping(botMode);
        request.current = new AbortController();
        const minimumDelay = botMode ? new Promise(resolve => { delay.current = { resolve, timer: setTimeout(resolve, 1200 + Math.min(question.length * 15, 1000)) }; }) : Promise.resolve();
        try {
            const [{ data }] = await Promise.all([api.post('/support/messages', { message: question, client_id: id }, { signal: request.current.signal }), minimumDelay]);
            if (alive.current) { applyThread(data.data); retry.current = null; }
        } catch (err) {
            if (alive.current && err.code !== 'ERR_CANCELED') { setError(err.response?.data?.message || 'Message not confirmed. Please retry.'); setDraft(question); }
        } finally {
            if (delay.current) { clearTimeout(delay.current.timer); delay.current.resolve(); delay.current = null; }
            pending.current = false;
            if (alive.current) { setBusy(''); setTyping(false); setOptimistic(null); }
        }
    }
    async function handoff(endpoint) {
        if (pending.current) return;
        pending.current = true; setBusy(endpoint); setError(''); request.current = new AbortController();
        try {
            const { data } = await api.post(`/support/${endpoint}`, {}, { signal: request.current.signal });
            if (alive.current) applyThread(data.data);
        } catch (err) { if (alive.current && err.code !== 'ERR_CANCELED') setError(err.response?.data?.message || 'Could not update your request. Please retry.'); }
        finally { pending.current = false; if (alive.current) setBusy(''); }
    }
    const messages = thread?.messages || [];
    const visible = optimistic && !messages.some(m => m.client_id === optimistic.client_id) ? [...messages, optimistic] : messages;
    const mode = thread?.status || 'bot';
    const subtitle = mode === 'live' ? `Live with ${thread.assigned_name}` : mode === 'waiting' ? 'Waiting for an administrator' : 'Dela Costa HOA · System assistant';
    return <>
        <TouchableOpacity style={[styles.head, { bottom: 78 + insets.bottom }]} accessibilityRole="button" accessibilityLabel={`Open stall leasing chat${thread?.unread ? `, ${thread.unread} unread messages` : ''}`} onPress={() => setOpen(true)}>
            <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
            {!!thread?.unread && <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(thread.unread, 99)}</Text></View>}
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <TouchableOpacity style={StyleSheet.absoluteFill} accessibilityLabel="Close chat" accessibilityRole="button" onPress={() => setOpen(false)} />
                <View style={[styles.panel, { marginTop: insets.top + 16, marginBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
                    <View style={styles.header}>
                        <Ionicons name={mode === 'live' ? 'headset' : 'chatbubble-ellipses'} size={26} color="#fff" />
                        <View style={{ flex: 1 }}><Text style={styles.title}>{mode === 'live' ? 'Live admin support' : 'Stall Leasing Assistant'}</Text><Text style={styles.subtitle} accessibilityLiveRegion="polite">{subtitle}</Text></View>
                        <TouchableOpacity style={styles.close} accessibilityRole="button" accessibilityLabel="Close chat" onPress={() => setOpen(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                    </View>
                    <View style={styles.handoff}>
                        <Text style={styles.handoffHint}>{mode === 'bot' ? 'Need help from a person?' : mode === 'waiting' ? 'You can leave a message while you wait.' : 'The assistant is paused during your live chat.'}</Text>
                        <TouchableOpacity style={styles.agentButton} disabled={!!busy || !thread} accessibilityRole="button" onPress={() => handoff(mode === 'bot' ? 'request-agent' : 'resume')}>
                            <Ionicons name={mode === 'bot' ? 'headset-outline' : 'chatbubble-outline'} size={14} color="#3730a3" /><Text style={styles.agentButtonText}>{busy === 'request-agent' || busy === 'resume' ? 'Please wait…' : mode === 'bot' ? 'Talk to an admin' : mode === 'waiting' ? 'Cancel request' : 'Back to assistant'}</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView ref={scroll} style={styles.messages} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
                        <View style={[styles.bubble, styles.assistantBubble]}><Text style={styles.message}>{greeting}</Text></View>
                        {!thread && <View style={styles.loading}><ActivityIndicator color="#3158d5" /><Text>Loading your conversation…</Text></View>}
                        {visible.map(m => <View key={m.id} style={[styles.bubble, m.sender_role === 'tenant' ? styles.userBubble : styles.assistantBubble, m.sender_role === 'system' && styles.systemBubble]}>
                            {m.sender_role !== 'system' && <Text style={[styles.sender, m.sender_role === 'tenant' && { color: '#e0e7ff' }]}>{m.sender_role === 'tenant' ? 'You' : m.sender_role === 'assistant' ? 'Assistant' : `${m.sender_name} · Admin`}</Text>}
                            <Text selectable style={[styles.message, m.sender_role === 'tenant' && { color: '#fff' }, m.sender_role === 'system' && styles.systemText]}>{m.text}</Text>
                            {m.created_at && m.sender_role !== 'system' && <Text style={[styles.time, m.sender_role === 'tenant' && { color: '#e0e7ff' }]}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
                        </View>)}
                        {typing && <TypingIndicator />}
                        {busy === 'send' && !typing && <Text style={styles.typingText}>Sending message…</Text>}
                    </ScrollView>
                    {mode === 'bot' && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">{suggestions.map(text => <TouchableOpacity key={text} style={styles.suggestion} disabled={!!busy || !thread} accessibilityRole="button" onPress={() => send(text)}><Text style={styles.suggestionText}>{text}</Text></TouchableOpacity>)}</ScrollView></View>}
                    {!!(error || loadError) && <Text style={styles.error} accessibilityRole="alert">{error || loadError}</Text>}
                    <View style={styles.compose}>
                        <TextInput editable={!busy} style={styles.input} value={draft} onChangeText={setDraft} maxLength={1000} placeholder={mode === 'bot' ? 'Ask about stalls, dues, repairs…' : 'Message the administrator…'} placeholderTextColor="#64748b" accessibilityLabel="Chat message" returnKeyType="send" onSubmitEditing={() => send()} />
                        <TouchableOpacity style={[styles.send, (busy || !thread || !draft.trim()) && { opacity: 0.45 }]} disabled={!!busy || !thread || !draft.trim()} accessibilityRole="button" accessibilityLabel="Send message" onPress={() => send()}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
                    </View>
                    <Text style={styles.footer}>Conversation history is shared with your administrators</Text>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    </>;
}
export default function SystemAssistant() {
    const { isAuthenticated, user } = useAuth();
    return isAuthenticated && user?.role === 'tenant' ? <ChatHead key={user.id} /> : null;
}
const styles = StyleSheet.create({
    head: { position: 'absolute', right: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: '#3158d5', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#18294e', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, zIndex: 100 },
    badge: { position: 'absolute', right: -3, top: -3, borderRadius: 14, minWidth: 24, padding: 4, backgroundColor: '#dc2626', borderWidth: 2, borderColor: '#fff', alignItems: 'center' }, badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
    panel: { flex: 1, maxHeight: 680, marginHorizontal: 12, borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff' },
    header: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#2839a7', padding: 14 },
    title: { color: '#fff', fontSize: 16, fontWeight: '700' }, subtitle: { color: '#e0e7ff', fontSize: 10, marginTop: 4 }, close: { padding: 8 },
    handoff: { padding: 10, gap: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' }, handoffHint: { flex: 1, color: '#64748b', fontSize: 11, lineHeight: 16 },
    agentButton: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#eef2ff', flexDirection: 'row', alignItems: 'center', gap: 5 }, agentButtonText: { color: '#3730a3', fontWeight: '600', fontSize: 11 },
    messages: { flex: 1, backgroundColor: '#f5f7fc' }, bubble: { padding: 12, borderRadius: 16, marginBottom: 12, maxWidth: '94%' },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5eaf3', borderBottomLeftRadius: 4 },
    userBubble: { alignSelf: 'flex-end', backgroundColor: '#3158d5', borderBottomRightRadius: 4 }, message: { color: '#24324b', fontSize: 14, lineHeight: 22 },
    systemBubble: { backgroundColor: 'transparent', borderWidth: 0, alignSelf: 'center', padding: 6 }, systemText: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 18 },
    sender: { color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 4 }, time: { fontSize: 9, color: '#64748b', textAlign: 'right', marginTop: 5 },
    loading: { flexDirection: 'row', gap: 8, padding: 8 }, typing: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 18, alignSelf: 'flex-start', marginBottom: 10 },
    dots: { flexDirection: 'row', gap: 4 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366f1' }, typingText: { color: '#64748b', fontSize: 12 },
    suggestions: { padding: 10, gap: 7 }, suggestion: { borderRadius: 20, borderWidth: 1, borderColor: '#cbd7f3', backgroundColor: '#f8faff', padding: 10 }, suggestionText: { color: '#294aab', fontSize: 12 },
    compose: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center', borderTopWidth: 1, borderColor: '#edf0f7' }, input: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
    send: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#3158d5', alignItems: 'center', justifyContent: 'center' }, footer: { fontSize: 10, textAlign: 'center', color: '#64748b', paddingBottom: 10 }, error: { color: '#a52424', paddingHorizontal: 14, fontSize: 12 },
});
