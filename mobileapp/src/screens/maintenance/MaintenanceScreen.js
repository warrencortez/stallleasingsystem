import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';
import { theme } from '../../styles/theme';

const MaintenanceScreen = ({ navigation, route }) => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [myRentedStalls, setMyRentedStalls] = useState([]);
    const [selectedStallToReport, setSelectedStallToReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewedTicketIds, setViewedTicketIds] = useState([]);

    // Create Modal
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('general');
    const [priority, setPriority] = useState('medium');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Details Modal
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedDetailTicket, setSelectedDetailTicket] = useState(null);

    const highlightTicketId = route?.params?.highlightTicketId;

    // Load viewed tickets from storage
    useEffect(() => {
        const loadViewed = async () => {
            try {
                const stored = await AsyncStorage.getItem(`@viewed_tickets_${user?.id}`);
                if (stored) {
                    setViewedTicketIds(JSON.parse(stored));
                }
            } catch (err) {
                // silent
            }
        };
        loadViewed();
    }, [user?.id]);

    // Instantly refresh tickets when navigating into Fix Hub
    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [user?.email])
    );

    useEffect(() => {
        loadData();

        // Fast auto-poll every 2.5 seconds so status changes reflect in real time
        const interval = setInterval(() => {
            loadData(true);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    // Auto-open highlighted ticket when navigated from banner
    useEffect(() => {
        if (highlightTicketId && tickets.length > 0) {
            const target = tickets.find((t) => String(t.id) === String(highlightTicketId));
            if (target) {
                setSelectedDetailTicket(target);
                setShowDetailsModal(true);
            }
        }
    }, [highlightTicketId, tickets]);

    const loadData = async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const [mainRes, tenRes, stallsRes] = await Promise.allSettled([
                api.get('/maintenance'),
                api.get('/tenants'),
                api.get('/stalls')
            ]);

            const allStalls = (stallsRes.status === 'fulfilled' && stallsRes.value.data?.success)
                ? (stallsRes.value.data.data || [])
                : [];

            if (mainRes.status === 'fulfilled' && mainRes.value.data?.success) {
                setTickets(mainRes.value.data.data || []);
            }

            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                const list = tenRes.value.data.data || [];
                const myTenancies = list.filter((t) =>
                    t.user_id === user?.id &&
                    t.status === 'active' &&
                    t.stall_id
                );

                const rented = myTenancies.map((ten) => {
                    const stall = allStalls.find((s) => s.id === ten.stall_id) || {};
                    return {
                        tenant_id: ten.id,
                        stall_id: ten.stall_id,
                        stall_number: stall.stall_number || ten.stall_number || `Stall #${ten.stall_id}`,
                        location: stall.location || ten.stall_location || 'Commercial Complex'
                    };
                });

                setMyRentedStalls(rented);
                if (rented.length > 0) {
                    setSelectedStallToReport((prev) => prev || rented[0]);
                }
            }
        } catch (error) {
            console.error('Maintenance error:', error);
        } finally {
            setLoading(false);
        }
    };

    const isTicketUpdated = (item) => {
        if (!item) return false;
        if (highlightTicketId && String(item.id) === String(highlightTicketId)) {
            return true;
        }
        if (viewedTicketIds.includes(item.id)) {
            return false;
        }
        return item.status === 'completed' || item.status === 'in_progress';
    };

    const handleOpenDetails = (ticket) => {
        setSelectedDetailTicket(ticket);
        setShowDetailsModal(true);
    };

    const handleCloseDetails = async () => {
        if (selectedDetailTicket) {
            const id = selectedDetailTicket.id;
            if (!viewedTicketIds.includes(id)) {
                const updated = [...viewedTicketIds, id];
                setViewedTicketIds(updated);
                try {
                    await AsyncStorage.setItem(`@viewed_tickets_${user?.id}`, JSON.stringify(updated));
                } catch (err) {}
            }
        }

        // Clear highlight route param if present
        if (route?.params?.highlightTicketId) {
            navigation.setParams({ highlightTicketId: null });
        }

        setShowDetailsModal(false);
        setSelectedDetailTicket(null);
    };

    const handleCreateTicket = async () => {
        if (myRentedStalls.length === 0) {
            Alert.alert('No Active Rent', 'You do not have any active rented stalls to report damage for.');
            return;
        }

        const targetStall = selectedStallToReport || myRentedStalls[0];

        if (!title.trim() || !description.trim()) {
            Alert.alert('Missing Details', 'Please enter a title and description for the repair.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                tenant_id: targetStall.tenant_id,
                stall_id: targetStall.stall_id,
                title: title.trim(),
                category,
                priority,
                description: description.trim()
            };

            const res = await api.post('/maintenance', payload);
            if (res.data?.success) {
                Alert.alert(
                    'Repair Ticket Submitted! 🔧',
                    `Submitted for Stall ${targetStall.stall_number}. Admin and technicians have been notified.`
                );
                setShowModal(false);
                setTitle('');
                setDescription('');
                loadData(true);
            } else {
                Alert.alert('Error', res.data?.message || 'Failed to submit report');
            }
        } catch (error) {
            Alert.alert('Error', 'Unable to reach backend. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderTicket = ({ item }) => {
        const isCompleted = item.status === 'completed';
        const isInProgress = item.status === 'in_progress';
        const hasNotifBadge = isTicketUpdated(item);

        return (
            <TouchableOpacity
                style={[
                    styles.ticketCard,
                    hasNotifBadge && styles.ticketCardHighlighted
                ]}
                onPress={() => handleOpenDetails(item)}
                activeOpacity={0.85}
            >
                {/* Top Notification Badge */}
                {hasNotifBadge && (
                    <View style={[
                        styles.ticketNotifBadge,
                        isCompleted ? styles.badgeSuccess : styles.badgeProgress
                    ]}>
                        <Ionicons name="sparkles" size={11} color="#fff" />
                        <Text style={styles.ticketNotifBadgeText}>
                            {isCompleted ? 'UPDATED: COMPLETED ✅' : 'UPDATED: IN PROGRESS 🛠️'}
                        </Text>
                    </View>
                )}

                <View style={styles.ticketHeader}>
                    <View style={styles.categoryIconCircle}>
                        <Ionicons
                            name={isCompleted ? 'checkmark-circle' : isInProgress ? 'hammer' : 'construct'}
                            size={18}
                            color={isCompleted ? '#10b981' : isInProgress ? '#0284c7' : theme.colors.warning}
                        />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.ticketTitle}>{item.title}</Text>
                        <Text style={styles.ticketCategory}>
                            {item.category?.replace('_', ' ')} • {item.stall_number ? `Stall ${item.stall_number}` : 'My Stall'}
                        </Text>
                    </View>
                    <View style={[
                        styles.statusPill,
                        isCompleted ? styles.statusPillCompleted : isInProgress ? styles.statusPillProgress : styles.statusPillPending
                    ]}>
                        <Text style={styles.statusPillText}>{item.status?.replace('_', ' ')}</Text>
                    </View>
                </View>

                <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>

                {item.resolution_notes ? (
                    <View style={styles.resolutionBox}>
                        <Text style={styles.resolutionLabel}>Staff Resolution Notes:</Text>
                        <Text style={styles.resolutionText} numberOfLines={2}>{item.resolution_notes}</Text>
                    </View>
                ) : null}

                <View style={styles.ticketFooter}>
                    <Text style={styles.priorityText}>
                        Priority: <Text style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.priority}</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.tapToViewText}>Tap to view details</Text>
                        <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const hasActiveRent = myRentedStalls.length > 0;

    return (
        <View style={styles.container}>
            {/* Top Bar Greeting & Report Button */}
            <View style={styles.topBanner}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.bannerStall}>
                        {hasActiveRent
                            ? myRentedStalls.length === 1
                                ? `Stall ${myRentedStalls[0].stall_number}`
                                : `${myRentedStalls.length} Active Stalls`
                            : 'Fix Hub'}
                    </Text>
                    <Text style={styles.bannerSub}>Maintenance & Defect Reports</Text>
                </View>

                {hasActiveRent ? (
                    <TouchableOpacity
                        style={styles.newReportBtn}
                        onPress={() => setShowModal(true)}
                    >
                        <Ionicons name="add-circle" size={18} color="#0f172a" />
                        <Text style={styles.newReportBtnText}>Report Issue</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.applySmallBtn}
                        onPress={() => navigation.navigate('Stalls')}
                    >
                        <Ionicons name="storefront-outline" size={14} color="#fff" />
                        <Text style={styles.applySmallBtnText}>Rent a Stall</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading maintenance tickets...</Text>
                </View>
            ) : !hasActiveRent ? (
                /* Empty state when tenant does NOT have any active rent */
                <View style={styles.noActiveRentCard}>
                    <View style={styles.noActiveRentIconCircle}>
                        <Ionicons name="storefront-outline" size={44} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.noActiveRentTitle}>You don't have any active rent</Text>
                    <Text style={styles.noActiveRentSub}>
                        Only tenants with a confirmed active stall lease can submit maintenance and repair reports.
                    </Text>
                    <TouchableOpacity
                        style={styles.applyNowBtn}
                        onPress={() => navigation.navigate('Stalls')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add-circle" size={18} color="#fff" />
                        <Text style={styles.applyNowBtnText}>Click here to apply for a stall</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderTicket}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyList}>
                            <Ionicons name="shield-checkmark-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyListText}>No reported damage tickets.</Text>
                            <Text style={styles.emptyListSub}>Everything is operational in your stall(s).</Text>
                        </View>
                    }
                />
            )}

            {/* ========================================================= */}
            {/* TICKET DETAILS MODAL (Dismisses Badge on Close) */}
            {/* ========================================================= */}
            <Modal
                visible={showDetailsModal}
                transparent
                animationType="slide"
                onRequestClose={handleCloseDetails}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.detailCard}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.detailModalTitle}>{selectedDetailTicket?.title}</Text>
                                <Text style={styles.bannerSub}>
                                    Category: {selectedDetailTicket?.category?.replace('_', ' ')}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleCloseDetails} style={styles.closeCircleBtn}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
                            {/* Current Status Banner */}
                            <View style={[
                                styles.detailStatusBanner,
                                selectedDetailTicket?.status === 'completed'
                                    ? styles.detailBannerCompleted
                                    : selectedDetailTicket?.status === 'in_progress'
                                        ? styles.detailBannerProgress
                                        : styles.detailBannerPending
                            ]}>
                                <Ionicons
                                    name={
                                        selectedDetailTicket?.status === 'completed'
                                            ? 'checkmark-done-circle'
                                            : selectedDetailTicket?.status === 'in_progress'
                                                ? 'construct'
                                                : 'time'
                                    }
                                    size={22}
                                    color={
                                        selectedDetailTicket?.status === 'completed'
                                            ? '#059669'
                                            : selectedDetailTicket?.status === 'in_progress'
                                                ? '#0284c7'
                                                : '#d97706'
                                    }
                                />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.detailStatusText}>
                                        Status: {selectedDetailTicket?.status?.replace('_', ' ').toUpperCase()}
                                    </Text>
                                    <Text style={styles.detailStatusSub}>
                                        {selectedDetailTicket?.status === 'completed'
                                            ? 'This reported issue has been successfully resolved and signed off.'
                                            : selectedDetailTicket?.status === 'in_progress'
                                                ? 'Technicians have been assigned and repair works are underway.'
                                                : 'Awaiting management dispatch.'}
                                    </Text>
                                </View>
                            </View>

                            {/* Details Grid */}
                            <View style={styles.detailGrid}>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.detailGridLabel}>Stall Number</Text>
                                    <Text style={styles.detailGridValue}>
                                        {selectedDetailTicket?.stall_number ? `Stall ${selectedDetailTicket.stall_number}` : 'Your Stall'}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.detailGridLabel}>Priority</Text>
                                    <Text style={[styles.detailGridValue, { textTransform: 'uppercase' }]}>
                                        {selectedDetailTicket?.priority || 'Medium'}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.detailGridLabel}>Date Reported</Text>
                                    <Text style={styles.detailGridValue}>
                                        {selectedDetailTicket?.created_at ? new Date(selectedDetailTicket.created_at).toLocaleDateString() : 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.detailGridLabel}>Assigned Technician</Text>
                                    <Text style={styles.detailGridValue}>
                                        {selectedDetailTicket?.assigned_to || 'Maintenance Team'}
                                    </Text>
                                </View>
                            </View>

                            {/* Issue Description */}
                            <Text style={styles.sectionHeader}>Issue Description</Text>
                            <View style={styles.descBox}>
                                <Text style={styles.descText}>{selectedDetailTicket?.description}</Text>
                            </View>

                            {/* Admin Resolution Notes */}
                            <Text style={styles.sectionHeader}>Management Resolution & Notes</Text>
                            <View style={[
                                styles.descBox,
                                selectedDetailTicket?.resolution_notes && { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }
                            ]}>
                                <Text style={[
                                    styles.descText,
                                    selectedDetailTicket?.resolution_notes && { color: '#065f46', fontWeight: '500' }
                                ]}>
                                    {selectedDetailTicket?.resolution_notes || 'No resolution notes logged yet. Personnel will update upon inspection.'}
                                </Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.closeModalBtn}
                            onPress={handleCloseDetails}
                        >
                            <Text style={styles.closeModalBtnText}>Close & Back to List</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ========================================================= */}
            {/* REPORT ISSUE BOTTOM SHEET MODAL */}
            {/* ========================================================= */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={undefined}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Report Stall Damage</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* MULTI-STALL SELECTOR */}
                            <Text style={styles.formLabel}>Select Stall to Report *</Text>
                            {myRentedStalls.length > 1 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                                    {myRentedStalls.map((s) => {
                                        const isSelected = selectedStallToReport?.stall_id === s.stall_id;
                                        return (
                                            <TouchableOpacity
                                                key={s.stall_id}
                                                style={[
                                                    styles.stallPillSelect,
                                                    isSelected && styles.stallPillSelectActive
                                                ]}
                                                onPress={() => setSelectedStallToReport(s)}
                                            >
                                                <Ionicons
                                                    name={isSelected ? 'checkmark-circle' : 'storefront-outline'}
                                                    size={15}
                                                    color={isSelected ? '#fff' : theme.colors.primary}
                                                />
                                                <Text style={[
                                                    styles.stallPillSelectText,
                                                    isSelected && styles.stallPillSelectTextActive
                                                ]}>
                                                    {s.stall_number}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            ) : (
                                <View style={styles.singleStallNotice}>
                                    <Ionicons name="storefront" size={16} color={theme.colors.primary} />
                                    <Text style={styles.singleStallNoticeText}>
                                        Reporting for: <Text style={{ fontWeight: 'bold' }}>{myRentedStalls[0]?.stall_number}</Text> ({myRentedStalls[0]?.location})
                                    </Text>
                                </View>
                            )}

                            <Text style={styles.formLabel}>Issue Title / Summary</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. Front shutter lock jammed"
                                placeholderTextColor="#94a3b8"
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text style={styles.formLabel}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {['roof_leak', 'electrical', 'plumbing', 'structural', 'pest_control', 'general'].map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.categoryPill, category === c && styles.categoryPillActive]}
                                        onPress={() => setCategory(c)}
                                    >
                                        <Text style={[styles.categoryPillText, category === c && styles.categoryPillTextActive]}>
                                            {c.replace('_', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.formLabel}>Priority Level</Text>
                            <View style={styles.priorityRow}>
                                {['low', 'medium', 'high', 'urgent'].map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.priorityPill, priority === p && styles.priorityPillActive]}
                                        onPress={() => setPriority(p)}
                                    >
                                        <Text style={[styles.priorityPillText, priority === p && styles.priorityPillTextActive]}>
                                            {p}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.formLabel}>Detailed Damage Description</Text>
                            <TextInput
                                style={[styles.formInput, { height: 80 }]}
                                multiline
                                placeholder="Describe the issue in detail..."
                                placeholderTextColor="#94a3b8"
                                value={description}
                                onChangeText={setDescription}
                            />

                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={handleCreateTicket}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#0f172a" />
                                ) : (
                                    <Text style={styles.submitBtnText}>
                                        Submit Ticket for {selectedStallToReport?.stall_number || 'Stall'} 🔧
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    topBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
    },
    bannerStall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    bannerSub: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    newReportBtn: {
        backgroundColor: theme.colors.warning,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: theme.borderRadius.full,
        ...theme.shadows.sm
    },
    newReportBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    applySmallBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: theme.borderRadius.full
    },
    applySmallBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold'
    },
    noActiveRentCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        ...theme.shadows.sm
    },
    noActiveRentIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    noActiveRentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8
    },
    noActiveRentSub: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24
    },
    applyNowBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm
    },
    applyNowBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    listContainer: {
        padding: theme.spacing.md,
        paddingBottom: 30
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: theme.colors.textMuted
    },
    emptyList: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60
    },
    emptyListText: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    emptyListSub: {
        marginTop: 4,
        fontSize: 12,
        color: theme.colors.textMuted
    },
    ticketCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        position: 'relative',
        ...theme.shadows.sm
    },
    ticketCardHighlighted: {
        borderColor: '#38bdf8',
        borderWidth: 1.5,
        shadowColor: '#0284c7',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3
    },
    ticketNotifBadge: {
        position: 'absolute',
        top: -9,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 10,
        zIndex: 10,
        elevation: 4
    },
    badgeSuccess: {
        backgroundColor: '#10b981'
    },
    badgeProgress: {
        backgroundColor: '#0284c7'
    },
    ticketNotifBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.4
    },
    ticketHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    categoryIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#fef3c7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    ticketTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    ticketCategory: {
        fontSize: 11,
        color: theme.colors.textMuted,
        textTransform: 'capitalize',
        marginTop: 1
    },
    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full
    },
    statusPillCompleted: {
        backgroundColor: theme.colors.successLight
    },
    statusPillProgress: {
        backgroundColor: '#e0f2fe'
    },
    statusPillPending: {
        backgroundColor: theme.colors.warningLight
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        color: theme.colors.text
    },
    ticketDesc: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginBottom: 8,
        lineHeight: 17
    },
    resolutionBox: {
        backgroundColor: '#f0fdf4',
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.success,
        padding: 8,
        borderRadius: 4,
        marginBottom: 8
    },
    resolutionLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: theme.colors.success
    },
    resolutionText: {
        fontSize: 11,
        color: '#166534',
        marginTop: 2
    },
    ticketFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 8
    },
    priorityText: {
        fontSize: 11,
        color: theme.colors.textMuted
    },
    tapToViewText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.primary
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    bottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: theme.borderRadius.xl,
        borderTopRightRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        maxHeight: '85%'
    },
    detailCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: theme.borderRadius.xl,
        borderTopRightRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        maxHeight: '90%'
    },
    sheetHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#cbd5e1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: theme.spacing.md
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    detailModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    closeCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailStatusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
        borderWidth: 1
    },
    detailBannerCompleted: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0'
    },
    detailBannerProgress: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd'
    },
    detailBannerPending: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a'
    },
    detailStatusText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    detailStatusSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2
    },
    detailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14
    },
    detailGridBox: {
        width: '48%',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    detailGridLabel: {
        fontSize: 10,
        color: '#94a3b8'
    },
    detailGridValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 2
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 6
    },
    descBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12
    },
    descText: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 18
    },
    closeModalBtn: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        marginTop: 6
    },
    closeModalBtnText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '600'
    },
    formLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 6
    },
    formInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.sm,
        marginBottom: theme.spacing.md,
        fontSize: 13,
        color: theme.colors.text
    },
    stallPillSelect: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.borderRadius.full,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginRight: 8
    },
    stallPillSelectActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary
    },
    stallPillSelectText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text
    },
    stallPillSelectTextActive: {
        color: '#fff',
        fontWeight: 'bold'
    },
    singleStallNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        padding: 10,
        borderRadius: 8,
        marginBottom: 14
    },
    singleStallNoticeText: {
        fontSize: 12,
        color: '#166534'
    },
    categoryPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: theme.borderRadius.full,
        backgroundColor: '#f1f5f9',
        marginRight: 6,
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    categoryPillActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary
    },
    categoryPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted,
        textTransform: 'capitalize'
    },
    categoryPillTextActive: {
        color: '#fff'
    },
    priorityRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: theme.spacing.md
    },
    priorityPill: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    priorityPillActive: {
        backgroundColor: theme.colors.warning,
        borderColor: theme.colors.warning
    },
    priorityPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted,
        textTransform: 'capitalize'
    },
    priorityPillTextActive: {
        color: '#0f172a',
        fontWeight: 'bold'
    },
    submitBtn: {
        backgroundColor: theme.colors.warning,
        paddingVertical: 14,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        marginBottom: 20
    },
    submitBtnText: {
        color: '#0f172a',
        fontWeight: 'bold',
        fontSize: 14
    }
});

export default MaintenanceScreen;
