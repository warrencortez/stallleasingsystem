import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../config/api';
import VerifyEmailScreen from './VerifyEmailScreen';
import styles from './onboardingStyles';

const passwordPolicy = /^[a-zA-Z0-9]{6,72}$/;

export default function PasswordRecoveryScreen({ navigation }) {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    const grant = useRef(null);
    const login = () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    const clearPasswords = () => { setPassword(''); setConfirmation(''); setVisible(false); };
    const restart = () => {
        grant.current = null;
        clearPasswords();
        setChallenge(null);
        setError('');
        setStep('email');
    };
    const allowed = passwordPolicy.test(password);
    const matches = !!confirmation && password === confirmation;
    const submit = async () => {
        if (pending.current) return;
        const address = email.trim().toLowerCase();
        if (step === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
            setError('Enter a valid email address.');
            return;
        }
        if (step === 'password' && (!allowed || !matches || !grant.current)) return;
        pending.current = true;
        setBusy(true);
        setError('');
        try {
            if (step === 'email') {
                const { data } = await api.post('/auth/forgot-password', { email: address });
                setChallenge({ ...data.data, email: address });
                setStep('code');
            } else {
                await api.post('/auth/reset-password', { ...grant.current, password, confirmPassword: confirmation });
                restart();
                setEmail('');
                setStep('success');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Could not reach MR99. Check your connection and try again.');
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    if (step === 'code') return <VerifyEmailScreen route={{ params: { challenge } }} onBack={restart}
        onRecoveryVerified={(challengeId, resetToken) => { grant.current = { challengeId, resetToken }; setChallenge(null); setStep('password'); }} />;

    const heading = { email: 'Reset Your Password', password: 'Create New Password', success: 'Password Reset Successful' }[step];
    const disabled = busy || (step === 'password' && (!allowed || !matches));
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            {step !== 'success' && <TouchableOpacity accessibilityLabel="Back" disabled={busy} style={styles.back}
                onPress={step === 'password' ? restart : () => navigation.goBack()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>}
            {step === 'success' && <Ionicons name="checkmark-circle" size={56} color="#15803d" />}
            <Text style={styles.title}>{heading}</Text>
            <View style={styles.card}>
                {step === 'email' && <>
                    <Text style={styles.hint}>Enter the email address registered to your MR99 account.</Text>
                    <TextInput accessibilityLabel="Registered email address" style={styles.input} value={email} onChangeText={setEmail}
                        autoFocus autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor="#64748b" editable={!busy} />
                </>}
                {step === 'password' && <>
                    <Text style={styles.label}>New password</Text>
                    <TextInput accessibilityLabel="New password" style={styles.input} value={password} onChangeText={setPassword}
                        secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" maxLength={72} editable={!busy} />
                    <Text style={styles.label}>Confirm new password</Text>
                    <TextInput accessibilityLabel="Confirm new password" style={styles.input} value={confirmation} onChangeText={setConfirmation}
                        secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" maxLength={72} editable={!busy} />
                    <TouchableOpacity onPress={() => setVisible(!visible)}><Text style={styles.link}>{visible ? 'Hide passwords' : 'Show passwords'}</Text></TouchableOpacity>
                    <Text style={styles.hint}>{allowed ? 'Password meets the requirements.' : 'Use 6 to 72 letters or digits. A longer password is harder to guess.'}</Text>
                    {!!confirmation && <Text style={matches ? styles.hint : styles.error}>{matches ? 'Passwords match.' : 'Passwords do not match.'}</Text>}
                </>}
                {step === 'success' && <Text style={styles.hint}>Sign in using your new password.</Text>}
                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                <TouchableOpacity style={[styles.button, disabled && { opacity: 0.5 }]} disabled={disabled} onPress={step === 'success' ? login : submit}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>
                        {{ email: 'Send Verification Code', password: 'Reset Password', success: 'Back to Login' }[step]}
                    </Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    </KeyboardAvoidingView>;
}
