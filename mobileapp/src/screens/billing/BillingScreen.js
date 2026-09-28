import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    ScrollView,
    TextInput
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';
import { theme } from '../../styles/theme';

const PAYMENT_CHANNELS = [
    { id: 'gcash', label: 'GCash (E-Wallet)', icon: 'phone-portrait-outline', color: '#007DFE' },
    { id: 'paymaya', label: 'Maya (E-Wallet)', icon: 'wallet-outline', color: '#059669' },
    { id: 'bpi_online', label: 'BPI Online Banking', icon: 'business-outline', color: '#DC2626' },
    { id: 'card', label: 'Credit / Debit Card', icon: 'card-outline', color: '#1E293B' },
    { id: 'grab_pay', label: 'GrabPay (E-Wallet)', icon: 'car-outline', color: '#10B981' },
    { id: 'bank_transfer', label: 'Bank Transfer (BPI / BDO)', icon: 'swap-horizontal-outline', color: '#0284C7' },
    { id: 'cash', label: 'Cash Counter Deposit', icon: 'cash-outline', color: '#64748B' }
];

const BillingScreen = () => {
    const { user } = useAuth();
    const [loadError, setLoadError] = useState('');
    const [payments, setPayments] = useState([]);
    const [tenantProfile, setTenantProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid', 'history', 'stalls_history'

    // Payment Checkout Modal
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('gcash');
    const [customRefNumber, setCustomRefNumber] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);

    // Digital Receipt Modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    useEffect(() => {
        loadBilling(true);
        // Fast real-time polling every 5 seconds
        const poll = setInterval(() => {
            loadBilling(false);
        }, 5000);
        return () => clearInterval(poll);
    }, []);

    const loadBilling = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const [tenRes, payRes] = await Promise.allSettled([
                api.get('/tenants'),
                api.get('/payments')
            ]);

            if (payRes.status === 'rejected') throw payRes.reason;
            setLoadError('');
            let myTenant = null;
            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                const list = tenRes.value.data.data || [];
                myTenant = list.find((t) => t.user_id === user?.id && t.status === 'active');
                setTenantProfile(myTenant || null);
            }

            if (payRes.status === 'fulfilled' && payRes.value.data?.success) {
                // The API scopes invoices to the authenticated account, including lease history.
                setPayments(payRes.value.data.data || []);
            }
        } catch (error) {
            setLoadError('Unable to load your bills. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    // Open Payment Channel Modal
    const handleOpenPayModal = (payment) => {
        setSelectedPayment(payment);
        setSelectedChannel('gcash');
        setCustomRefNumber('');
        setShowPayModal(true);
    };

    // Execute Payment Settlement
    const handleConfirmPayment = async () => {
        if (!selectedPayment) return;
        try {
            setProcessingPayment(true);
            const refNo = customRefNumber.trim();
            if (!refNo) { Alert.alert('Reference required', 'Enter the reference from your actual payment.'); return; }
            
            // Record payment to backend
            const res = await api.patch(`/payments/${selectedPayment.id}/record`, {
                payment_method: selectedChannel,
                reference_number: refNo
            });

            if (res.data?.success) {
                setShowPayModal(false);
                Alert.alert('Submitted for review', 'Your payment is pending staff verification. A receipt will be available once it is approved.');
                loadBilling(false);
            } else {
                Alert.alert('Payment Error', res.data?.message || 'Failed to complete transaction.');
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to process payment with server.');
        } finally {
            setProcessingPayment(false);
        }
    };

    // Pay with PayMongo Gateway Browser Checkout
    const handlePaymongoGatewayCheckout = async () => {
        if (!selectedPayment) return;
        try {
            setProcessingPayment(true);
            const res = await api.post(`/payments/${selectedPayment.id}/paymongo-checkout`);
            if (res.data?.success) {
                const { checkoutUrl, checkoutId } = res.data.data;
                setShowPayModal(false);
                await WebBrowser.openBrowserAsync(checkoutUrl);
                const verification = await api.post(`/payments/${selectedPayment.id}/verify-paymongo`, { checkout_id: checkoutId });
                if (verification.data?.data?.status === 'paid') Alert.alert('Payment confirmed', 'Your payment has been verified.');
                loadBilling(false);
            } else {
                Alert.alert('PayMongo Error', 'Unable to initiate PayMongo gateway session.');
            }
        } catch (error) {
            Alert.alert('Payment not confirmed', error.response?.data?.message || 'Unable to verify payment. Refresh billing before trying again.');
            loadBilling(false);
        } finally {
            setProcessingPayment(false);
        }
    };

    const unpaidInvoices = payments.filter((p) => p.status !== 'paid');
    const paidInvoices = payments.filter((p) => p.status === 'paid');

    const renderUnpaidItem = ({ item }) => (
        <View style={styles.invoiceCard}>
            <View style={styles.invoiceTop}>
                <View>
                    <Text style={styles.invoiceStall}>{item.stall_number || 'COMMERCIAL STALL'}</Text>
                    <Text style={styles.invoiceDesc}>{item.description || 'Monthly Stall Rental Fee'}</Text>
                </View>
                <View style={[styles.unpaidPill, item.status === 'overdue' ? styles.overduePill : null]}>
                    <Text style={[styles.unpaidPillText, item.status === 'overdue' ? styles.overduePillText : null]}>
                        {item.status}
                    </Text>
                </View>
            </View>

            <View style={styles.amountBox}>
                <View>
                    <Text style={styles.amountLabel}>Total Amount Due</Text>
                    <Text style={styles.amountVal}>₱{(Number(item.amount) + Number(item.late_fee || 0)).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Due Date</Text>
                    <Text style={styles.dueDateVal}>{new Date(item.due_date).toLocaleDateString()}</Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.paymongoBtn}
                onPress={() => handleOpenPayModal(item)}
            >
                <Ionicons name="card" size={18} color="#fff" />
                <Text style={styles.paymongoBtnText}>Select Payment Method & Pay</Text>
            </TouchableOpacity>
            <Text style={styles.paymongoChannelsText}>
                Supports GCash • Maya • BPI Online • GrabPay • Debit/Credit Cards
            </Text>
        </View>
    );

    const renderPaidItem = ({ item }) => {
        const channel = PAYMENT_CHANNELS.find((c) => c.id === item.payment_method) || { label: item.payment_method?.replace('_', ' ').toUpperCase() || 'Digital Pay' };
        return (
            <View style={styles.historyCard}>
                <View style={styles.historyTop}>
                    <View>
                        <Text style={styles.historyStall}>{item.stall_number || 'COMMERCIAL STALL'}</Text>
                        <Text style={styles.historyRef}>Ref: {item.reference_number || 'SETTLED'}</Text>
                    </View>
                    <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#059669" />
                        <Text style={styles.paidBadgeText}>PAID</Text>
                    </View>
                </View>

                <View style={styles.historyMid}>
                    <Text style={styles.historyPaidLabel}>Settled Amount:</Text>
                    <Text style={styles.historyPaidVal}>₱{(Number(item.amount) + Number(item.late_fee || 0)).toLocaleString()}</Text>
                </View>

                <View style={styles.historyBottom}>
                    <Text style={styles.historyMethod}>Mode: {channel.label}</Text>
                    <TouchableOpacity
                        style={styles.receiptBtn}
                        onPress={() => {
                            setSelectedReceipt(item);
                            setShowReceiptModal(true);
                        }}
                    >
                        <Ionicons name="receipt-outline" size={14} color={theme.colors.primary} />
                        <Text style={styles.receiptBtnText}>View Receipt</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Tab Pills */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'unpaid' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('unpaid')}
                >
                    <Text style={[styles.tabBtnText, activeTab === 'unpaid' && styles.tabBtnTextActive]}>
                        Active Bills ({unpaidInvoices.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
                        Receipts ({paidInvoices.length})
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'stalls_history' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('stalls_history')}
                >
                    <Text style={[styles.tabBtnText, activeTab === 'stalls_history' && styles.tabBtnTextActive]}>
                        My Lease
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : loadError ? (
                <View style={styles.emptyCard}><Text>{loadError}</Text><TouchableOpacity onPress={() => loadBilling(true)}><Text>Retry</Text></TouchableOpacity></View>
            ) : activeTab === 'unpaid' ? (
                <FlatList
                    data={unpaidInvoices}
                    keyExtractor={(item) => item.id}
                    renderItem={renderUnpaidItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyCard}>
                            <Ionicons name="checkmark-done-circle" size={48} color={theme.colors.success} />
                            <Text style={styles.emptyTitle}>All Caught Up!</Text>
                            <Text style={styles.emptySub}>No outstanding rent or overdue bills for your stall.</Text>
                        </View>
                    }
                />
            ) : activeTab === 'history' ? (
                <FlatList
                    data={paidInvoices}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPaidItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyCard}>
                            <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>No Receipts Yet</Text>
                            <Text style={styles.emptySub}>Settled invoices will appear here.</Text>
                        </View>
                    }
                />
            ) : (
                <ScrollView contentContainerStyle={styles.listContainer}>
                    <View style={styles.leaseCard}>
                        <Text style={styles.leaseTitle}>Commercial Lease Agreement</Text>
                        {tenantProfile ? (
                            <View style={styles.leaseDetails}>
                                <View style={styles.leaseRow}>
                                    <Text style={styles.leaseLabel}>Assigned Space:</Text>
                                    <Text style={styles.leaseVal}>{tenantProfile.stall_number}</Text>
                                </View>
                                <View style={styles.leaseRow}>
                                    <Text style={styles.leaseLabel}>Business Entity:</Text>
                                    <Text style={styles.leaseVal}>{tenantProfile.business_name}</Text>
                                </View>
                                <View style={styles.leaseRow}>
                                    <Text style={styles.leaseLabel}>Monthly Rent:</Text>
                                    <Text style={styles.leaseValRate}>₱{Number(tenantProfile.monthly_rent).toLocaleString()}</Text>
                                </View>
                                <View style={styles.leaseRow}>
                                    <Text style={styles.leaseLabel}>Lease Period:</Text>
                                    <Text style={styles.leaseVal}>{`${tenantProfile.contract_start ? new Date(tenantProfile.contract_start).toLocaleDateString() : 'Start not set'} - ${tenantProfile.contract_end ? new Date(tenantProfile.contract_end).toLocaleDateString() : 'Ongoing'}`}</Text>
                                </View>
                                <View style={styles.leaseRow}>
                                    <Text style={styles.leaseLabel}>Account Status:</Text>
                                    <Text style={styles.leaseStatusPill}>{tenantProfile.status || 'Active'}</Text>
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.emptySub}>No active commercial stall assigned yet.</Text>
                        )}
                    </View>
                </ScrollView>
            )}

            {/* ========================================================= */}
            {/* PAYMENT CHECKOUT SELECTION MODAL */}
            {/* ========================================================= */}
            <Modal
                visible={showPayModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPayModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.payBottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.payModalHeader}>
                            <Text style={styles.payModalTitle}>Select Payment Method</Text>
                            <Text style={styles.payModalSub}>
                                Settling rent for <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{selectedPayment?.stall_number}</Text> (₱{(Number(selectedPayment?.amount || 0) + Number(selectedPayment?.late_fee || 0)).toLocaleString()})
                            </Text>
                        </View>

                        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {PAYMENT_CHANNELS.map((ch) => {
                                const isSelected = selectedChannel === ch.id;
                                return (
                                    <TouchableOpacity
                                        key={ch.id}
                                        style={[styles.channelOption, isSelected && styles.channelOptionSelected]}
                                        onPress={() => setSelectedChannel(ch.id)}
                                    >
                                        <View style={[styles.channelIconBox, { backgroundColor: ch.color + '15' }]}>
                                            <Ionicons name={ch.icon} size={20} color={ch.color} />
                                        </View>
                                        <Text style={[styles.channelLabel, isSelected && styles.channelLabelSelected]}>
                                            {ch.label}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Reference Number Field */}
                        <View style={styles.refInputContainer}>
                            <Text style={styles.refInputLabel}>Receipt / Bank Reference No.</Text>
                            <TextInput
                                style={styles.refInput}
                                value={customRefNumber}
                                onChangeText={setCustomRefNumber}
                                placeholder="e.g. GCASH-10928374"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={styles.payActionsRow}>
                            <TouchableOpacity
                                style={styles.confirmPayBtn}
                                onPress={handleConfirmPayment}
                                disabled={processingPayment}
                            >
                                {processingPayment ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-done" size={18} color="#fff" />
                                        <Text style={styles.confirmPayBtnText}>Submit for Verification</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.paymongoGatewayBtn}
                                onPress={handlePaymongoGatewayCheckout}
                                disabled={processingPayment}
                            >
                                <Ionicons name="globe-outline" size={16} color="#059669" />
                                <Text style={styles.paymongoGatewayBtnText}>PayMongo Portal</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.cancelPayBtn}
                            onPress={() => setShowPayModal(false)}
                            disabled={processingPayment}
                        >
                            <Text style={styles.cancelPayBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ========================================================= */}
            {/* DIGITAL RECEIPT MODAL */}
            {/* ========================================================= */}
            <Modal
                visible={showReceiptModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReceiptModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.receiptHeader}>
                            <View style={styles.receiptSuccessIcon}>
                                <Ionicons name="checkmark-circle" size={36} color="#059669" />
                            </View>
                            <Text style={styles.receiptModalTitle}>Official Payment Receipt</Text>
                            <Text style={styles.receiptModalRef}>Ref: {selectedReceipt?.reference_number || 'SETTLED'}</Text>
                        </View>

                        <View style={styles.receiptDetailsBox}>
                            <View style={styles.receiptRow}>
                                <Text style={styles.receiptLabel}>Tenant Name:</Text>
                                <Text style={styles.receiptVal}>{selectedReceipt?.tenant_name || user?.name}</Text>
                            </View>
                            <View style={styles.receiptRow}>
                                <Text style={styles.receiptLabel}>Commercial Space:</Text>
                                <Text style={styles.receiptVal}>{selectedReceipt?.stall_number || 'Assigned Stall'}</Text>
                            </View>
                            <View style={styles.receiptRow}>
                                <Text style={styles.receiptLabel}>Payment Mode:</Text>
                                <Text style={styles.receiptVal}>
                                    {PAYMENT_CHANNELS.find((c) => c.id === selectedReceipt?.payment_method)?.label || selectedReceipt?.payment_method?.replace('_', ' ').toUpperCase() || 'Digital Settle'}
                                </Text>
                            </View>
                            <View style={styles.receiptRow}>
                                <Text style={styles.receiptLabel}>Settlement Date:</Text>
                                <Text style={styles.receiptVal}>{new Date(selectedReceipt?.payment_date || selectedReceipt?.updated_at || Date.now()).toLocaleDateString()}</Text>
                            </View>
                            <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                                <Text style={styles.receiptTotalLabel}>Amount Paid:</Text>
                                <Text style={styles.receiptTotalVal}>₱{(Number(selectedReceipt?.amount || 0) + Number(selectedReceipt?.late_fee || 0)).toLocaleString()}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.closeReceiptBtn}
                            onPress={() => setShowReceiptModal(false)}
                        >
                            <Text style={styles.closeReceiptBtnText}>Close Receipt</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    tabContainer: {
        flexDirection: 'row',
        padding: theme.spacing.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: 6
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: theme.borderRadius.full,
        backgroundColor: '#f1f5f9'
    },
    tabBtnActive: {
        backgroundColor: theme.colors.primary
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textMuted
    },
    tabBtnTextActive: {
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
    emptyCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 8
    },
    emptySub: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
        textAlign: 'center'
    },
    invoiceCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    invoiceTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm
    },
    invoiceStall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    invoiceDesc: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    unpaidPill: {
        backgroundColor: theme.colors.warningLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full
    },
    unpaidPillText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#b45309',
        textTransform: 'uppercase'
    },
    overduePill: {
        backgroundColor: '#fee2e2'
    },
    overduePillText: {
        color: '#dc2626'
    },
    amountBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md
    },
    amountLabel: {
        fontSize: 11,
        color: theme.colors.textMuted
    },
    amountVal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 2
    },
    dueDateVal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.danger,
        marginTop: 2
    },
    paymongoBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.md,
        ...theme.shadows.sm
    },
    paymongoBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    paymongoChannelsText: {
        fontSize: 10,
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginTop: 6
    },
    historyCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    historyTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm
    },
    historyStall: {
        fontSize: 15,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    historyRef: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginTop: 2
    },
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#d1fae5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.borderRadius.full
    },
    paidBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#065f46'
    },
    historyMid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginVertical: 4
    },
    historyPaidLabel: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    historyPaidVal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#059669'
    },
    historyBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6
    },
    historyMethod: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted
    },
    receiptBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: '#eff6ff'
    },
    receiptBtnText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: theme.colors.primary
    },
    leaseCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm
    },
    leaseTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: theme.spacing.md
    },
    leaseDetails: {
        gap: theme.spacing.md
    },
    leaseRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    leaseLabel: {
        fontSize: 13,
        color: theme.colors.textMuted
    },
    leaseVal: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text
    },
    leaseValRate: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#059669'
    },
    leaseStatusPill: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#065f46',
        backgroundColor: '#d1fae5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.full
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end'
    },
    payBottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 36
    },
    bottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16
    },
    payModalHeader: {
        marginBottom: 16
    },
    payModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    payModalSub: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginTop: 4
    },
    channelOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        marginBottom: 8,
        backgroundColor: '#fff'
    },
    channelOptionSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: '#eff6ff'
    },
    channelIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    channelLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1
    },
    channelLabelSelected: {
        color: theme.colors.primary,
        fontWeight: 'bold'
    },
    refInputContainer: {
        marginVertical: 12
    },
    refInputLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginBottom: 4
    },
    refInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: theme.colors.text,
        fontFamily: 'monospace'
    },
    payActionsRow: {
        gap: 8,
        marginTop: 8
    },
    confirmPayBtn: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        ...theme.shadows.sm
    },
    confirmPayBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15
    },
    paymongoGatewayBtn: {
        backgroundColor: '#ecfdf5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    paymongoGatewayBtnText: {
        color: '#059669',
        fontWeight: '600',
        fontSize: 13
    },
    cancelPayBtn: {
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 4
    },
    cancelPayBtnText: {
        fontSize: 13,
        color: theme.colors.textMuted
    },
    receiptHeader: {
        alignItems: 'center',
        marginBottom: 20
    },
    receiptSuccessIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#d1fae5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    receiptModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    receiptModalRef: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
        fontFamily: 'monospace'
    },
    receiptDetailsBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        gap: 10
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    receiptLabel: {
        fontSize: 12,
        color: theme.colors.textMuted
    },
    receiptVal: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text
    },
    receiptTotalRow: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
        marginTop: 4
    },
    receiptTotalLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text
    },
    receiptTotalVal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#059669'
    },
    closeReceiptBtn: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center'
    },
    closeReceiptBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text
    }
});

export default BillingScreen;
