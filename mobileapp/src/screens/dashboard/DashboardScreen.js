import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import api from '../../config/api';
import { theme } from '../../styles/theme';

const DashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const { unreadCount, fetchNotifications } = useNotifications();
    const [announcements, setAnnouncements] = useState([]);
    const [tenantProfile, setTenantProfile] = useState(null);
    const [myTickets, setMyTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Total Amount Paid
const [totalPaid, setTotalPaid] = useState(0);
const [paymentTotalLoading, setPaymentTotalLoading] = useState(true);
const [paymentTotalError, setPaymentTotalError] = useState(false);
// Monthly Payment Summary
const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 1
);

const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
);

const [monthlyPaid, setMonthlyPaid] = useState(0);
const [monthlyPaidCount, setMonthlyPaidCount] = useState(0);
const [monthlyLoading, setMonthlyLoading] = useState(true);
const [monthlyError, setMonthlyError] = useState(false);

    // Active refresh every time user switches to Home tab
    useFocusEffect(
        useCallback(() => {
            loadDashboardData(true);
            fetchNotifications(true);
        }, [user?.email])
    );

    useEffect(() => {
        loadDashboardData();

        // Auto-poll every 2.5s so dashboard data reflects in real-time
        const interval = setInterval(() => {
            loadDashboardData(true);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

   
const loadDashboardData = async (isSilent = false) => {
    try {
        if (!isSilent) setLoading(true);

        const [annRes, tenRes, mainRes] = await Promise.allSettled([
            api.get('/announcements'),
            api.get('/tenants'),
            api.get('/maintenance')
        ]);

        // Announcements
        if (
            annRes.status === 'fulfilled' &&
            annRes.value.data?.success
        ) {
            setAnnouncements(annRes.value.data.data || []);
        }

        // Tenant Profile
        if (
            tenRes.status === 'fulfilled' &&
            tenRes.value.data?.success
        ) {
            const list = tenRes.value.data.data || [];

            const current = list.find(
                (t) =>
                    t.user_id === user?.id &&
                    t.status === 'active'
            );

            setTenantProfile(current || null);

            // TOTAL AMOUNT PAID
            if (current?.id) {
                try {
                    setPaymentTotalError(false);

                    const summaryRes = await api.get(
                        `/payments/tenant/${current.id}/summary`
                    );

                    if (!summaryRes.data?.success) {
                        throw new Error('Payment summary failed');
                    }

                    const amount = Number(
                        summaryRes.data.data?.total_paid
                    );

                    setTotalPaid(
                        Number.isFinite(amount) ? amount : 0
                    );

                } catch (error) {
                    console.error(
                        'Total Amount Paid Error:',
                        error
                    );

                    setPaymentTotalError(true);

                } finally {
                    setPaymentTotalLoading(false);
                }

            } else {
                setTotalPaid(0);
                setPaymentTotalError(false);
                setPaymentTotalLoading(false);
            }

        } else {
            setPaymentTotalError(true);
            setPaymentTotalLoading(false);
        }

        // Maintenance Tickets
        if (
            mainRes.status === 'fulfilled' &&
            mainRes.value.data?.success
        ) {
            const list = mainRes.value.data.data || [];

            setMyTickets(
                list.filter((t) => t.status !== 'completed')
            );
        }

    } catch (error) {
        console.error('Dashboard load error:', error);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
};


// Fetch Monthly Payment Summary
useEffect(() => {
    if (!tenantProfile?.id) {
        setMonthlyPaid(0);
        setMonthlyPaidCount(0);
        setMonthlyLoading(false);
        setMonthlyError(false);
        return;
    }

    let isMounted = true;

    const fetchMonthlyPayment = async () => {
        try {
            setMonthlyLoading(true);
            setMonthlyError(false);

            const response = await api.get(
                `/payments/tenant/${tenantProfile.id}/monthly-summary`,
                {
                    params: {
                        month: selectedMonth,
                        year: selectedYear
                    }
                }
            );

            if (!response.data?.success) {
                throw new Error('Monthly payment request failed.');
            }

            if (isMounted) {
                const data = response.data.data || {};

                setMonthlyPaid(
                    Number(data.monthly_total_paid) || 0
                );

                setMonthlyPaidCount(
                    Number(data.paid_count) || 0
                );
            }

        } catch (error) {
            console.error('Monthly Payment Error:', error);

            if (isMounted) {
                setMonthlyError(true);
            }

        } finally {
            if (isMounted) {
                setMonthlyLoading(false);
            }
        }
    };

    fetchMonthlyPayment();

    return () => {
        isMounted = false;
    };

}, [tenantProfile?.id, selectedMonth, selectedYear]);

// Change selected month
const changeSelectedMonth = (direction) => {
    const newDate = new Date(
        selectedYear,
        selectedMonth - 1 + direction,
        1
    );

    setSelectedMonth(newDate.getMonth() + 1);
    setSelectedYear(newDate.getFullYear());
};



    const onRefresh = () => {
        setRefreshing(true);
        loadDashboardData();
        fetchNotifications(true);
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
        >
            {/* Header Greeting & Action Bar */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.name || 'Tenant'}</Text>
                </View>
                <View style={styles.headerActions}>
                    {/* Bell Icon: Contains all notifications in this section */}
                    <TouchableOpacity
                        style={styles.notifBtn}
                        onPress={() => navigation.navigate('Notifications')}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                            size={23}
                            color={unreadCount > 0 ? theme.colors.primary : '#475569'}
                        />
                        {unreadCount > 0 && (
                            <View style={styles.headerBadge}>
                                <Text style={styles.headerBadgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.profileBadge}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={styles.profileBadgeText}>
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 1. Hero Rent Status Card */}
            <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                    <View>
                        <View style={styles.stallPill}>
                            <Text style={styles.stallPillText}>
                                {tenantProfile ? `Stall: ${tenantProfile.stall_number || 'Assigned'}` : 'Tenant Member'}
                            </Text>
                        </View>
                        <Text style={styles.heroBusinessName}>
                            {tenantProfile?.business_name || user?.name}
                        </Text>
                        <Text style={styles.heroLocation}>
                            {tenantProfile?.stall_location || 'Commercial Complex'}
                        </Text>
                    </View>
                    <View style={styles.heroIconBg}>
                        <Ionicons name="storefront" size={26} color="#fff" />
                    </View>
                </View>

                <View style={styles.heroBottom}>
                    <View>
                        <Text style={styles.heroRentLabel}>{tenantProfile?.rent_type === 'daily' ? 'Daily Lease Rent' : 'Monthly Lease Rent'}</Text>
                        <Text style={styles.heroRentAmount}>
                            ₱{Number((tenantProfile?.rent_type === 'daily' ? tenantProfile?.daily_rent : tenantProfile?.monthly_rent) || 0).toLocaleString()}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.heroPayBtn}
                        onPress={() => navigation.navigate('Billing')}
                    >
                        <Ionicons name="card-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.heroPayBtnText}>Pay Online</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. Quick Action Grid */}
            
{/* TOTAL AMOUNT PAID CARD */}
<View style={styles.totalPaidCard}>

    <View style={styles.totalPaidHeader}>

        <View style={styles.totalPaidIcon}>
            <Ionicons
                name="wallet-outline"
                size={25}
                color={theme.colors.success}
            />
        </View>

        <View style={{ flex: 1 }}>
            <Text style={styles.totalPaidTitle}>
                Total Amount Paid
            </Text>

            <Text style={styles.totalPaidDescription}>
                Overall accumulated rental payments
            </Text>
        </View>

    </View>

    {paymentTotalLoading ? (

        <ActivityIndicator
            size="small"
            color={theme.colors.primary}
        />

    ) : paymentTotalError ? (

        <Text style={styles.totalPaidError}>
            Unable to load payment total.
            Pull down to refresh.
        </Text>

    ) : (

        <Text style={styles.totalPaidAmount}>
            ₱{Number(totalPaid).toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}
        </Text>

    )}

</View>


{/* MONTHLY PAYMENT SUMMARY CARD */}
<View style={styles.monthlyPaidCard}>

    <View style={styles.monthlyPaidHeader}>
        <View style={{ flex: 1 }}>
            <Text style={styles.monthlyPaidTitle}>
                Monthly Payment Summary
            </Text>

            <Text style={styles.monthlyPaidDescription}>
                Your total rental payments per month
            </Text>
        </View>

        <Ionicons
            name="calendar-outline"
            size={25}
            color={theme.colors.primary}
        />
    </View>

    {/* MONTH SELECTOR */}
    <View style={styles.monthSelector}>

        <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => changeSelectedMonth(-1)}
        >
            <Ionicons
                name="chevron-back"
                size={22}
                color={theme.colors.primary}
            />
        </TouchableOpacity>

        <Text style={styles.selectedMonthText}>
            {new Date(
                selectedYear,
                selectedMonth - 1,
                1
            ).toLocaleDateString('en-PH', {
                month: 'long',
                year: 'numeric'
            })}
        </Text>

        <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => {
                const now = new Date();

                if (
                    selectedYear < now.getFullYear() ||
                    (
                        selectedYear === now.getFullYear() &&
                        selectedMonth < now.getMonth() + 1
                    )
                ) {
                    changeSelectedMonth(1);
                }
            }}
        >
            <Ionicons
                name="chevron-forward"
                size={22}
                color={theme.colors.primary}
            />
        </TouchableOpacity>

    </View>

    {/* MONTHLY TOTAL */}
    {monthlyLoading ? (

        <ActivityIndicator
            size="small"
            color={theme.colors.primary}
        />

    ) : monthlyError ? (

        <Text style={styles.monthlyPaidError}>
            Unable to load monthly payments.
            Please try again.
        </Text>

    ) : (

        <>
            <Text style={styles.monthlyPaidAmount}>
                ₱{Number(monthlyPaid).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </Text>

            <Text style={styles.monthlyPaidCount}>
                {monthlyPaidCount} paid transaction(s)
            </Text>
        </>

    )}

</View>



            <View style={styles.actionsGrid}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Stalls')}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                        <Ionicons name="storefront" size={22} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.actionLabel}>Stalls</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Billing')}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="card" size={22} color={theme.colors.success} />
                    </View>
                    <Text style={styles.actionLabel}>PayMongo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Fix Hub')}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="build" size={22} color={theme.colors.warning} />
                    </View>
                    <Text style={styles.actionLabel}>Report Fix</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Billing')}
                >
                    <View style={[styles.actionIcon, { backgroundColor: '#e0f2fe' }]}>
                        <Ionicons name="receipt" size={22} color="#0284c7" />
                    </View>
                    <Text style={styles.actionLabel}>Receipts</Text>
                </TouchableOpacity>
            </View>

            {/* 3. Admin Announcements Feed */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="megaphone-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Admin Advisories & News</Text>
                </View>

                {loading ? (
                    <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
                ) : announcements.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No active market advisories right now. 📢</Text>
                    </View>
                ) : (
                    announcements.map((ann) => (
                        <View
                            key={ann.id}
                            style={[
                                styles.announcementCard,
                                ann.priority === 'urgent' && styles.urgentCard
                            ]}
                        >
                            <View style={styles.annHeader}>
                                <Text style={styles.annTitle}>{ann.title}</Text>
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>{ann.category?.replace('_', ' ')}</Text>
                                </View>
                            </View>
                            <Text style={styles.annContent}>{ann.content}</Text>
                            <Text style={styles.annDate}>
                                Posted: {new Date(ann.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                    ))
                )}
            </View>

            {/* 4. Active Maintenance Tracker */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="construct-outline" size={20} color={theme.colors.warning} />
                    <Text style={styles.sectionTitle}>Stall Repair Tracker</Text>
                </View>

                {myTickets.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="shield-checkmark-outline" size={28} color={theme.colors.success} />
                        <Text style={styles.emptyText}>No active repairs reported for your stall.</Text>
                    </View>
                ) : (
                    myTickets.slice(0, 3).map((t) => (
                        <TouchableOpacity
                            key={t.id}
                            style={styles.ticketCard}
                            onPress={() => navigation.navigate('Fix Hub', { highlightTicketId: t.id })}
                            activeOpacity={0.8}
                        >
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.ticketTitle}>{t.title}</Text>
                                <Text style={styles.ticketMeta}>
                                    {t.category?.replace('_', ' ')} • {t.stall_number ? `Stall ${t.stall_number}` : 'My Stall'}
                                </Text>
                            </View>
                            <View style={[
                                styles.ticketStatus,
                                t.status === 'in_progress' ? styles.statusProgress : styles.statusPending
                            ]}>
                                <Text style={styles.ticketStatusText}>{t.status?.replace('_', ' ')}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
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
        paddingBottom: 30
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        marginTop: 10
    },
    greeting: {
        fontSize: 13,
        color: theme.colors.textMuted
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    profileBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.sm
    },
    profileBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    heroCard: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        ...theme.shadows.md
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.md
    },
    stallPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.full,
        alignSelf: 'flex-start',
        marginBottom: 6
    },
    stallPillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold'
    },
    heroBusinessName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    heroLocation: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12
    },
    heroIconBg: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
        paddingTop: theme.spacing.md
    },
    heroRentLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 11
    },
    heroRentAmount: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold'
    },
    heroPayBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.borderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    heroPayBtnText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 13
    },
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.lg
    },
    actionBtn: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    actionIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.text
    },
    section: {
        marginBottom: theme.spacing.lg
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: theme.spacing.sm
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    emptyCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    emptyText: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginTop: 4
    },
    announcementCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    urgentCard: {
        borderLeftColor: theme.colors.danger,
        backgroundColor: '#fff5f5'
    },
    annHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4
    },
    annTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1
    },
    categoryBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    categoryText: {
        fontSize: 10,
        color: theme.colors.textMuted,
        textTransform: 'capitalize'
    },
    annContent: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginBottom: 6,
        lineHeight: 18
    },
    annDate: {
        fontSize: 10,
        color: theme.colors.textMuted
    },
    ticketCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.xs,
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    ticketTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    ticketMeta: {
        fontSize: 11,
        color: theme.colors.textMuted,
        textTransform: 'capitalize',
        marginTop: 2
    },
    ticketStatus: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full
    },
    statusCompleted: {
        backgroundColor: theme.colors.successLight
    },
    statusPending: {
        backgroundColor: theme.colors.warningLight
    },
    statusProgress: {
        backgroundColor: '#e0f2fe'
    },
    ticketStatusText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        color: theme.colors.text
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    notifBtn: {
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: '#ef4444',
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#fff'
    },
    headerBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold'
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    alertBannerApproved: {
        borderLeftColor: '#10b981',
        backgroundColor: '#ecfdf5'
    },
    alertBannerSuccess: {
        borderLeftColor: '#059669',
        backgroundColor: '#f0fdf4'
    },
    alertBannerProgress: {
        borderLeftColor: '#0284c7',
        backgroundColor: '#f0f9ff'
    },
    alertBannerStall: {
        borderLeftColor: '#06b6d4',
        backgroundColor: '#f0fdfa'
    },
    alertBannerIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    alertBannerContent: {
        flex: 1,
        marginRight: 6
    },
    alertBannerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2
    },
    alertBannerTag: {
        fontSize: 10,
        fontWeight: 'bold',
        color: theme.colors.primary,
        letterSpacing: 0.5
    },
    alertBannerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2
    },
    alertBannerMessage: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16
    },

    // TOTAL AMOUNT PAID CARD

    totalPaidCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },

    totalPaidHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },

    totalPaidIcon: {
        width: 45,
        height: 45,
        borderRadius: 12,
        backgroundColor: theme.colors.successLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },

    totalPaidTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: theme.colors.text
    },

    totalPaidDescription: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginTop: 3
    },

    totalPaidAmount: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.success
    },

    totalPaidError: {
        fontSize: 12,
        color: theme.colors.danger
    },


// MONTHLY PAYMENT SUMMARY CARD

monthlyPaidCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm
},

monthlyPaidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
},

monthlyPaidTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.text
},

monthlyPaidDescription: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3
},

monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 18
},

monthArrow: {
    padding: 8
},

selectedMonthText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text
},

monthlyPaidAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.success,
    marginBottom: 4
},

monthlyPaidCount: {
    fontSize: 11,
    color: theme.colors.textMuted
},

monthlyPaidError: {
    fontSize: 12,
    color: theme.colors.danger
},

    
});

export default DashboardScreen;
