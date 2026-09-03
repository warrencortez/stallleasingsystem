import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { setCustomServerIP } from '../../config/api';
import { theme } from '../../styles/theme';

const LoginScreen = ({ navigation }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [serverIp, setServerIp] = useState('');
    const [showIpConfig, setShowIpConfig] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        const rawInput = email.trim();
        if (!rawInput || !password) {
            Alert.alert('Missing Credentials', 'Please enter your mobile number or email and password.');
            return;
        }

        try {
            setLoading(true);
            // If the user entered purely digits (mobile number), format to standard
            let identifier = rawInput;
            const digitsOnly = rawInput.replace(/[^0-9]/g, '');
            if (digitsOnly.length >= 10 && !rawInput.includes('@')) {
                let clean = digitsOnly;
                if (clean.startsWith('63')) clean = clean.slice(2);
                while (clean.startsWith('0')) clean = clean.slice(1);
                identifier = `+63${clean}`;
            }

            const res = await login(identifier, password);
            if (!res.success) {
                // If it failed, try with raw identifier just in case
                if (identifier !== rawInput) {
                    const fallbackRes = await login(rawInput, password);
                    if (fallbackRes.success) return;
                }
                Alert.alert('Authentication Failed', res.message || 'Invalid mobile number/email or password.');
            }
        } catch (error) {
            Alert.alert('Connection Error', 'Unable to reach backend server. Please check your network connection or server IP.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveServerIP = async () => {
        if (serverIp.trim()) {
            await setCustomServerIP(serverIp.trim());
            Alert.alert('Server Host Updated', `Backend API pointed to: http://${serverIp.trim()}:5000/api/v1`);
            setShowIpConfig(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="storefront" size={38} color={theme.colors.white} />
                    </View>
                    <Text style={styles.title}>LeaseHub Mobile</Text>
                    <Text style={styles.subtitle}>Tenant Self-Service & Rent Portal</Text>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.label}>Mobile Phone Number or Email</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 09171234567 or email"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In to Tenant Portal</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.ipToggle}
                        onPress={() => setShowIpConfig(!showIpConfig)}
                    >
                        <Ionicons name="settings-outline" size={14} color={theme.colors.textMuted} />
                        <Text style={styles.ipToggleText}>Server Host Network Config</Text>
                    </TouchableOpacity>

                    {showIpConfig && (
                        <View style={styles.ipBox}>
                            <Text style={styles.ipHint}>Enter host server IP address (e.g. 192.168.100.137):</Text>
                            <View style={styles.ipInputRow}>
                                <TextInput
                                    style={styles.ipInput}
                                    placeholder="192.168.x.x"
                                    placeholderTextColor="#94a3b8"
                                    value={serverIp}
                                    onChangeText={setServerIp}
                                />
                                <TouchableOpacity style={styles.ipSaveBtn} onPress={handleSaveServerIP}>
                                    <Text style={styles.ipSaveBtnText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>New commercial tenant?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.registerLink}>Register Tenant Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.lg
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.md,
        ...theme.shadows.md
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 4
    },
    formCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginBottom: 6
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.md
    },
    inputIcon: {
        marginRight: theme.spacing.sm
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.colors.text
    },
    loginButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        ...theme.shadows.md
    },
    loginButtonText: {
        color: theme.colors.white,
        fontSize: 16,
        fontWeight: 'bold'
    },
    ipToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: theme.spacing.md,
        paddingVertical: 4
    },
    ipToggleText: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    ipBox: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    ipHint: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginBottom: 6
    },
    ipInputRow: {
        flexDirection: 'row',
        gap: 8
    },
    ipInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 13
    },
    ipSaveBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 6,
        paddingHorizontal: 12,
        justifyContent: 'center'
    },
    ipSaveBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold'
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: theme.spacing.xl
    },
    footerText: {
        fontSize: 14,
        color: theme.colors.textMuted
    },
    registerLink: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.primary
    }
});

export default LoginScreen;
