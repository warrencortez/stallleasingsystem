import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    PanResponder,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

const InAppNotificationBanner = ({ notification, onDismiss, onPress }) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        if (notification) {
            // Slide down animation
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 65,
                    friction: 9,
                    useNativeDriver: true
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();

            // Auto-dismiss on its own after 5 seconds
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                handleHide();
            }, 5000);
        } else {
            handleHide();
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [notification]);

    const handleHide = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -160,
                duration: 250,
                useNativeDriver: true
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            })
        ]).start(() => {
            if (onDismiss) onDismiss();
        });
    };

    // Allow user to swipe up to dismiss quickly like iOS / Messenger
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -5,
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -20) {
                    handleHide();
                }
            }
        })
    ).current;

    if (!notification) return null;

    const getIconInfo = () => {
        const type = notification.type || '';
        if (type === 'application_approved') {
            return { icon: 'checkmark-done-circle', bg: '#10b981', label: 'APPLICATION' };
        }
        if (type.includes('maintenance')) {
            return {
                icon: type.includes('completed') ? 'checkmark-circle' : 'construct',
                bg: type.includes('completed') ? '#059669' : '#0284c7',
                label: 'MAINTENANCE'
            };
        }
        if (type.includes('stall')) {
            return { icon: 'storefront', bg: '#0891b2', label: 'COMMERCIAL STALL' };
        }
        return { icon: 'notifications', bg: theme.colors.primary, label: 'NOTICE' };
    };

    const iconInfo = getIconInfo();
    const topOffset = Platform.OS === 'web' ? 14 : Math.max(insets.top, 12) + 6;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.floatingContainer,
                {
                    top: topOffset,
                    opacity: opacity,
                    transform: [{ translateY }]
                }
            ]}
        >
            <TouchableOpacity
                style={styles.bannerCard}
                activeOpacity={0.9}
                onPress={() => {
                    handleHide();
                    if (onPress) onPress(notification);
                }}
            >
                {/* Header info */}
                <View style={styles.topRow}>
                    <View style={styles.appIdentity}>
                        <View style={[styles.miniIconBadge, { backgroundColor: iconInfo.bg }]}>
                            <Ionicons name={iconInfo.icon} size={11} color="#fff" />
                        </View>
                        <Text style={styles.appTitleText}>STALL LEASING • {iconInfo.label}</Text>
                    </View>
                    <View style={styles.timeTag}>
                        <Text style={styles.timeText}>now</Text>
                        <TouchableOpacity
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={handleHide}
                            style={styles.closeTouch}
                        >
                            <Ionicons name="close" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Body Content */}
                <View style={styles.bodyRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bannerHeading} numberOfLines={1}>
                            {notification.title}
                        </Text>
                        <Text style={styles.bannerSnippet} numberOfLines={2}>
                            {notification.message}
                        </Text>
                    </View>
                </View>

                {/* Bottom Dismiss Grabber */}
                <View style={styles.bottomHandleBar} />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 999999,
        elevation: 10
    },
    bannerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 7,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.9)',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 10
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5
    },
    appIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    miniIconBadge: {
        width: 18,
        height: 18,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center'
    },
    appTitleText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
        letterSpacing: 0.5
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    timeText: {
        fontSize: 10,
        color: '#94a3b8',
        textTransform: 'lowercase'
    },
    closeTouch: {
        padding: 2
    },
    bodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6
    },
    bannerHeading: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2
    },
    bannerSnippet: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 16
    },
    bottomHandleBar: {
        width: 32,
        height: 3,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 2
    }
});

export default InAppNotificationBanner;
