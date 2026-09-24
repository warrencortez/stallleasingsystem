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
import { theme } from '../../styles/theme';

const RegisterScreen = ({ navigation }) => {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Validation conditions
    const hasMinLength = password.length >= 6;
    const hasNoSymbols = password.length > 0 && /^[a-zA-Z0-9]+$/.test(password);
    const isPasswordValid = hasMinLength && hasNoSymbols;

    const handlePhoneChange = (text) => {
        // Remove non-numeric characters
        let digits = text.replace(/[^0-9]/g, '');

        // If user typed 639..., strip leading 63
        if (digits.startsWith('63')) {
            digits = digits.slice(2);
        }

        // If user starts with 0 (e.g. 09...), automatically delete 0
        while (digits.startsWith('0')) {
            digits = digits.slice(1);
        }

        // Must start with 9
        if (digits.length > 0 && !digits.startsWith('9')) {
            const nineIndex = digits.indexOf('9');
            if (nineIndex !== -1) {
                digits = digits.slice(nineIndex);
            } else {
                digits = '';
            }
        }

        // Strictly 10 digits max
        if (digits.length > 10) {
            digits = digits.slice(0, 10);
        }

        setPhone(digits);
    };

    const handleRegister = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Name', 'Please enter your full name.');
            return;
        }

        if (phone.length !== 10 || !phone.startsWith('9')) {
            Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number starting with 9.');
            return;
        }

        if (!isPasswordValid) {
            Alert.alert('Invalid Password', 'Please ensure password meets all requirements (minimum 6 digits/letters with no symbols).');
            return;
        }

        try {
            setLoading(true);
            const fullPhoneNumber = `+63${phone}`;
            const res = await register({
                name: name.trim(),
                phone: fullPhoneNumber,
                password
            });

            if (res.success) {
                Alert.alert('Registration Successful', 'Welcome to Dela Costa HOA Stall Leasing!');
            } else {
                Alert.alert('Registration Failed', res.message || 'Unable to create account.');
            }
        } catch (error) {
            Alert.alert('Connection Error', 'Unable to connect to registration server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Create Tenant Account</Text>
                </View>

                <View style={styles.formCard}>
                    {/* Full Name */}
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Maria Santos"
                            placeholderTextColor="#94a3b8"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    {/* Mobile Number */}
                    <Text style={styles.label}>Mobile Number</Text>
                    <View style={styles.phoneInputContainer}>
                        <View style={styles.countryCodeBadge}>
                            <Text style={styles.countryCodeText}>+63</Text>
                        </View>
                        <TextInput
                            style={styles.phoneInput}
                            placeholder="9XXXXXXXXX"
                            placeholderTextColor="#94a3b8"
                            keyboardType="number-pad"
                            maxLength={10}
                            value={phone}
                            onChangeText={handlePhoneChange}
                        />
                    </View>

                    {/* Password */}
                    <Text style={[styles.label, { marginTop: theme.spacing.sm }]}>Password</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry
                            autoCapitalize="none"
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    {/* Dynamic Password Requirement Indicator Circles */}
                    <View style={styles.requirementsContainer}>
                        <View style={styles.requirementRow}>
                            <View style={[styles.indicatorCircle, hasMinLength && styles.indicatorCircleMet]}>
                                {hasMinLength && <Ionicons name="checkmark" size={10} color="#fff" />}
                            </View>
                            <Text style={[styles.requirementText, hasMinLength && styles.requirementTextMet]}>
                                Minimum of 6 digits or letters
                            </Text>
                        </View>

                        <View style={styles.requirementRow}>
                            <View style={[styles.indicatorCircle, hasNoSymbols && styles.indicatorCircleMet]}>
                                {hasNoSymbols && <Ionicons name="checkmark" size={10} color="#fff" />}
                            </View>
                            <Text style={[styles.requirementText, hasNoSymbols && styles.requirementTextMet]}>
                                No symbols
                            </Text>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[
                            styles.registerButton,
                            (!name.trim() || phone.length !== 10 || !isPasswordValid) && styles.registerButtonDisabled
                        ]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.registerButtonText}>Register as Tenant</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already registered?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.loginLink}>Sign In</Text>
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
        padding: theme.spacing.lg
    },
    header: {
        marginBottom: theme.spacing.lg,
        marginTop: 15
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.text
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
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        marginBottom: theme.spacing.sm
    },
    countryCodeBadge: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 13,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border
    },
    countryCodeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text
    },
    requirementsContainer: {
        marginTop: -4,
        marginBottom: theme.spacing.md,
        gap: 6,
        paddingHorizontal: 4
    },
    requirementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    indicatorCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center'
    },
    indicatorCircleMet: {
        borderColor: '#10b981',
        backgroundColor: '#10b981'
    },
    requirementText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500'
    },
    requirementTextMet: {
        color: '#10b981',
        fontWeight: '600'
    },
    registerButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: theme.spacing.xs,
        ...theme.shadows.md
    },
    registerButtonDisabled: {
        opacity: 0.6
    },
    registerButtonText: {
        color: theme.colors.white,
        fontSize: 16,
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
    loginLink: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.primary
    }
});

export default RegisterScreen;
