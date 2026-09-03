import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../config/api';
import { useAuth } from './AuthContext';
import playNotificationSound from '../utils/notificationSound';
import { navigate } from '../navigation/navigationRef';
import InAppNotificationBanner from '../components/common/InAppNotificationBanner';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentToast, setCurrentToast] = useState(null);
    const prevUnreadIdsRef = useRef(new Set());
    const isFirstLoadRef = useRef(true);

    const fetchNotifications = async (isSilent = false) => {
        if (!isAuthenticated) return;

        try {
            const res = await api.get('/notifications');
            if (res.data?.success) {
                const list = res.data.data || [];
                const unreadList = list.filter((n) => !n.is_read);
                const currentUnreadCount = unreadList.length;

                // Check for new unread notifications
                if (!isFirstLoadRef.current) {
                    const newlyArrived = unreadList.filter((n) => !prevUnreadIdsRef.current.has(n.id));
                    if (newlyArrived.length > 0) {
                        const latest = newlyArrived[0];
                        // Play the harmonic chime and trigger mobile vibration
                        playNotificationSound();
                        // Show universal floating messenger toast
                        setCurrentToast(latest);
                    }
                } else {
                    isFirstLoadRef.current = false;
                    // If there's an unread notification created in the last 2 minutes, trigger toast
                    if (unreadList.length > 0) {
                        const latest = unreadList[0];
                        const diffMs = new Date() - new Date(latest.created_at);
                        if (diffMs < 120000) {
                            playNotificationSound();
                            setCurrentToast(latest);
                        }
                    }
                }

                // Update unread IDs tracker
                prevUnreadIdsRef.current = new Set(unreadList.map((n) => n.id));
                setNotifications(list);
                setUnreadCount(currentUnreadCount);
            }
        } catch (error) {
            // silent network failure during background poll
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();

            // Fast universal polling every 2 seconds for instant updates
            const interval = setInterval(() => {
                fetchNotifications(true);
            }, 2000);

            return () => clearInterval(interval);
        } else {
            setNotifications([]);
            setUnreadCount(0);
            setCurrentToast(null);
            prevUnreadIdsRef.current = new Set();
            isFirstLoadRef.current = true;
        }
    }, [isAuthenticated, user?.id]);

    const markAsRead = async (notifId) => {
        try {
            await api.patch(`/notifications/${notifId}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            prevUnreadIdsRef.current.delete(notifId);
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    const handleToastPress = async (notif) => {
        if (!notif) return;

        // Mark as read
        if (!notif.is_read) {
            await markAsRead(notif.id);
        }
        setCurrentToast(null);

        // Deep-link to the exact section
        if (notif.type === 'application_approved') {
            let stallId = null;
            if (notif.link && notif.link.includes('stall_id=')) {
                stallId = notif.link.split('stall_id=')[1];
            }
            navigate('Main', {
                screen: 'Stalls',
                params: { highlightStallId: stallId }
            });
        } else if (notif.type?.includes('maintenance')) {
            navigate('Main', {
                screen: 'Fix Hub',
                params: { highlightTicketId: notif.reference_id || null }
            });
        } else if (notif.type?.includes('stall')) {
            navigate('Main', { screen: 'Stalls' });
        } else if (notif.type?.includes('payment') || notif.type?.includes('bill')) {
            navigate('Main', { screen: 'Billing' });
        } else {
            navigate('Notifications');
        }
    };

    const showToastNotification = (notif) => {
        playNotificationSound();
        setCurrentToast(notif);
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                fetchNotifications,
                markAsRead,
                showToastNotification
            }}
        >
            {children}
            {/* Universal Floating Messenger Banner at the top of entire app */}
            <InAppNotificationBanner
                notification={currentToast}
                onDismiss={() => setCurrentToast(null)}
                onPress={handleToastPress}
            />
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
