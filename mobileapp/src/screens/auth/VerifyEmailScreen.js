import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import styles from './onboardingStyles';
const deadlines = challenge => {
    const now = Date.now(), server = new Date(challenge.serverNow).getTime();
    return { expires: now + Math.max(0,new Date(challenge.expiresAt).getTime()-server), resend: now + Math.max(0,new Date(challenge.resendAt).getTime()-server) };
};
export default function VerifyEmailScreen({ route, navigation }) {
    const [challenge, setChallenge] = useState(route.params.challenge);
    const [until, setUntil] = useState(() => deadlines(route.params.challenge));
    const [now, setNow] = useState(Date.now());
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
    const expires = Math.max(0,Math.ceil((until.expires-now)/1000));
    const cooldown = Math.max(0,Math.ceil((until.resend-now)/1000));
    async function submit(resend = false) {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const response = await api.post('/auth/register/' + (resend ? 'resend' : 'verify'), { challengeId: challenge.challengeId, ...(resend ? {} : { code }) });
            if (resend) { setChallenge(response.data.data); setUntil(deadlines(response.data.data)); setNow(Date.now()); setCode(''); }
            else { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); Alert.alert('Email Verified', 'Your tenant account is ready. Sign in with your email or mobile number and password.'); }
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to connect. Please try again.');
            const retry = err.response?.data?.retryAfter;
            if (retry) setUntil(value => ({ ...value, resend: Date.now()+retry*1000 }));
        } finally { setBusy(false); }
    }
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity accessibilityLabel="Back to registration" style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.hint}>Enter the six-digit code sent to {challenge.email}. Check your spam folder too.</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput accessibilityLabel="Six-digit verification code" style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 8 }]}
                keyboardType="number-pad" maxLength={6} value={code} onChangeText={value => setCode(value.replace(/\D/g,''))}
                autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" editable={!busy} />
            <TouchableOpacity disabled={busy || cooldown>0} onPress={() => submit(true)}>
                <Text style={[styles.link, cooldown>0 && { color: '#64748b' }]}>{cooldown>0 ? `Send a code again in ${cooldown}s` : 'Send a code again'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{expires>0 ? `Code expires in ${expires}s.` : 'Code expired. Request a new code.'}</Text>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <TouchableOpacity style={[styles.button, (busy || code.length!==6 || !expires) && { opacity: 0.5 }]} disabled={busy || code.length!==6 || !expires} onPress={() => submit()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Email</Text>}
            </TouchableOpacity>
        </View>
    </ScrollView>
    </KeyboardAvoidingView>;
}
