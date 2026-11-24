import React, { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import styles from './onboardingStyles';
const deadlines = challenge => {
    const now = Date.now(), server = new Date(challenge.serverNow).getTime();
    return { expires: now + Math.max(0,new Date(challenge.expiresAt).getTime()-server), resend: now + Math.max(0,new Date(challenge.resendAt).getTime()-server) };
};
export default function VerifyEmailScreen({ route, navigation, onRecoveryVerified, onBack }) {
    const recovery = Boolean(onRecoveryVerified);
    const [challenge, setChallenge] = useState(route.params.challenge);
    const [until, setUntil] = useState(() => deadlines(route.params.challenge));
    const [now, setNow] = useState(Date.now());
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const submitting = useRef(false);
    useEffect(() => {
        const refresh = () => setNow(Date.now());
        const timer = setInterval(refresh, 500);
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
        return () => { clearInterval(timer); subscription.remove(); };
    }, []);
    const expires = Math.max(0,Math.ceil((until.expires-now)/1000));
    const cooldown = Math.max(0,Math.ceil((until.resend-now)/1000));
    async function submit(resend = false) {
        if (submitting.current || (resend ? Date.now() < until.resend : !/^\d{6}$/.test(code) || Date.now() >= until.expires)) return;
        submitting.current = true;
        setBusy(true); setError(''); setNotice('');
        try {
            const endpoint = recovery ? '/auth/forgot-password/' : '/auth/register/';
            const response = await api.post(endpoint + (resend ? 'resend' : 'verify'), { challengeId: challenge.challengeId, ...(resend ? {} : { code }) });
            if (resend) {
                setChallenge({ ...response.data.data, email: challenge.email });
                setUntil(deadlines(response.data.data));
                setNow(Date.now());
                setCode('');
                setNotice(recovery ? 'If this email is eligible, use the code from the most recent email.' : 'A new verification code was sent. Use the most recent email.');
            } else if (recovery) {
                setCode('');
                onRecoveryVerified(challenge.challengeId, response.data.data.resetToken);
            } else {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                Alert.alert('Email Successfully Verified', 'Your tenant account is ready. Sign in with your email or mobile number and password.');
            }
        } catch (err) {
            setError(err.response?.data?.message || (err.response ? 'Email verification is temporarily unavailable.' : 'Unable to connect. Check your connection and try again.'));
            const retry = Number(err.response?.data?.retryAfter ?? err.response?.data?.retry_after_seconds ?? err.response?.headers?.['retry-after']);
            if (resend && Number.isFinite(retry) && retry > 0) {
                setUntil(value => ({ ...value, resend: Date.now()+retry*1000 }));
                setNow(Date.now());
            }
        } finally { submitting.current = false; setBusy(false); }
    }
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity accessibilityLabel={recovery ? 'Back to email entry' : 'Back to registration'} disabled={busy} style={styles.back} onPress={onBack || (() => navigation.goBack())}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>{recovery ? 'Verify Reset Code' : 'Verify Your Email'}</Text>
        <Text style={styles.hint}>{recovery ? `If ${challenge.email} is eligible for recovery, you will receive a six-digit code. Check your spam folder.` : `Enter the six-digit code sent to ${challenge.email}. Check your spam folder too.`}</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput accessibilityLabel="Six-digit verification code" style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 8 }]}
                autoFocus keyboardType="number-pad" value={code} onChangeText={value => setCode(value.replace(/\D/g,'').slice(0, 6))}
                autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" placeholderTextColor="#64748b" editable={!busy} />
            <TouchableOpacity disabled={busy || cooldown>0} onPress={() => submit(true)}>
                <Text style={[styles.link, cooldown>0 && { color: '#64748b' }]}>{cooldown>0 ? `Resend available in ${cooldown}s` : 'Resend verification code'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{expires>0 ? `Code expires in ${expires}s.` : 'Code expired. Request a new code.'}</Text>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
            <TouchableOpacity style={[styles.button, (busy || code.length!==6 || !expires) && { opacity: 0.5 }]} disabled={busy || code.length!==6 || !expires} onPress={() => submit()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{recovery ? 'Verify Code' : 'Verify Email'}</Text>}
            </TouchableOpacity>
        </View>
    </ScrollView>
    </KeyboardAvoidingView>;
}
