import React, { useRef, useState } from 'react';
import {
    View,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { setCustomServerIP } from '../../config/api';
import { theme } from '../../styles/theme';
import { googleAccessToken } from '../../config/googleAuth';

const LoginScreen = ({ navigation }) => {
    const { login, loginWithGoogle } = useAuth();
    const [pendingGoogleToken, setPendingGoogleToken] = useState(null);
    const [linkPassword, setLinkPassword] = useState('');
    const [connectExisting, setConnectExisting] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [serverIp, setServerIp] = useState('');
    const [showIpConfig, setShowIpConfig] = useState(false);
    const [loading, setLoading] = useState(false);
    const googleInProgress = useRef(false);

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

    const handleGoogle = async () => {
        if (loading || googleInProgress.current) return;
        if (connectExisting && (!email.trim() || !password)) {
            Alert.alert('Existing Account', 'Enter your mobile number or email and password above, then connect Google.');
            return;
        }
        googleInProgress.current = true;
        setLoading(true);
        try {
            const token = pendingGoogleToken || await googleAccessToken();
            if (!token) return;
            let identifier = email.trim();
            if (!identifier.includes('@')) {
                let digits = identifier.replace(/[^0-9]/g, '');
                if (digits.startsWith('63')) digits = digits.slice(2);
                identifier = `+63${digits.replace(/^0+/, '')}`;
            }
            const result = await loginWithGoogle(token, connectExisting ? password : pendingGoogleToken ? linkPassword : undefined,
                connectExisting ? identifier : undefined);
            if (result.profileRequired) { setPendingGoogleToken(null); setLinkPassword(''); navigation.navigate('GoogleProfile'); }
            else if (result.code === 'GOOGLE_LINK_REQUIRED') setPendingGoogleToken(token);
            else if (!result.success) {
                if (result.code === 'GOOGLE_TOKEN_INVALID') {
                    setPendingGoogleToken(null);
                    setLinkPassword('');
                }
                Alert.alert('Google Sign-in', result.message);
            }
            else { setPendingGoogleToken(null); setLinkPassword(''); }
        } catch (error) { Alert.alert('Google Sign-in', error.message || 'Unable to sign in. Please try again.'); }
        finally { googleInProgress.current = false; setLoading(false); }
    };

    const handleSaveServerIP = async () => {
        if (serverIp.trim()) {
            await setCustomServerIP(serverIp.trim());
            Alert.alert('Server Host Updated', `Backend API pointed to: http://${serverIp.trim()}:5000/api/v1`);
            setShowIpConfig(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Image source={require('../../../assets/mr99-logo.png')} style={styles.logo}
                                resizeMode="contain" accessible accessibilityLabel="MR99 logo" />
                            <Text style={styles.title}>MR99 Commercial Stall Leasing</Text>
                            <Text style={styles.subtitle}>Tenant Self-Service & Rent Portal</Text>
                        </View>

                        <View style={styles.formCard}>
                            <Text style={[styles.label, styles.firstLabel]}>Mobile Phone Number or Email</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 09171234567 or email"
                                    placeholderTextColor={theme.colors.textMuted}
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View style={styles.passwordRow}>
                                <Text style={styles.label}>Password</Text>
                                <TouchableOpacity disabled={loading} accessibilityRole="button" style={styles.forgotButton} onPress={() => navigation.navigate('PasswordRecovery')}>
                                    <Text style={styles.forgotLink}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor={theme.colors.textMuted}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={12} onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.disabledButton]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Sign In to Tenant Portal</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>Or continue with</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {pendingGoogleToken && (
                                <View style={styles.linkPanel}>
                                    <Text style={styles.label}>Connect your existing account</Text>
                                    <Text style={styles.linkHint}>Enter your current account password to connect Google.</Text>
                                    <View style={styles.inputContainer}>
                                        <TextInput style={styles.input} value={linkPassword} onChangeText={setLinkPassword}
                                            placeholder="Existing account password" placeholderTextColor={theme.colors.textMuted} secureTextEntry autoCapitalize="none" />
                                    </View>
                                    <TouchableOpacity disabled={loading} style={styles.cancelLinkButton} onPress={() => { setPendingGoogleToken(null); setLinkPassword(''); }}>
                                        <Text style={styles.registerLink}>Cancel connecting Google</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity style={[styles.googleButton, (loading || (!!pendingGoogleToken && !linkPassword)) && styles.disabledButton]}
                                disabled={loading || (!!pendingGoogleToken && !linkPassword)} onPress={handleGoogle}>
                                <Ionicons name="logo-google" size={22} color="#4285f4" />
                                <Text style={styles.googleButtonText}>{pendingGoogleToken ? 'Connect Google and Sign In' : 'Continue with Google'}</Text>
                            </TouchableOpacity>
                            {!pendingGoogleToken && <TouchableOpacity disabled={loading} style={styles.googleLinkButton} onPress={() => setConnectExisting(!connectExisting)}>
                                <Text style={[styles.registerLink, styles.googleLinkText]}>{connectExisting ? '✓ Connect Google to my existing tenant account' : 'Already registered by phone? Connect your account to Google'}</Text>
                                {connectExisting && <Text style={[styles.linkHint, styles.googleLinkText]}>Enter your existing login details above before continuing.</Text>}
                            </TouchableOpacity>}

                            {__DEV__ && !process.env.EXPO_PUBLIC_API_URL && <TouchableOpacity
                                style={styles.ipToggle}
                                onPress={() => setShowIpConfig(!showIpConfig)}
                            >
                                <Ionicons name="settings-outline" size={14} color={theme.colors.textMuted} />
                                <Text style={styles.ipToggleText}>Server Host Network Config</Text>
                            </TouchableOpacity>}

                            {showIpConfig && (
                                <View style={styles.ipBox}>
                                    <Text style={styles.ipHint}>Enter host server IP address (e.g. 192.168.1.187):</Text>
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
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f1ff'
    },
    keyboardArea: { flex: 1 },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.lg
    },
    content: { width: '100%', maxWidth: 460 },
    header: {
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        marginBottom: theme.spacing.lg
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: theme.spacing.md
    },
    title: {
        fontSize: 26,
        textAlign: 'center',
        fontWeight: '800',
        letterSpacing: -0.5,
        color: theme.colors.text
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        color: theme.colors.textMuted,
        marginTop: 6
    },
    formCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e9e4fa',
        ...theme.shadows.md
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.text
    },
    firstLabel: { marginBottom: 8 },
    passwordRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, marginTop: 4 },
    forgotButton: { marginLeft: 'auto', justifyContent: 'center', minHeight: 44, flexShrink: 1 },
    forgotLink: { color: theme.colors.primaryDark, textAlign: 'right', fontSize: 13, fontWeight: '700' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#faf9ff',
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: '#e4dff3',
        paddingHorizontal: theme.spacing.md,
        minHeight: 52
    },
    inputIcon: {
        marginRight: theme.spacing.sm
    },
    input: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 12,
        fontSize: 15,
        color: theme.colors.text
    },
    loginButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.spacing.md,
        ...theme.shadows.md
    },
    loginButtonText: {
        color: theme.colors.white,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center'
    },
    disabledButton: { opacity: 0.6 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#d9d2ee' },
    dividerText: { flexShrink: 1, color: theme.colors.textMuted, textAlign: 'center', fontSize: 13 },
    googleButton: {
        minHeight: 52,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: '#ded8f2',
        backgroundColor: theme.colors.white,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10
    },
    googleButtonText: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
    googleLinkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, paddingTop: 8 },
    googleLinkText: { textAlign: 'center', fontSize: 13 },
    linkPanel: { backgroundColor: '#f6f3ff', borderRadius: 14, padding: 12, marginBottom: 12 },
    linkHint: { color: theme.colors.textMuted, marginVertical: 8, fontSize: 13 },
    cancelLinkButton: { justifyContent: 'center', minHeight: 44 },
    ipToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: theme.spacing.md,
        minHeight: 44,
        paddingVertical: 8
    },
    ipToggleText: {
        fontSize: 12,
        color: theme.colors.textMuted,
        flexShrink: 1
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
        flexWrap: 'wrap',
        gap: 8
    },
    ipInput: {
        flex: 1,
        minWidth: 112,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
        fontSize: 13
    },
    ipSaveBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 6,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center'
    },
    ipSaveBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold'
    },
    footer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 6,
        rowGap: 2,
        marginTop: theme.spacing.md
    },
    footerText: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center'
    },
    registerLink: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.primaryDark
    }
});

export default LoginScreen;
