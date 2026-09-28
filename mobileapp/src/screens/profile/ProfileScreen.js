import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';
import { theme } from '../../styles/theme';

const ProfileScreen = () => {
    const { user, logout } = useAuth();
    const [tenantProfile, setTenantProfile] = useState(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await api.get('/tenants');
            if (res.data?.success) {
                const list = res.data.data || [];
                const current = list.find((t) => t.user_id === user?.id && t.status === 'active');
                setTenantProfile(current || null);
            }
        } catch (error) {
            console.error('Profile error:', error);
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out of the tenant mobile app?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: () => logout()
            }
        ]);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Profile Avatar Card */}
            <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
                    </Text>
                </View>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{user?.role || 'Tenant'} Member</Text>
                </View>
            </View>

            {/* Lease & Business Info */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="storefront-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Lease & Business Information</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Assigned Stall:</Text>
                    <Text style={styles.infoVal}>{tenantProfile?.stall_number || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Business Name:</Text>
                    <Text style={styles.infoVal}>{tenantProfile?.business_name || 'Individual Merchant'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mobile Contact:</Text>
                    <Text style={styles.infoVal}>{tenantProfile?.phone || user?.phone || 'Not set'}</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Monthly Lease:</Text>
                    <Text style={styles.infoValRate}>₱{Number(tenantProfile?.monthly_rent || 0).toLocaleString()}</Text>
                </View>
            </View>

            {/* Actions & Sign Out */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="settings-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Account Actions</Text>
                </View>

                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
                    <Text style={styles.signOutBtnText}>Sign Out of Tenant App</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    contentContainer: {
        padding: theme.spacing.md,
        paddingBottom: 40
    },
    profileCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    avatarCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.sm,
        ...theme.shadows.md
    },
    avatarText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff'
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    profileEmail: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginTop: 2
    },
    roleBadge: {
        backgroundColor: theme.colors.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.full,
        marginTop: 8
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: theme.colors.primary,
        textTransform: 'capitalize'
    },
    sectionCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 8
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc'
    },
    infoLabel: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    infoVal: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text
    },
    infoValRate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.success
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.dangerLight,
        backgroundColor: '#fff5f5',
        marginTop: 4
    },
    signOutBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: theme.colors.danger
    }
});

export default ProfileScreen;
