import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { googleAccessToken } from '../../config/googleAuth';
export default function GoogleButton({ navigation, disabled }) {
    const { loginWithGoogle } = useAuth();
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(null);
    const [password, setPassword] = useState('');
    async function signIn() {
        setBusy(true);
        try {
            const token = pending || await googleAccessToken();
            if (!token) return;
            const result = await loginWithGoogle(token, pending ? password : undefined);
            if (result.profileRequired) { setPending(null); setPassword(''); navigation.navigate('GoogleProfile'); }
            else if (result.code === 'GOOGLE_LINK_REQUIRED') setPending(token);
            else if (!result.success) Alert.alert('Google Sign-in', result.message);
            else { setPending(null); setPassword(''); }
        } catch (error) { Alert.alert('Google Sign-in', error.message); }
        finally { setBusy(false); }
    }
    return <View style={{ marginTop: 16 }}>
        {pending && <View>
            <Text>This email already has an account. Enter its password to connect Google.</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
                placeholder="Existing account password" style={{ borderWidth: 1, borderColor: '#cbd5e1', padding: 12, borderRadius: 12, marginVertical: 10 }} />
            <TouchableOpacity onPress={() => { setPending(null); setPassword(''); }}><Text style={{ color: '#4f46e5', marginBottom: 12 }}>Cancel connecting Google</Text></TouchableOpacity>
        </View>}
        <TouchableOpacity accessibilityRole="button" onPress={signIn} disabled={disabled || busy || (!!pending && !password)}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' }}>
            {busy ? <ActivityIndicator color="#4f46e5" /> : <Ionicons name="logo-google" size={22} color="#4285f4" />}
            <Text style={{ fontWeight: '700', color: '#334155', fontSize: 16 }}>{pending ? 'Connect Google and Sign In' : 'Continue with Google'}</Text>
        </TouchableOpacity>
    </View>;
}
