import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import styles from './onboardingStyles';
export default function GoogleProfileScreen({ navigation }) {
    const { googleSetup, clearGoogleSetup, completeGoogleProfile } = useAuth();
    const [name, setName] = useState(googleSetup?.name || '');
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function save() {
        if (name.trim().length<2 || !/^9\d{9}$/.test(phone)) { setError('Enter your full name and a 10-digit mobile number starting with 9.'); return; }
        setBusy(true); setError('');
        try { const result = await completeGoogleProfile({ name: name.trim(), phone: '+63'+phone }); if (!result.success) setError(result.message); }
        finally { setBusy(false); }
    }
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity accessibilityLabel="Cancel Google registration" style={styles.back} onPress={() => { clearGoogleSetup(); navigation.navigate('Login'); }}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Complete Your Contact Details</Text>
        <Text style={styles.hint}>Your Google email is verified. Add your name and mobile number to finish creating your tenant account.</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Google Email ? Verified</Text>
            <TextInput accessibilityLabel="Verified Google email, cannot be edited" style={[styles.input, { color: '#64748b' }]} value={googleSetup?.email || ''} editable={false} />
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={100} autoComplete="name" placeholder="Maria Santos" />
            <Text style={styles.label}>Mobile Number (+63)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={value => setPhone(value.replace(/\D/g,'').replace(/^63/,'').replace(/^0/, '').slice(0,10))} keyboardType="phone-pad" placeholder="9XXXXXXXXX" />
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <TouchableOpacity style={[styles.button, (busy || !googleSetup) && { opacity: 0.5 }]} disabled={busy || !googleSetup} onPress={save}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Registration</Text>}
            </TouchableOpacity>
        </View>
    </ScrollView>
    </KeyboardAvoidingView>;
}
