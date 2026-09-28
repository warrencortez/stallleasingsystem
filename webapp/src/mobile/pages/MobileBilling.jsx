import React, { useState, useEffect } from 'react';
import { paymentAPI, tenantAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import MobileHeader from '../components/MobileHeader';
import {
    FaCreditCard,
    FaMoneyBillWave,
    FaReceipt,
    FaCheckCircle,
    FaHistory,
    FaClock,
    FaStore,
    FaTimes,
    FaExternalLinkAlt,
    FaFileInvoiceDollar
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MobileBilling = () => {
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [tenantProfile, setTenantProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid', 'history', 'stalls_history'

    // Digital Receipt Modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    useEffect(() => {
        loadBillingData();
    }, []);

    const loadBillingData = async () => {
        try {
            setLoading(true);
            const [tenRes, payRes] = await Promise.allSettled([
                tenantAPI.getAll(),
                paymentAPI.getAll()
            ]);

            let myTenant = null;
            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                const list = tenRes.value.data.data || [];
                myTenant = list.find((t) => t.email?.toLowerCase() === user?.email?.toLowerCase());
                if (myTenant) {
                    setTenantProfile(myTenant);
                }
            }

            if (payRes.status === 'fulfilled' && payRes.value.data?.success) {
                // The API scopes invoices to the authenticated account, including lease history.
                setPayments(payRes.value.data.data || []);
            }
        } catch (error) {
            console.error('Error loading billing:', error);
            toast.error('Failed to load billing invoices');
        } finally {
            setLoading(false);
        }
    };

    // PayMongo Online Checkout Trigger
    const handlePaymongoCheckout = async (payment) => {
        try {
            toast.loading('Connecting to PayMongo Gateway...', { id: 'pm-load' });
            const res = await paymentAPI.createPaymongoCheckout(payment.id);
            toast.dismiss('pm-load');

            if (res.data?.success) {
                const { checkoutUrl } = res.data.data;
                toast.success('Opening PayMongo Secure Checkout');
                window.open(checkoutUrl, '_blank');
            } else {
                toast.error('Could not initiate PayMongo checkout');
            }
        } catch (error) {
            toast.dismiss('pm-load');
            console.error('PayMongo error:', error);
            toast.error('PayMongo gateway connection failed.');
        }
    };

    const handleViewReceipt = (payment) => {
        setSelectedReceipt(payment);
        setShowReceiptModal(true);
    };

    const unpaidInvoices = payments.filter((p) => p.status !== 'paid');
    const paidInvoices = payments.filter((p) => p.status === 'paid');

    return (
        <>
            <MobileHeader title="Billings & PayMongo" subtitle="Pay rent online & view official receipts" />

            <div className="mobile-content">
                {/* Navigation Pills */}
                <div className="d-flex gap-2 mb-3">
                    <button
                        onClick={() => setActiveTab('unpaid')}
                        className={`btn btn-sm flex-fill rounded-pill fw-bold ${
                            activeTab === 'unpaid' ? 'btn-primary shadow-sm' : 'btn-white border text-muted'
                        }`}
                    >
                        Active Invoices ({unpaidInvoices.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`btn btn-sm flex-fill rounded-pill fw-bold ${
                            activeTab === 'history' ? 'btn-primary shadow-sm' : 'btn-white border text-muted'
                        }`}
                    >
                        Receipts ({paidInvoices.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('stalls_history')}
                        className={`btn btn-sm flex-fill rounded-pill fw-bold ${
                            activeTab === 'stalls_history' ? 'btn-primary shadow-sm' : 'btn-white border text-muted'
                        }`}
                    >
                        Leases
                    </button>
                </div>

                {/* ========================================================= */}
                {/* TAB 1: UNPAID ACTIVE INVOICES */}
                {/* ========================================================= */}
                {activeTab === 'unpaid' && (
                    <div>
                        {loading ? (
                            <div className="text-center py-5 text-muted">
                                <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                                Checking billing invoices...
                            </div>
                        ) : unpaidInvoices.length === 0 ? (
                            <div className="mobile-card text-center py-5">
                                <FaCheckCircle size={42} className="text-success mb-2" />
                                <h5 className="fw-bold text-dark mb-1">All Caught Up!</h5>
                                <p className="text-muted small mb-0">No outstanding rent or overdue bills for your stall.</p>
                            </div>
                        ) : (
                            unpaidInvoices.map((inv) => (
                                <div key={inv.id} className="mobile-card p-3 border-start border-4 border-primary">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <h5 className="fw-bold text-dark mb-0">{inv.stall_number || 'STALL LEASE'}</h5>
                                            <small className="text-muted">{inv.description || 'Monthly Rental'}</small>
                                        </div>
                                        <span className="badge bg-warning text-dark text-uppercase">
                                            {inv.status}
                                        </span>
                                    </div>

                                    <div className="bg-light p-3 rounded-3 mb-3 d-flex justify-content-between align-items-center">
                                        <div>
                                            <span className="text-muted small d-block">Amount Due</span>
                                            <h4 className="fw-bold text-dark mb-0">₱{Number(inv.amount).toLocaleString()}</h4>
                                        </div>
                                        <div className="text-end">
                                            <span className="text-muted small d-block">Due Date</span>
                                            <span className="fw-semibold text-danger small font-monospace">
                                                {new Date(inv.due_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* PayMongo Payment Trigger */}
                                    <button
                                        onClick={() => handlePaymongoCheckout(inv)}
                                        className="btn btn-paymongo w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                    >
                                        <FaCreditCard /> Pay Online with PayMongo
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ========================================================= */}
                {/* TAB 2: SETTLED INVOICES / RECEIPTS */}
                {/* ========================================================= */}
                {activeTab === 'history' && (
                    <div>
                        {paidInvoices.length === 0 ? (
                            <div className="mobile-card text-center py-4 text-muted">
                                <p className="mb-0">No settled payments recorded yet.</p>
                            </div>
                        ) : (
                            paidInvoices.map((inv) => (
                                <div key={inv.id} className="mobile-card p-3 mb-2">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <h6 className="fw-bold text-dark mb-0">{inv.stall_number || 'STALL LEASE'}</h6>
                                            <small className="text-muted font-monospace">{inv.reference_number || 'OR-PAID'}</small>
                                        </div>
                                        <span className="badge bg-success">PAID</span>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center py-2 border-top border-bottom my-2">
                                        <span className="text-muted small">Settled Amount:</span>
                                        <strong className="text-success">₱{Number(inv.amount).toLocaleString()}</strong>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center">
                                        <small className="text-muted text-capitalize">
                                            Via: {inv.payment_method?.replace('_', ' ') || 'PayMongo'}
                                        </small>
                                        <button
                                            onClick={() => handleViewReceipt(inv)}
                                            className="btn btn-outline-primary btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center gap-1"
                                        >
                                            <FaReceipt /> View Receipt
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ========================================================= */}
                {/* TAB 3: RENTED STALLS HISTORY */}
                {/* ========================================================= */}
                {activeTab === 'stalls_history' && (
                    <div>
                        <div className="mobile-card p-3">
                            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                                <FaStore className="text-primary" /> Lease Contract History
                            </h6>

                            {tenantProfile ? (
                                <div className="p-3 bg-light rounded-3 border">
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted small">Stall Assigned:</span>
                                        <strong className="text-dark">{tenantProfile.stall_number}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted small">Business Name:</span>
                                        <strong className="text-dark">{tenantProfile.business_name}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted small">Monthly Lease:</span>
                                        <strong className="text-success">₱{Number(tenantProfile.monthly_rent).toLocaleString()}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-muted small">Contract Term:</span>
                                        <span className="small text-dark">
                                            {tenantProfile.lease_start ? new Date(tenantProfile.lease_start).toLocaleDateString() : 'Active'} to{' '}
                                            {tenantProfile.lease_end ? new Date(tenantProfile.lease_end).toLocaleDateString() : 'Ongoing'}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-muted small">Lease Status:</span>
                                        <span className="badge bg-success text-capitalize">{tenantProfile.status || 'Active'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-muted small text-center py-4">
                                    No active commercial stall assigned yet. Apply for a stall on the Stalls page!
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* DIGITAL RECEIPT MODAL */}
            {/* ========================================================= */}
            {showReceiptModal && selectedReceipt && (
                <div className="mobile-modal-overlay" onClick={() => setShowReceiptModal(false)}>
                    <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sheet-handle"></div>

                        <div className="text-center mb-3">
                            <div className="bg-success text-white rounded-circle d-inline-flex p-3 mb-2 shadow">
                                <FaCheckCircle size={32} />
                            </div>
                            <h5 className="fw-bold text-dark mb-0">Official Digital Receipt</h5>
                            <small className="text-muted font-monospace">{selectedReceipt.reference_number || 'SETTLED'}</small>
                        </div>

                        <div className="bg-light p-3 rounded-3 border mb-3 small">
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Tenant / Business:</span>
                                <strong className="text-dark">{selectedReceipt.tenant_name || user?.name}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Stall Space:</span>
                                <strong className="text-dark">{selectedReceipt.stall_number}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Description:</span>
                                <span className="text-dark">{selectedReceipt.description || 'Monthly Rental'}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Payment Channel:</span>
                                <span className="text-capitalize text-dark">{selectedReceipt.payment_method?.replace('_', ' ') || 'PayMongo'}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Settlement Date:</span>
                                <span className="text-dark">{new Date(selectedReceipt.payment_date || selectedReceipt.updated_at).toLocaleDateString()}</span>
                            </div>
                            <div className="d-flex justify-content-between pt-2 border-top">
                                <span className="fw-bold text-dark">Total Paid:</span>
                                <h5 className="fw-bold text-success mb-0">₱{Number(selectedReceipt.amount).toLocaleString()}</h5>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowReceiptModal(false)}
                            className="btn btn-primary w-100 py-3 rounded-4 fw-bold"
                        >
                            Done / Close Receipt
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileBilling;
