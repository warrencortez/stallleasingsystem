import React, { useState, useEffect } from 'react';
import { paymentAPI, tenantAPI, stallAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../common/ConfirmModal';
import {
    FaCreditCard,
    FaFileInvoiceDollar,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaSearch,
    FaFilter,
    FaEye,
    FaMoneyBillWave,
    FaReceipt,
    FaStore,
    FaUser,
    FaCalendarAlt,
    FaPlus,
    FaFileAlt,
    FaHistory,
    FaTimes,
    FaCheck,
    FaShieldAlt,
    FaMobileAlt,
    FaUniversity,
    FaCoins
} from 'react-icons/fa';
import toast from 'react-hot-toast';

// Helper to format payment method into clear human-readable mode (removing "PayMongo" gateway label)
const formatPaymentMode = (method) => {
    if (!method) return { label: 'Unpaid / Pending', badge: 'bg-secondary', icon: <FaClock /> };
    const m = method.toLowerCase();

    if (m.includes('gcash')) {
        return { label: 'GCash (E-Wallet)', badge: 'bg-primary text-white', icon: <FaMobileAlt /> };
    }
    if (m.includes('maya') || m.includes('paymaya')) {
        return { label: 'Maya (E-Wallet)', badge: 'bg-success text-white', icon: <FaMobileAlt /> };
    }
    if (m.includes('card') || m.includes('credit')) {
        return { label: 'Credit / Debit Card', badge: 'bg-dark text-white', icon: <FaCreditCard /> };
    }
    if (m.includes('grab')) {
        return { label: 'GrabPay (E-Wallet)', badge: 'bg-success text-white', icon: <FaMobileAlt /> };
    }
    if (m.includes('bpi')) {
        return { label: 'BPI Online Banking', badge: 'bg-danger text-white', icon: <FaUniversity /> };
    }
    if (m.includes('unionbank')) {
        return { label: 'UnionBank Online', badge: 'bg-warning text-dark', icon: <FaUniversity /> };
    }
    if (m.includes('bank') || m.includes('transfer')) {
        return { label: 'Bank Transfer (BPI / BDO)', badge: 'bg-info text-dark', icon: <FaUniversity /> };
    }
    if (m.includes('cash')) {
        return { label: 'Cash Counter Deposit', badge: 'bg-secondary text-white', icon: <FaCoins /> };
    }

    return {
        label: method.replace(/paymongo_/i, '').replace(/_/g, ' ').toUpperCase(),
        badge: 'bg-primary text-white',
        icon: <FaReceipt />
    };
};

const PaymentList = () => {
    const { isAdmin, isStaff } = useAuth();
    const [viewMode, setViewMode] = useState('stalls_dues'); // 'stalls_dues' | 'payment_history'
    const [stallsOverview, setStallsOverview] = useState([]);
    const [payments, setPayments] = useState([]);
    const [stats, setStats] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Modals
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showStallHistoryModal, setShowStallHistoryModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [selectedStallHistory, setSelectedStallHistory] = useState(null);
    const [stallHistoryPayments, setStallHistoryPayments] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Confirmation Modal State
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {},
        details: []
    });

    // Form states
    const [billMonth, setBillMonth] = useState(new Date().getMonth() + 1);
    const [billYear, setBillYear] = useState(new Date().getFullYear());
    const [newBill, setNewBill] = useState({
        tenant_id: '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0],
        description: 'Monthly Lease Rental'
    });

    // Initial load and auto-polling every 5 seconds
    useEffect(() => {
        loadData(true);
        const poll = setInterval(() => {
            loadData(false);
        }, 5000);
        return () => clearInterval(poll);
    }, [statusFilter, viewMode]);

    const loadData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const [stallsRes, paymentsRes, statsRes, tenantsRes] = await Promise.all([
                paymentAPI.getStallsOverview(),
                paymentAPI.getAll(statusFilter ? { status: statusFilter } : {}),
                paymentAPI.getStats(),
                tenantAPI.getAll({ status: 'active' })
            ]);

            if (stallsRes.data?.success) setStallsOverview(stallsRes.data.data || []);
            if (paymentsRes.data?.success) setPayments(paymentsRes.data.data || []);
            if (statsRes.data?.success) setStats(statsRes.data.data || null);
            if (tenantsRes.data?.success) setTenants(tenantsRes.data.data || []);
        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Open Stall Payment History
    const handleViewStallHistory = async (stall) => {
        setSelectedStallHistory(stall);
        setShowStallHistoryModal(true);
        setLoadingHistory(true);
        try {
            const res = await paymentAPI.getAll({ stall_id: stall.id || stall.stall_id });
            if (res.data?.success) {
                setStallHistoryPayments(res.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching stall payments:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Open Receipt Inspection Modal
    const handleInspectReceipt = (payment) => {
        setSelectedReceipt(payment);
        setShowReceiptModal(true);
    };

    // Generate monthly invoices batch
    const handleGenerateMonthlyInvoices = async (e) => {
        e.preventDefault();
        try {
            const res = await paymentAPI.generateBills({ month: billMonth, year: billYear });
            if (res.data?.success) {
                toast.success(`Generated ${res.data.data.generatedCount || 0} monthly invoices.`);
                setShowGenerateModal(false);
                loadData(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to generate monthly bills');
        }
    };

    // Create single custom bill
    const handleCreateBillSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await paymentAPI.create(newBill);
            if (res.data?.success) {
                toast.success('Billing invoice issued successfully');
                setShowCreateModal(false);
                setNewBill({
                    tenant_id: '',
                    amount: '',
                    due_date: new Date().toISOString().split('T')[0],
                    description: 'Monthly Lease Rental'
                });
                loadData(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create invoice');
        }
    };

    // Apply late penalties with professional confirmation modal
    const handleApplyLateFeesPrompt = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Apply Overdue Late Penalties',
            message: 'Are you sure you want to assess and apply standard late penalties to all currently overdue stall rental invoices?',
            type: 'warning',
            confirmText: 'Apply Late Penalties',
            cancelText: 'Cancel',
            details: [
                'Calculates 5% standard overdue fee on past-due invoices.',
                'Updates total payable dues across overdue commercial spaces.',
                'Sends automated payment reminder notification to affected merchants.'
            ],
            onConfirm: async () => {
                try {
                    const res = await paymentAPI.applyLateFees?.() || await paymentAPI.getAll();
                    toast.success('Overdue penalty assessments updated successfully.');
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    loadData(true);
                } catch (error) {
                    toast.error('Failed to apply late penalty assessments.');
                }
            }
        });
    };

    // Filter stalls based on search
    const filteredStalls = stallsOverview.filter((s) => {
        const query = searchTerm.toLowerCase();
        return (
            s.stall_number?.toLowerCase().includes(query) ||
            s.stall_location?.toLowerCase().includes(query) ||
            s.tenant_name?.toLowerCase().includes(query) ||
            s.business_name?.toLowerCase().includes(query)
        );
    });

    // Filter payments history based on search
    const filteredPayments = payments.filter((p) => {
        const query = searchTerm.toLowerCase();
        return (
            p.stall_number?.toLowerCase().includes(query) ||
            p.tenant_name?.toLowerCase().includes(query) ||
            p.business_name?.toLowerCase().includes(query) ||
            p.reference_number?.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FaCreditCard className="text-primary" /> Commercial Stalls Billing & Payment Ledger
                    </h3>
                    <p className="text-muted mb-0">
                        Audit active stall rental dues, view payment methods (GCash, Maya, Bank Transfer, Cards), and inspect official receipts.
                    </p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                    {isAdmin && (
                        <>
                            <button
                                className="btn btn-outline-warning btn-sm d-flex align-items-center gap-2 fw-semibold"
                                onClick={handleApplyLateFeesPrompt}
                            >
                                <FaExclamationTriangle /> Apply Late Fees
                            </button>
                            <button
                                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 fw-semibold"
                                onClick={() => setShowGenerateModal(true)}
                            >
                                <FaCalendarAlt /> Generate Monthly Dues
                            </button>
                            <button
                                className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <FaPlus /> Create Custom Bill
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Quick KPI Overview */}
            {stats && (
                <div className="row g-3 mb-4">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-success bg-opacity-10 text-success p-3 rounded-circle fs-4">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Total Revenue Collected</span>
                                <h4 className="fw-bold mb-0 text-success">
                                    ₱{Number(stats.total_collected || 0).toLocaleString()}
                                </h4>
                                <small className="text-muted">{stats.paid || 0} Settled Invoices</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-danger bg-opacity-10 text-danger p-3 rounded-circle fs-4">
                                <FaExclamationTriangle />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Total Outstanding Dues</span>
                                <h4 className="fw-bold mb-0 text-danger">
                                    ₱{Number(stats.total_outstanding || 0).toLocaleString()}
                                </h4>
                                <small className="text-danger fw-semibold">{stats.unpaid || 0} Stalls with Balance</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-warning bg-opacity-10 text-warning p-3 rounded-circle fs-4">
                                <FaClock />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Today's Unpaid Dues</span>
                                <h4 className="fw-bold mb-0 text-warning">
                                    ₱{Number(stats.today_unpaid_amount || 0).toLocaleString()}
                                </h4>
                                <small className="text-muted">{stats.today_unpaid_count || 0} Dues Matured Today</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary p-3 rounded-circle fs-4">
                                <FaReceipt />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Overdue Invoices</span>
                                <h4 className="fw-bold mb-0 text-dark">{stats.overdue || 0}</h4>
                                <small className="text-muted">Subject to Late Penalties</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode Switcher & Search Bar */}
            <div className="card shadow-sm border-0 rounded-4 bg-white p-3 mb-4">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-5">
                        <div className="btn-group w-100 p-1 bg-light rounded-3 border">
                            <button
                                className={`btn btn-sm rounded-3 fw-bold ${
                                    viewMode === 'stalls_dues' ? 'btn-primary shadow-sm' : 'btn-light text-muted'
                                }`}
                                onClick={() => setViewMode('stalls_dues')}
                            >
                                <FaStore className="me-1" /> Stalls Dues & Rent Master (Top Priority)
                            </button>
                            <button
                                className={`btn btn-sm rounded-3 fw-bold ${
                                    viewMode === 'payment_history' ? 'btn-primary shadow-sm' : 'btn-light text-muted'
                                }`}
                                onClick={() => setViewMode('payment_history')}
                            >
                                <FaHistory className="me-1" /> All Payments & Receipts Ledger
                            </button>
                        </div>
                    </div>

                    <div className="col-12 col-md-4">
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light border-end-0">
                                <FaSearch className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 bg-light"
                                placeholder="Search stall #, tenant name, or ref..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-12 col-md-3 d-flex justify-content-md-end">
                        {viewMode === 'payment_history' && (
                            <select
                                className="form-select form-select-sm"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="paid">Paid & Settled</option>
                                <option value="unpaid">Unpaid / Due</option>
                                <option value="overdue">Overdue</option>
                                <option value="pending_verification">Pending Verification</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW 1: STALLS DUES & MASTER RENT DIRECTORY (DEFAULT)      */}
            {/* ========================================================= */}
            {viewMode === 'stalls_dues' && (
                <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white mb-4">
                    <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">Commercial Stalls Rent & Dues Roster</h6>
                            <small className="text-muted">
                                Stalls with outstanding dues and overdue rents are automatically sorted to the top.
                            </small>
                        </div>
                        <span className="badge bg-light text-primary border">
                            {filteredStalls.length} Stalls Registered
                        </span>
                    </div>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small text-uppercase">
                                <tr>
                                    <th className="ps-4">Stall Space</th>
                                    <th>Occupant / Merchant</th>
                                    <th>Contract Rent</th>
                                    <th>Current Active Due</th>
                                    <th>Total Outstanding</th>
                                    <th>Latest Settled Mode</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            <div className="spinner-border text-primary spinner-border-sm me-2" />
                                            Loading stalls dues directory...
                                        </td>
                                    </tr>
                                ) : filteredStalls.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            No commercial stalls found matching query.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStalls.map((s) => {
                                        const hasActiveDue = s.active_due_status === 'unpaid' || s.active_due_status === 'overdue';
                                        const isOverdue = s.active_due_status === 'overdue';
                                        const latestMode = formatPaymentMode(s.latest_payment_method);

                                        return (
                                            <tr
                                                key={s.stall_id}
                                                className={
                                                    isOverdue
                                                        ? 'bg-danger bg-opacity-10'
                                                        : hasActiveDue
                                                        ? 'bg-warning bg-opacity-10'
                                                        : ''
                                                }
                                            >
                                                <td className="ps-4">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className={`p-2 rounded-3 text-white ${
                                                                isOverdue ? 'bg-danger' : hasActiveDue ? 'bg-warning text-dark' : 'bg-primary'
                                                            }`}
                                                        >
                                                            <FaStore />
                                                        </div>
                                                        <div>
                                                            <strong className="text-dark d-block">{s.stall_number}</strong>
                                                            <small className="text-muted">{s.stall_location || 'Commercial Area'}</small>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td>
                                                    {s.tenant_name ? (
                                                        <div>
                                                            <div className="fw-semibold text-dark">{s.tenant_name}</div>
                                                            <small className="text-muted">{s.business_name || s.tenant_phone || 'Active Tenant'}</small>
                                                        </div>
                                                    ) : (
                                                        <span className="badge bg-secondary">Vacant / Unassigned</span>
                                                    )}
                                                </td>

                                                <td>
                                                    <strong className="text-dark">
                                                        ₱{Number(s.monthly_rent || 0).toLocaleString()}
                                                    </strong>
                                                    <small className="text-muted d-block text-capitalize">
                                                        /{s.rent_type || 'monthly'}
                                                    </small>
                                                </td>

                                                <td>
                                                    {hasActiveDue ? (
                                                        <div>
                                                            <span
                                                                className={`badge ${
                                                                    isOverdue ? 'bg-danger' : 'bg-warning text-dark'
                                                                } text-uppercase px-2 py-1 mb-1`}
                                                            >
                                                                {s.active_due_status}
                                                            </span>
                                                            <div className="fw-bold text-danger">
                                                                ₱{Number(s.active_due_amount || 0).toLocaleString()}
                                                            </div>
                                                            <small className="text-muted font-monospace" style={{ fontSize: '0.72rem' }}>
                                                                Due: {new Date(s.active_due_date).toLocaleDateString()}
                                                            </small>
                                                        </div>
                                                    ) : (
                                                        <div className="text-success small fw-semibold d-flex align-items-center gap-1">
                                                            <FaCheckCircle /> All Dues Settled
                                                        </div>
                                                    )}
                                                </td>

                                                <td>
                                                    {Number(s.total_unpaid_amount || 0) > 0 ? (
                                                        <div>
                                                            <strong className="text-danger fs-6">
                                                                ₱{Number(s.total_unpaid_amount).toLocaleString()}
                                                            </strong>
                                                            <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                                                                {s.unpaid_invoices_count} Pending Invoices
                                                            </small>
                                                        </div>
                                                    ) : (
                                                        <span className="badge bg-success bg-opacity-10 text-success">₱0.00 Outstanding</span>
                                                    )}
                                                </td>

                                                <td>
                                                    {s.latest_payment_method ? (
                                                        <div>
                                                            <span className={`badge ${latestMode.badge} d-inline-flex align-items-center gap-1 mb-1`}>
                                                                {latestMode.icon} {latestMode.label}
                                                            </span>
                                                            {s.latest_reference_number && (
                                                                <div className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>
                                                                    Ref: {s.latest_reference_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted small">No prior receipts</span>
                                                    )}
                                                </td>

                                                <td className="text-end pe-4">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 rounded-3 fw-semibold shadow-sm"
                                                        onClick={() => handleViewStallHistory(s)}
                                                    >
                                                        <FaHistory /> History & Receipts
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: ALL PAYMENTS & RECEIPTS AUDIT TABLE               */}
            {/* ========================================================= */}
            {viewMode === 'payment_history' && (
                <div className="card shadow-sm border-0 rounded-4 overflow-hidden bg-white mb-4">
                    <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                        <div>
                            <h6 className="fw-bold text-dark mb-0">Complete Receipts & Transactions Ledger</h6>
                            <small className="text-muted">Detailed breakdown of payment modes, reference numbers, and settlement timestamps.</small>
                        </div>
                        <span className="badge bg-light text-primary border">{filteredPayments.length} Records</span>
                    </div>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small text-uppercase">
                                <tr>
                                    <th className="ps-4">Receipt / Ref #</th>
                                    <th>Stall & Merchant</th>
                                    <th>Description</th>
                                    <th>Mode of Payment</th>
                                    <th>Amount Paid</th>
                                    <th>Settlement Date</th>
                                    <th>Status</th>
                                    <th className="text-end pe-4">Inspect Receipt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5 text-muted">
                                            <div className="spinner-border text-primary spinner-border-sm me-2" />
                                            Loading payment transactions...
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5 text-muted">
                                            No payment records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((p) => {
                                        const mode = formatPaymentMode(p.payment_method);
                                        return (
                                            <tr key={p.id}>
                                                <td className="ps-4">
                                                    <span className="font-monospace fw-bold text-dark">
                                                        {p.reference_number || `INV-${p.id.slice(0, 8).toUpperCase()}`}
                                                    </span>
                                                    {p.paymongo_checkout_id && (
                                                        <small className="text-muted d-block font-monospace" style={{ fontSize: '0.68rem' }}>
                                                            PM: {p.paymongo_checkout_id.slice(0, 12)}...
                                                        </small>
                                                    )}
                                                </td>

                                                <td>
                                                    <strong className="text-dark d-block">{p.stall_number || 'Stall Space'}</strong>
                                                    <small className="text-muted">{p.tenant_name || p.business_name || 'Tenant'}</small>
                                                </td>

                                                <td>
                                                    <span className="small text-dark">{p.description || 'Monthly Rental'}</span>
                                                </td>

                                                <td>
                                                    <span className={`badge ${mode.badge} d-inline-flex align-items-center gap-1`}>
                                                        {mode.icon} {mode.label}
                                                    </span>
                                                </td>

                                                <td>
                                                    <strong className="text-success fs-6">
                                                        ₱{Number(p.amount).toLocaleString()}
                                                    </strong>
                                                    {Number(p.late_fee || 0) > 0 && (
                                                        <small className="text-danger d-block font-monospace" style={{ fontSize: '0.7rem' }}>
                                                            +₱{Number(p.late_fee).toLocaleString()} Late Fee
                                                        </small>
                                                    )}
                                                </td>

                                                <td>
                                                    {p.payment_date ? (
                                                        <div>
                                                            <span className="small text-dark fw-semibold">
                                                                {new Date(p.payment_date).toLocaleDateString()}
                                                            </span>
                                                            <small className="text-muted d-block font-monospace" style={{ fontSize: '0.7rem' }}>
                                                                Due: {new Date(p.due_date).toLocaleDateString()}
                                                            </small>
                                                        </div>
                                                    ) : (
                                                        <span className="small text-muted font-monospace">
                                                            Due: {new Date(p.due_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`badge ${
                                                            p.status === 'paid'
                                                                ? 'bg-success'
                                                                : p.status === 'overdue'
                                                                ? 'bg-danger'
                                                                : 'bg-warning text-dark'
                                                        } text-uppercase px-2 py-1`}
                                                    >
                                                        {p.status.replace('_', ' ')}
                                                    </span>
                                                </td>

                                                <td className="text-end pe-4">
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 rounded-3"
                                                        onClick={() => handleInspectReceipt(p)}
                                                        title="View Receipt Details"
                                                    >
                                                        <FaReceipt /> Inspect
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 1: STALL PAYMENT HISTORY & RECEIPTS DRAWER          */}
            {/* ========================================================= */}
            {showStallHistoryModal && selectedStallHistory && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1055 }}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-primary text-white p-3">
                                <div>
                                    <h6 className="modal-title fw-bold mb-0">
                                        Payment & Dues Ledger: {selectedStallHistory.stall_number}
                                    </h6>
                                    <small className="text-white text-opacity-75">
                                        Merchant: {selectedStallHistory.tenant_name || 'No tenant'} • Rate: ₱{Number(selectedStallHistory.monthly_rent || 0).toLocaleString()}/mo
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowStallHistoryModal(false)}
                                />
                            </div>

                            <div className="modal-body p-4 bg-light">
                                <div className="row g-3 mb-4">
                                    <div className="col-4">
                                        <div className="bg-white p-3 rounded-3 border text-center">
                                            <small className="text-muted d-block">Total Settled</small>
                                            <h5 className="fw-bold text-success mb-0 mt-1">
                                                ₱{Number(selectedStallHistory.total_paid_amount || 0).toLocaleString()}
                                            </h5>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-white p-3 rounded-3 border text-center">
                                            <small className="text-muted d-block">Outstanding Balance</small>
                                            <h5 className="fw-bold text-danger mb-0 mt-1">
                                                ₱{Number(selectedStallHistory.total_unpaid_amount || 0).toLocaleString()}
                                            </h5>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-white p-3 rounded-3 border text-center">
                                            <small className="text-muted d-block">Settled Receipts</small>
                                            <h5 className="fw-bold text-primary mb-0 mt-1">
                                                {selectedStallHistory.paid_invoices_count || 0} Invoices
                                            </h5>
                                        </div>
                                    </div>
                                </div>

                                <div className="card border-0 rounded-3 shadow-sm overflow-hidden bg-white">
                                    <div className="p-3 border-bottom">
                                        <h6 className="fw-bold text-dark mb-0">Historical Invoices & Settlement Receipts</h6>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover align-middle mb-0">
                                            <thead className="table-light small">
                                                <tr>
                                                    <th className="ps-3">Reference / Slip #</th>
                                                    <th>Description</th>
                                                    <th>Mode of Payment</th>
                                                    <th>Amount</th>
                                                    <th>Settled Date</th>
                                                    <th>Status</th>
                                                    <th className="text-end pe-3">Receipt</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loadingHistory ? (
                                                    <tr>
                                                        <td colSpan="7" className="text-center py-4 text-muted">
                                                            <div className="spinner-border spinner-border-sm text-primary me-2" />
                                                            Loading history...
                                                        </td>
                                                    </tr>
                                                ) : stallHistoryPayments.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="7" className="text-center py-4 text-muted">
                                                            No past payment records for this stall.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    stallHistoryPayments.map((shp) => {
                                                        const mode = formatPaymentMode(shp.payment_method);
                                                        return (
                                                            <tr key={shp.id}>
                                                                <td className="ps-3 font-monospace small fw-bold">
                                                                    {shp.reference_number || 'PENDING'}
                                                                </td>
                                                                <td className="small">{shp.description}</td>
                                                                <td>
                                                                    <span className={`badge ${mode.badge} d-inline-flex align-items-center gap-1`} style={{ fontSize: '0.7rem' }}>
                                                                        {mode.icon} {mode.label}
                                                                    </span>
                                                                </td>
                                                                <td className="fw-bold text-dark small">
                                                                    ₱{Number(shp.amount).toLocaleString()}
                                                                </td>
                                                                <td className="small text-muted font-monospace">
                                                                    {shp.payment_date ? new Date(shp.payment_date).toLocaleDateString() : `Due: ${new Date(shp.due_date).toLocaleDateString()}`}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${
                                                                        shp.status === 'paid' ? 'bg-success' : 'bg-warning text-dark'
                                                                    } text-uppercase`} style={{ fontSize: '0.65rem' }}>
                                                                        {shp.status}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end pe-3">
                                                                    <button
                                                                        className="btn btn-xs btn-outline-secondary py-0 px-2"
                                                                        onClick={() => handleInspectReceipt(shp)}
                                                                    >
                                                                        Inspect
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer bg-light p-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setShowStallHistoryModal(false)}
                                >
                                    Close Ledger
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: OFFICIAL DIGITAL RECEIPT & BANK AUDIT DETAILS     */}
            {/* ========================================================= */}
            {showReceiptModal && selectedReceipt && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
                >
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-dark text-white p-3 border-0">
                                <div className="d-flex align-items-center gap-2">
                                    <FaReceipt className="text-warning" size={20} />
                                    <h6 className="modal-title fw-bold mb-0">Official Digital Receipt & Verification</h6>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowReceiptModal(false)}
                                />
                            </div>

                            <div className="modal-body p-4 bg-white">
                                <div className="border border-secondary border-opacity-25 rounded-4 p-4 bg-light shadow-sm mb-3">
                                    <div className="text-center border-bottom pb-3 mb-3">
                                        <h5 className="fw-bold text-dark mb-0">LEASEHUB COMMERCIAL CENTER</h5>
                                        <small className="text-muted">Official Payment Receipt & Proof of Settlement</small>
                                        <div className="mt-2">
                                            <span className={`badge ${
                                                selectedReceipt.status === 'paid' ? 'bg-success' : 'bg-warning text-dark'
                                            } text-uppercase px-3 py-1 fw-bold`}>
                                                {selectedReceipt.status === 'paid' ? 'VERIFIED & SETTLED' : selectedReceipt.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="row g-2 small mb-3">
                                        <div className="col-6">
                                            <span className="text-muted d-block">Transaction Ref / Slip #:</span>
                                            <strong className="font-monospace text-primary fs-6">
                                                {selectedReceipt.reference_number || 'OR-PENDING'}
                                            </strong>
                                        </div>
                                        <div className="col-6 text-end">
                                            <span className="text-muted d-block">Settlement Timestamp:</span>
                                            <strong className="font-monospace text-dark">
                                                {selectedReceipt.payment_date
                                                    ? new Date(selectedReceipt.payment_date).toLocaleDateString()
                                                    : 'Not yet recorded'}
                                            </strong>
                                        </div>

                                        <div className="col-6 mt-2">
                                            <span className="text-muted d-block">Commercial Stall:</span>
                                            <strong className="text-dark">{selectedReceipt.stall_number || 'Commercial Space'}</strong>
                                        </div>
                                        <div className="col-6 mt-2 text-end">
                                            <span className="text-muted d-block">Merchant / Tenant:</span>
                                            <strong className="text-dark">{selectedReceipt.tenant_name || 'Merchant'}</strong>
                                        </div>

                                        <div className="col-12 mt-2">
                                            <span className="text-muted d-block">Payment Mode / Channel:</span>
                                            <div className="mt-1">
                                                {(() => {
                                                    const m = formatPaymentMode(selectedReceipt.payment_method);
                                                    return (
                                                        <span className={`badge ${m.badge} p-2 d-inline-flex align-items-center gap-1.5`}>
                                                            {m.icon} {m.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white rounded-3 border mb-3">
                                        <div className="d-flex justify-content-between mb-1 small text-muted">
                                            <span>Invoice Dues Description:</span>
                                            <span>{selectedReceipt.description || 'Monthly Stall Lease'}</span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1 small text-muted">
                                            <span>Rental Amount:</span>
                                            <span>₱{Number(selectedReceipt.amount).toLocaleString()}</span>
                                        </div>
                                        {Number(selectedReceipt.late_fee || 0) > 0 && (
                                            <div className="d-flex justify-content-between mb-1 small text-danger">
                                                <span>Overdue Penalty Assessment:</span>
                                                <span>+₱{Number(selectedReceipt.late_fee).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="d-flex justify-content-between pt-2 border-top fw-bold fs-5 text-success">
                                            <span>Total Paid Amount:</span>
                                            <span>₱{Number(selectedReceipt.amount).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {selectedReceipt.proof_image && (
                                        <div className="border rounded-3 p-2 bg-white text-center">
                                            <small className="text-muted d-block mb-1">Attached Bank Deposit / Transfer Slip Proof:</small>
                                            <img
                                                src={selectedReceipt.proof_image}
                                                alt="Payment Proof"
                                                className="img-fluid rounded border"
                                                style={{ maxHeight: '180px', objectFit: 'contain' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer bg-light p-3 border-0 d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => setShowReceiptModal(false)}
                                >
                                    Close Receipt
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm px-3"
                                    onClick={() => window.print()}
                                >
                                    Print Official Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 3: GENERATE MONTHLY DUES BATCH                      */}
            {/* ========================================================= */}
            {showGenerateModal && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1050 }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Generate Monthly Stall Lease Invoices</h6>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowGenerateModal(false)}
                                />
                            </div>
                            <form onSubmit={handleGenerateMonthlyInvoices}>
                                <div className="modal-body p-4 bg-white">
                                    <p className="text-muted small mb-3">
                                        Automatically generates rental bills for all commercial stalls with active tenants based on their agreed contract rates.
                                    </p>
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Billing Month</label>
                                            <select
                                                className="form-select"
                                                value={billMonth}
                                                onChange={(e) => setBillMonth(Number(e.target.value))}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                    <option key={m} value={m}>
                                                        {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Billing Year</label>
                                            <select
                                                className="form-select"
                                                value={billYear}
                                                onChange={(e) => setBillYear(Number(e.target.value))}
                                            >
                                                {[2025, 2026, 2027, 2028].map((y) => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => setShowGenerateModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold">
                                        Generate Invoices
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 4: CREATE SINGLE CUSTOM BILL                        */}
            {/* ========================================================= */}
            {showCreateModal && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1050 }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Issue Custom Billing Invoice</h6>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowCreateModal(false)}
                                />
                            </div>
                            <form onSubmit={handleCreateBillSubmit}>
                                <div className="modal-body p-4 bg-white">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Select Tenant / Merchant</label>
                                        <select
                                            className="form-select"
                                            required
                                            value={newBill.tenant_id}
                                            onChange={(e) => setNewBill({ ...newBill, tenant_id: e.target.value })}
                                        >
                                            <option value="">-- Choose Tenant --</option>
                                            {tenants.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.stall_number ? `[Stall ${t.stall_number}] ` : ''}{t.name} ({t.business_name || 'Merchant'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Billable Amount (₱)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            required
                                            min="1"
                                            placeholder="e.g. 15000"
                                            value={newBill.amount}
                                            onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Payment Due Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            required
                                            value={newBill.due_date}
                                            onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Description / Purpose</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Monthly Lease Rental, Utility Charge"
                                            value={newBill.description}
                                            onChange={(e) => setNewBill({ ...newBill, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold">
                                        Issue Invoice
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Reusable Confirmation Dialog Modal */}
            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                details={confirmDialog.details}
                onConfirm={confirmDialog.onConfirm}
                onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};

export default PaymentList;