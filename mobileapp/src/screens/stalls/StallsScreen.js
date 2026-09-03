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

const StallsScreen = ({ navigation, route }) => {
    const { user } = useAuth();
    const [stalls, setStalls] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'available', 'my_lease', 'occupied'
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [myStallIds, setMyStallIds] = useState([]);
    const [appliedStallIds, setAppliedStallIds] = useState([]);
    const [viewedStallIds, setViewedStallIds] = useState([]);

    // Apply Modal
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [selectedStall, setSelectedStall] = useState(null);
    const [fullName, setFullName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [businessType, setBusinessType] = useState('retail');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Detail Modal (opened on card tap or approval banner)
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailStall, setSelectedDetailStall] = useState(null);

    // Load viewed stalls from storage
    useEffect(() => {
        const loadViewed = async () => {
            try {
                const stored = await AsyncStorage.getItem(`@viewed_stalls_${user?.id}`);
                if (stored) {
                    setViewedStallIds(JSON.parse(stored));
                }
            } catch (err) {
                // silent
            }
        };
        loadViewed();
    }, [user?.id]);

    // Instantly refresh stalls whenever navigating into Stalls tab
    useFocusEffect(
        useCallback(() => {
            loadStalls(true);
        }, [user?.email])
    );

    useEffect(() => {
        loadStalls();

        // Fast auto-polling every 2.5 seconds so newly created/approved stalls appear immediately
        const interval = setInterval(() => {
            loadStalls(true);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    const loadStalls = async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            const [stallsRes, tenRes, appsRes] = await Promise.allSettled([
                api.get('/stalls'),
                api.get('/tenants'),
                api.get('/applications')
            ]);

            if (stallsRes.status === 'fulfilled' && stallsRes.value.data?.success) {
                setStalls(stallsRes.value.data.data || []);
            }

            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                const list = tenRes.value.data.data || [];
                // Support multiple stalls rented by the tenant
                const myTenancies = list.filter((t) =>
                    (t.email?.toLowerCase() === user?.email?.toLowerCase() || (t.user_id && t.user_id === user?.id)) &&
                    t.status === 'active' &&
                    t.stall_id
                );
                setMyStallIds(myTenancies.map((t) => t.stall_id));
            }

            if (appsRes.status === 'fulfilled' && appsRes.value.data?.success) {
                const myApps = appsRes.value.data.data || [];
                const ids = myApps.map((a) => a.stall_id).filter(Boolean);
                setAppliedStallIds(ids);
            }
        } catch (error) {
            console.error('Error loading stalls:', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-open highlighted stall if directed from Application Approved banner
    useEffect(() => {
        const targetId = route?.params?.highlightStallId;
        if (targetId && stalls.length > 0) {
            const targetStall = stalls.find((s) => String(s.id) === String(targetId));
            if (targetStall) {
                handleOpenDetails(targetStall);
            }
        }
    }, [route?.params?.highlightStallId, stalls]);

    const isStallNew = (stall) => {
        if (!stall) return false;
        if (route?.params?.highlightStallId && String(stall.id) === String(route.params.highlightStallId)) {
            return true;
        }
        if (viewedStallIds.includes(stall.id)) {
            return false;
        }
        if (stall.created_at) {
            const diffDays = (new Date() - new Date(stall.created_at)) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
        }
        return true;
    };

    const handleOpenDetails = (stall) => {
        setSelectedDetailStall(stall);
        setShowDetailModal(true);
    };

    const handleCloseDetails = async () => {
        if (selectedDetailStall) {
            const id = selectedDetailStall.id;
            if (!viewedStallIds.includes(id)) {
                const updated = [...viewedStallIds, id];
                setViewedStallIds(updated);
                try {
                    await AsyncStorage.setItem(`@viewed_stalls_${user?.id}`, JSON.stringify(updated));
                } catch (err) {}
            }
        }
        if (route?.params?.highlightStallId) {
            navigation.setParams({ highlightStallId: null });
        }
        setShowDetailModal(false);
        setSelectedDetailStall(null);
    };

    const handleOpenApply = (stall) => {
        setSelectedStall(stall);
        setFullName(user?.name || '');
        setEmail(user?.email || '');
        setNotes(`Application for ${stall.stall_number}`);
        setShowApplyModal(true);
    };

    const handleSubmitApplication = async () => {
        if (!fullName.trim() || !email.trim() || !phone.trim() || !businessName.trim()) {
            Alert.alert('Missing Fields', 'Please complete all required fields.');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                stall_id: selectedStall.id,
                full_name: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                business_name: businessName.trim(),
                business_type: businessType,
                notes: notes.trim()
            };

            const res = await api.post('/applications', payload);
            if (res.data?.success) {
                // Immediately track as applied
                setAppliedStallIds((prev) => [...prev, selectedStall.id]);
                Alert.alert(
                    'Application Sent! 🎉',
                    'Your lease application was submitted. The admin has been notified for review.'
                );
                setShowApplyModal(false);
                loadStalls(true);
            } else {
                Alert.alert('Submission Error', res.data?.message || 'Failed to submit application');
            }
        } catch (error) {
            Alert.alert('Error', 'Unable to reach backend. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredStalls = stalls.filter((s) => {
        const matchesSearch =
            s.stall_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.location?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filter === 'available') return s.status === 'available';
        if (filter === 'occupied') return s.status === 'occupied';
        if (filter === 'my_lease') return myStallIds.includes(s.id);

        return true;
    });

    // Sort Hierarchy: 1. Active Leases -> 2. New Stalls -> 3. Alphabetical order
    const sortedStalls = [...filteredStalls].sort((a, b) => {
        const aIsMyLease = myStallIds.includes(a.id);
        const bIsMyLease = myStallIds.includes(b.id);
        if (aIsMyLease && !bIsMyLease) return -1;
        if (!aIsMyLease && bIsMyLease) return 1;

        const aIsNew = isStallNew(a);
        const bIsNew = isStallNew(b);
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;

        return (a.stall_number || '').localeCompare(b.stall_number || '', undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });

    const renderStallItem = ({ item }) => {
        const isMyLease = myStallIds.includes(item.id);
        const isAvailable = item.status === 'available';
        const isApplied = appliedStallIds.includes(item.id);
        const hasNewBadge = isStallNew(item);

        return (
            <TouchableOpacity
                style={[
                    styles.stallCard,
                    hasNewBadge && styles.stallCardNewHighlight,
                    isMyLease && styles.stallCardActiveLease
                ]}
                onPress={() => handleOpenDetails(item)}
                activeOpacity={0.85}
            >
                {/* Top Notification Badge */}
                {hasNewBadge && (
                    <View style={[styles.newBadgeRow, isMyLease && { backgroundColor: '#10b981' }]}>
                        <Ionicons name="sparkles" size={11} color="#fff" />
                        <Text style={styles.newBadgeRowText}>
                            {isMyLease ? 'NEW APPROVED LEASE' : 'NEW STALL'}
                        </Text>
                    </View>
                )}

                <View style={styles.stallCardHeader}>
                    <View>
                        <Text style={styles.stallNumber}>{item.stall_number}</Text>
                        <Text style={styles.stallLocation}>
                            <Ionicons name="location-outline" size={12} color={theme.colors.primary} /> {item.location || 'Commercial Complex'}
                        </Text>
                    </View>
                    <View style={[
                        styles.statusBadge,
                        isMyLease ? styles.badgeMyLease : isAvailable ? styles.badgeAvailable : styles.badgeOccupied
                    ]}>
                        <Text style={styles.statusBadgeText}>
                            {isMyLease ? 'My Active Lease' : item.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.stallSpecsRow}>
                    <View style={styles.specBox}>
                        <Text style={styles.specLabel}>Monthly Rate</Text>
                        <Text style={styles.specValueRate}>₱{Number(item.monthly_rent).toLocaleString()}/mo</Text>
                    </View>
                    <View style={styles.specBox}>
                        <Text style={styles.specLabel}>Size / Dimensions</Text>
                        <Text style={styles.specValue}>{item.floor_area_sqm ? `${item.floor_area_sqm} sqm` : (item.size || '20 sqm')}</Text>
                    </View>
                </View>

                {item.description ? (
                    <Text style={styles.stallDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}

                {/* Dynamic Action / Applied Button */}
                {isMyLease ? (
                    <View style={styles.myLeaseNotice}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                        <Text style={styles.myLeaseNoticeText}>✓ Active Lease (Your Stall)</Text>
                    </View>
                ) : isApplied ? (
                    <View style={styles.appliedNotice}>
                        <Ionicons name="checkmark-done-circle" size={16} color="#059669" />
                        <Text style={styles.appliedNoticeText}>✓ Applied (Under Review)</Text>
                    </View>
                ) : isAvailable ? (
                    <TouchableOpacity
                        style={styles.applyBtn}
                        onPress={() => handleOpenApply(item)}
                    >
                        <Ionicons name="document-text-outline" size={16} color="#fff" />
                        <Text style={styles.applyBtnText}>Apply to Rent This Stall</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.unavailableNotice}>
                        <Text style={styles.unavailableNoticeText}>Currently Leased / Unavailable</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search stall number or zone..."
                        placeholderTextColor="#94a3b8"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                </View>

                {/* Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                            All ({stalls.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterPill, filter === 'available' && styles.filterPillActive]}
                        onPress={() => setFilter('available')}
                    >
                        <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>
                            🟢 Available
                        </Text>
                    </TouchableOpacity>
                    {myStallIds.length > 0 && (
                        <TouchableOpacity
                            style={[styles.filterPill, filter === 'my_lease' && styles.filterPillActive]}
                            onPress={() => setFilter('my_lease')}
                        >
                            <Text style={[styles.filterText, filter === 'my_lease' && styles.filterTextActive]}>
                                🏷️ My Lease
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.filterPill, filter === 'occupied' && styles.filterPillActive]}
                        onPress={() => setFilter('occupied')}
                    >
                        <Text style={[styles.filterText, filter === 'occupied' && styles.filterTextActive]}>
                            🔴 Occupied
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading commercial stalls...</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedStalls}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderStallItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyList}>
                            <Ionicons name="storefront-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyListText}>No stalls found matching your filter.</Text>
                        </View>
                    }
                />
            )}

            {/* ========================================================= */}
            {/* STALL DETAILS MODAL (Dismisses "NEW" Badge on Return) */}
            {/* ========================================================= */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="slide"
                onRequestClose={handleCloseDetails}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.detailCard}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.detailModalTitle}>
                                    Stall {selectedDetailStall?.stall_number}
                                </Text>
                                <Text style={styles.stallLocation}>
                                    <Ionicons name="location-outline" size={13} color={theme.colors.primary} />{' '}
                                    {selectedDetailStall?.location || 'Commercial Complex'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleCloseDetails} style={styles.closeCircleBtn}>
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 12 }}>
                            {myStallIds.includes(selectedDetailStall?.id) && (
                                <View style={styles.approvedLeaseBanner}>
                                    <Ionicons name="checkmark-done-circle" size={20} color="#10b981" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.approvedLeaseBannerTitle}>Active Lease Confirmed</Text>
                                        <Text style={styles.approvedLeaseBannerSub}>
                                            Your lease application for this stall was approved by management!
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.detailGrid}>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.specLabel}>Monthly Lease</Text>
                                    <Text style={styles.detailRentValue}>
                                        ₱{Number(selectedDetailStall?.monthly_rent || 0).toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.specLabel}>Floor Area</Text>
                                    <Text style={styles.detailSpecValue}>
                                        {selectedDetailStall?.floor_area_sqm ? `${selectedDetailStall.floor_area_sqm} sqm` : (selectedDetailStall?.size || '20 sqm')}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.specLabel}>Current Status</Text>
                                    <Text style={[styles.detailSpecValue, { textTransform: 'capitalize', color: selectedDetailStall?.status === 'available' ? '#059669' : '#dc2626' }]}>
                                        {selectedDetailStall?.status}
                                    </Text>
                                </View>
                                <View style={styles.detailGridBox}>
                                    <Text style={styles.specLabel}>Lease Application</Text>
                                    <Text style={styles.detailSpecValue}>
                                        {myStallIds.includes(selectedDetailStall?.id) ? 'Active Tenant' : appliedStallIds.includes(selectedDetailStall?.id) ? 'Applied' : 'Open'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.sectionHeader}>Description & Overview</Text>
                            <Text style={styles.detailDescText}>
                                {selectedDetailStall?.description || 'Prime commercial retail space featuring high customer footfall, modern standard electrical fixtures, and convenient access to complex amenities.'}
                            </Text>
                        </ScrollView>

                        {/* Bottom Actions inside details modal */}
                        <View style={styles.detailActionsRow}>
                            {selectedDetailStall?.status === 'available' && !appliedStallIds.includes(selectedDetailStall?.id) && !myStallIds.includes(selectedDetailStall?.id) ? (
                                <TouchableOpacity
                                    style={styles.detailApplyBtn}
                                    onPress={() => {
                                        const stallToApply = selectedDetailStall;
                                        handleCloseDetails();
                                        handleOpenApply(stallToApply);
                                    }}
                                >
                                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                                    <Text style={styles.applyBtnText}>Apply to Rent This Stall</Text>
                                </TouchableOpacity>
                            ) : appliedStallIds.includes(selectedDetailStall?.id) ? (
                                <View style={[styles.appliedNotice, { flex: 1, paddingVertical: 12 }]}>
                                    <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
                                    <Text style={styles.appliedNoticeText}>✓ Application Submitted (Under Review)</Text>
                                </View>
                            ) : myStallIds.includes(selectedDetailStall?.id) ? (
                                <View style={[styles.myLeaseNotice, { flex: 1, paddingVertical: 12 }]}>
                                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                                    <Text style={styles.myLeaseNoticeText}>✓ Currently Rented by You</Text>
                                </View>
                            ) : (
                                <View style={[styles.unavailableNotice, { flex: 1, paddingVertical: 12 }]}>
                                    <Text style={styles.unavailableNoticeText}>Currently Leased / Unavailable</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.backToListBtn}
                                onPress={handleCloseDetails}
                            >
                                <Text style={styles.backToListBtnText}>Back to Stalls List</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================= */}
            {/* APPLY TO RENT BOTTOM SHEET MODAL */}
            {/* ========================================================= */}
            <Modal
                visible={showApplyModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowApplyModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={undefined}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Apply for {selectedStall?.stall_number}</Text>
                            <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.rateAlert}>
                                <Text style={styles.rateAlertText}>
                                    Monthly Rate: ₱{Number(selectedStall?.monthly_rent || 0).toLocaleString()}
                                </Text>
                            </View>

                            <Text style={styles.formLabel}>Full Applicant Name</Text>
                            <TextInput
                                style={styles.formInput}
                                value={fullName}
                                onChangeText={setFullName}
                            />

                            <Text style={styles.formLabel}>Email Address</Text>
                            <TextInput
                                style={styles.formInput}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                            />

                            <Text style={styles.formLabel}>Mobile Number</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="+63 920 123 4567"
                                placeholderTextColor="#94a3b8"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.formLabel}>Proposed Business Name</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. Maria's Cafe"
                                placeholderTextColor="#94a3b8"
                                value={businessName}
                                onChangeText={setBusinessName}
                            />

                            <Text style={styles.formLabel}>Business Notes / Concept</Text>
                            <TextInput
                                style={[styles.formInput, { height: 70 }]}
                                multiline
                                placeholder="Merchandise, operating schedule..."
                                placeholderTextColor="#94a3b8"
                                value={notes}
                                onChangeText={setNotes}
                            />

                            <TouchableOpacity
                                style={styles.modalSubmitBtn}
                                onPress={handleSubmitApplication}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalSubmitBtnText}>Submit Application to Admin 🚀</Text>
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
    searchSection: {
        backgroundColor: '#fff',
        padding: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.md,
        height: 40,
        marginBottom: theme.spacing.sm
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 13,
        color: theme.colors.text
    },
    filterScroll: {
        flexDirection: 'row'
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: theme.borderRadius.full,
        backgroundColor: '#f1f5f9',
        marginRight: 6,
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    filterPillActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary
    },
    filterText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted
    },
    filterTextActive: {
        color: '#fff'
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
        fontSize: 13,
        color: theme.colors.textMuted
    },
    stallCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        position: 'relative',
        ...theme.shadows.sm
    },
    stallCardNewHighlight: {
        borderColor: '#38bdf8',
        borderWidth: 1.5,
        shadowColor: '#0284c7',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3
    },
    stallCardActiveLease: {
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary
    },
    newBadgeRow: {
        position: 'absolute',
        top: -9,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#0284c7',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 10,
        zIndex: 10,
        elevation: 4
    },
    newBadgeRowText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.4
    },
    stallCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm
    },
    stallNumber: {
        fontSize: 17,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    stallLocation: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full
    },
    badgeAvailable: {
        backgroundColor: theme.colors.successLight
    },
    badgeOccupied: {
        backgroundColor: theme.colors.dangerLight
    },
    badgeMyLease: {
        backgroundColor: theme.colors.primaryLight
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: theme.colors.text
    },
    stallSpecsRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.sm,
        marginBottom: theme.spacing.sm
    },
    specBox: {
        flex: 1
    },
    specLabel: {
        fontSize: 10,
        color: theme.colors.textMuted
    },
    specValue: {
        fontSize: 13,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 2
    },
    specValueRate: {
        fontSize: 13,
        fontWeight: 'bold',
        color: theme.colors.success,
        marginTop: 2
    },
    stallDesc: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.md,
        lineHeight: 16
    },
    applyBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm
    },
    applyBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13
    },
    myLeaseNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: theme.colors.primaryLight,
        paddingVertical: 10,
        borderRadius: theme.borderRadius.sm
    },
    myLeaseNoticeText: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: 'bold'
    },
    appliedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingVertical: 10,
        borderRadius: theme.borderRadius.sm
    },
    appliedNoticeText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: 'bold'
    },
    unavailableNotice: {
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: theme.borderRadius.sm
    },
    unavailableNoticeText: {
        color: theme.colors.textMuted,
        fontSize: 12
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
    closeCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    rateAlert: {
        backgroundColor: theme.colors.successLight,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.sm,
        marginBottom: theme.spacing.md
    },
    rateAlertText: {
        color: theme.colors.success,
        fontWeight: 'bold',
        fontSize: 13,
        textAlign: 'center'
    },
    formLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4
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
    modalSubmitBtn: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 14,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        marginBottom: 20
    },
    modalSubmitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    detailCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: theme.borderRadius.xl,
        borderTopRightRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        maxHeight: '90%'
    },
    detailModalTitle: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    approvedLeaseBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12
    },
    approvedLeaseBannerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#065f46'
    },
    approvedLeaseBannerSub: {
        fontSize: 11,
        color: '#047857',
        marginTop: 1
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
    detailRentValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#059669',
        marginTop: 2
    },
    detailSpecValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 6
    },
    detailDescText: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 18,
        marginBottom: 14
    },
    detailActionsRow: {
        gap: 8,
        marginTop: 6
    },
    detailApplyBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md
    },
    backToListBtn: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 11,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center'
    },
    backToListBtnText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '600'
    }
});

export default StallsScreen;
