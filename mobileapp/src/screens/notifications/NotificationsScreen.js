import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import api from '../../config/api';
import { theme } from '../../styles/theme';
import playNotificationSound from '../../utils/notificationSound';

const NotificationsScreen = ({ navigation }) => {
    const { fetchNotifications: syncGlobal } = useNotifications();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'unread', 'maintenance', 'stalls'
    const prevUnreadRef = useRef(null);

    const fetchNotifications = useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const res = await api.get('/notifications');
            if (res.data?.success) {
                const list = res.data.data || [];
                const currentUnread = list.filter((n) => !n.is_read).length;

                // Play notification ring sound on new notifications
                if (isSilent && prevUnreadRef.current !== null && currentUnread > prevUnreadRef.current) {
                    playNotificationSound();
                }

                prevUnreadRef.current = currentUnread;
                setNotifications(list);
            }
        } catch (error) {
            if (error.response?.status === 401) {
                console.warn('[Notifications] Token expired (401). Session being refreshed.');
            } else {
                console.warn('[Notifications] Fetch notice:', error.message);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        // Polling every 5 seconds for real-time admin updates
        const interval = setInterval(() => {
            fetchNotifications(true);
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const markAsRead = async (notif) => {
        try {
            if (!notif.is_read) {
                await api.patch(`/notifications/${notif.id}/read`);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
                );
                syncGlobal(true);
            }

            // Route user to the relevant tab/screen with highlight parameters
            if (notif.type?.includes('maintenance')) {
                navigation.navigate('Main', {
                    screen: 'Fix Hub',
                    params: { highlightTicketId: notif.reference_id || null }
                });
            } else if ((notif.type === 'application_approved' || notif.type === 'application_status')) {
                let stallId = null;
                if (notif.link && notif.link.includes('stall_id=')) {
                    stallId = notif.link.split('stall_id=')[1];
                }
                navigation.navigate('Main', {
                    screen: 'Stalls',
                    params: { highlightStallId: stallId }
                });
            } else if (notif.type?.includes('stall')) {
                navigation.navigate('Main', { screen: 'Stalls' });
            } else if (notif.type?.includes('payment') || notif.type?.includes('rent') || notif.type?.includes('bill') || notif.type === 'rent_due') {
                navigation.navigate('Main', { screen: 'Billing' });
            } else if (notif.type?.includes('application')) {
                navigation.navigate('Main', { screen: 'Stalls' });
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/notifications/mark-all-read');
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            syncGlobal(true);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const getIconConfig = (type) => {
        if (type === 'maintenance_completed') {
            return { name: 'checkmark-done-circle', color: '#10b981', bg: '#ecfdf5', label: 'Completed' };
        }
        if (type?.includes('maintenance')) {
            return { name: 'build', color: '#3b82f6', bg: '#eff6ff', label: 'Maintenance' };
        }
        if (type?.includes('stall')) {
            return { name: 'storefront', color: '#06b6d4', bg: '#ecfeff', label: 'Stall Alert' };
        }
        if (type?.includes('payment') || type?.includes('rent') || type?.includes('bill')) {
            return { name: 'card', color: '#8b5cf6', bg: '#f5f3ff', label: 'Billing' };
        }
        if (type?.includes('application')) {
            return { name: 'document-text', color: '#f59e0b', bg: '#fffbeb', label: 'Application' };
        }
        return { name: 'notifications', color: '#64748b', bg: '#f8fafc', label: 'Notice' };
    };

    const formatTimestamp = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHour < 24) return `${diffHour}h ago`;
            if (diffDay === 1) return 'Yesterday';
            if (diffDay < 7) return `${diffDay}d ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    const filteredNotifications = notifications.filter((n) => {
        if (filter === 'unread') return !n.is_read;
        if (filter === 'maintenance') return n.type?.includes('maintenance');
        if (filter === 'stalls') return n.type?.includes('stall');
        return true;
    });

    const renderItem = ({ item }) => {
        const iconConfig = getIconConfig(item.type);
        return (
            <TouchableOpacity
                style={[
                    styles.notificationCard,
                    !item.is_read && styles.unreadCard
                ]}
                onPress={() => markAsRead(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconBox, { backgroundColor: iconConfig.bg }]}>
                    <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
                </View>

                <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                        <View style={styles.typeBadge}>
                            <Text style={[styles.typeBadgeText, { color: iconConfig.color }]}>
                                {iconConfig.label}
                            </Text>
                        </View>
                        <Text style={styles.timeText}>{formatTimestamp(item.created_at)}</Text>
                    </View>

                    <Text style={[styles.cardTitle, !item.is_read && styles.unreadTitle]}>
                        {item.title}
                    </Text>
                    <Text style={styles.cardMessage}>{item.message}</Text>

                    {!item.is_read && <View style={styles.unreadDot} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Toolbar */}
            <View style={styles.topToolbar}>
                <View style={styles.titleGroup}>
                    <Text style={styles.screenHeading}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
                        </View>
                    )}
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead}>
                        <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Filter Chips */}
            <View style={styles.filterRow}>
                {[
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: `Unread (${unreadCount})` },
                    { id: 'maintenance', label: 'Maintenance 🛠️' },
                    { id: 'stalls', label: 'Stalls 🏪' }
                ].map((chip) => (
                    <TouchableOpacity
                        key={chip.id}
                        style={[
                            styles.chipBtn,
                            filter === chip.id && styles.chipBtnActive
                        ]}
                        onPress={() => setFilter(chip.id)}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                filter === chip.id && styles.chipTextActive
                            ]}
                        >
                            {chip.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content List */}
            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            ) : filteredNotifications.length === 0 ? (
                <View style={styles.centerContainer}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="notifications-off-outline" size={44} color="#94a3b8" />
                    </View>
                    <Text style={styles.emptyTitle}>
                        {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {filter === 'unread'
                            ? "You're all caught up! You will be notified when the admin updates stalls or maintenance."
                            : 'When management completes maintenance or adds new stalls, alerts will appear here.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredNotifications}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    topToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    titleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    screenHeading: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    unreadBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold'
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(56, 189, 248, 0.1)'
    },
    markAllText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.primary
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 8
    },
    chipBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    chipBtnActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b'
    },
    chipTextActive: {
        color: '#fff'
    },
    listContent: {
        padding: 16,
        gap: 12
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        position: 'relative'
    },
    unreadCard: {
        backgroundColor: '#ffffff',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    cardContent: {
        flex: 1
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#f8fafc'
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    timeText: {
        fontSize: 11,
        color: '#94a3b8'
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 3
    },
    unreadTitle: {
        fontWeight: 'bold',
        color: '#0f172a'
    },
    cardMessage: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18
    },
    unreadDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444'
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b'
    },
    emptyIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 6,
        textAlign: 'center'
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 19
    }
});

export default NotificationsScreen;
