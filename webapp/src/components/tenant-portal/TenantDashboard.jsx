import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { paymentAPI, announcementAPI, tenantAPI } from '../../api/endpoints';
import QRCodeModal from '../common/QRCodeModal';
import {
    FaStore,
    FaMoneyBillWave,
    FaCalendarAlt,
    FaCreditCard,
    FaWrench,
    FaBullhorn,
    FaCheckCircle,
    FaQrcode,
    FaFileInvoice,
    FaExclamationCircle,
    FaHistory
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const TenantDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState(null);
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showQRModal, setShowQRModal] = useState(false);

    useEffect(() => {
        loadTenantData(true);
        const poll = setInterval(() => {
            loadTenantData(false);
        }, 5000);
        return () => clearInterval(poll);
    }, [user]);

    const loadTenantData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);

            // Fetch tenant associated with this email
            const tenantRes = await tenantAPI.getAll({ search: user?.email });
            const tenantList = tenantRes.data?.data || [];
            const currentTenant = tenantList.length > 0 ? tenantList[0] : null;

            if (currentTenant) {
                setTenant(currentTenant);
                const [payRes, sumRes, annRes] = await Promise.all([
                    paymentAPI.getByTenant(currentTenant.id),
                    paymentAPI.getTenantSummary(currentTenant.id),
                    announcementAPI.getAll({ target_audience: 'tenants' })
                ]);

                if (payRes.data?.success) setPayments(payRes.data.data || []);
                if (sumRes.data?.success) setSummary(sumRes.data.data || null);
                if (annRes.data?.success) setAnnouncements(annRes.data.data || []);
            }
        } catch (error) {
            console.error('Error loading tenant portal data:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Quick PayMongo checkout
    const handleQuickPay = async (payment) => {
        try {
            toast.loading('Opening PayMongo Gateway...', { id: 'pm-pay' });
            const res = await paymentAPI.createPaymongoCheckout(payment.id);
            toast.dismiss('pm-pay');

            if (res.data?.success) {
                toast.success('Redirecting to PayMongo Gateway');
                window.open(res.data.data.checkoutUrl, '_blank');
            }
        } catch (error) {
            toast.dismiss('pm-pay');
            toast.error('PayMongo Checkout failed to initialize');
        }
    };

    const unpaidPayment = payments.find((p) => p.status === 'unpaid' || p.status === 'overdue');

    if (loading) {
        return (
            <div className="text-center py-5 text-muted">
                <div className="spinner-border text-primary spinner-border-sm me-2" />
                Loading your stall dashboard...
            </div>
        );
    }

    return (
        <div className="container-fluid p-0">
            {/* Welcome Banner */}
            <div className="modern-card p-4 mb-4 bg-gradient text-white rounded-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div>
                        <span className="badge bg-primary mb-2">Commercial Tenant Portal</span>
                        <h3 className="fw-bold mb-1">Welcome, {tenant?.name || user?.name || 'Valued Tenant'}</h3>
                        <p className="text-white-50 mb-0">
                            {tenant?.business_name || 'Commercial Stall Leaseholder'} • {tenant?.stall_number || 'STALL-A101'}
                        </p>
                    </div>
                    <div className="d-flex gap-2">
                        {tenant && (
                            <button
                                className="btn btn-outline-light d-flex align-items-center gap-2 btn-sm px-3"
                                onClick={() => setShowQRModal(true)}
                            >
                                <FaQrcode /> Stall QR ID
                            </button>
                        )}
                        <button
                            className="btn btn-primary d-flex align-items-center gap-2 btn-sm px-3 fw-semibold shadow-sm"
                            onClick={() => navigate('/tenant/bills')}
                        >
                            <FaCreditCard /> Settle Dues
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick KPI Overview */}
            <div className="row g-3 mb-4">
                {/* Stall Info Card */}
                <div className="col-12 col-md-4">
                    <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                        <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary p-3 rounded-circle fs-4">
                            <FaStore />
                        </div>
                        <div>
                            <span className="text-muted small text-uppercase fw-semibold">My Assigned Stall</span>
                            <h4 className="fw-bold mb-0 text-dark">{tenant?.stall_number || 'STALL-A101'}</h4>
                            <small className="text-muted">{tenant?.location || 'Ground Floor Commercial Area'}</small>
                        </div>
                    </div>
                </div>

                {/* Current Outstanding Balance */}
                <div className="col-12 col-md-4">
                    <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                        <div className="stat-icon-wrapper bg-warning bg-opacity-10 text-warning p-3 rounded-circle fs-4">
                            <FaMoneyBillWave />
                        </div>
                        <div>
                            <span className="text-muted small text-uppercase fw-semibold">Current Balance</span>
                            <h4 className={`fw-bold mb-0 ${Number(summary?.total_balance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                ₱{Number(summary?.total_balance || 0).toLocaleString()}
                            </h4>
                            <small className="text-muted">
                                {Number(summary?.total_balance || 0) > 0 ? 'Payment due soon' : 'All invoices settled'}
                            </small>
                        </div>
                    </div>
                </div>

                {/* Next Due Date */}
                <div className="col-12 col-md-4">
                    <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                        <div className="stat-icon-wrapper bg-info bg-opacity-10 text-info p-3 rounded-circle fs-4">
                            <FaCalendarAlt />
                        </div>
                        <div>
                            <span className="text-muted small text-uppercase fw-semibold">Next Rent Due Date</span>
                            <h4 className="fw-bold mb-0 text-dark">
                                {unpaidPayment ? new Date(unpaidPayment.due_date).toLocaleDateString() : 'End of Month'}
                            </h4>
                            <small className="text-muted">Contract Rate: ₱{Number(tenant?.monthly_rent || 15000).toLocaleString()}/mo</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Columns */}
            <div className="row g-4 mb-4">
                {/* Left: Active Bill & Fast Pay */}
                <div className="col-12 col-lg-7">
                    <div className="modern-card p-4 mb-4 bg-white border rounded-4 shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <FaCreditCard className="text-primary" /> Active Rental Invoice
                            </h5>
                            <span className="badge bg-primary bg-opacity-10 text-primary">PayMongo Gateway</span>
                        </div>

                        {unpaidPayment ? (
                            <div className="bg-light p-4 rounded-4 border">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark mb-1">{unpaidPayment.description || 'Monthly Stall Rent'}</h5>
                                        <div className="text-muted small font-monospace">Due Date: {new Date(unpaidPayment.due_date).toLocaleDateString()}</div>
                                    </div>
                                    <span className={`badge ${
                                        unpaidPayment.status === 'overdue' ? 'bg-danger' : 'bg-warning text-dark'
                                    } text-uppercase px-2 py-1`}>
                                        {unpaidPayment.status}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between align-items-center mb-4 py-2 border-top border-bottom">
                                    <span className="text-muted">Total Payable Amount:</span>
                                    <h3 className="fw-bold text-primary mb-0">₱{Number(unpaidPayment.amount).toLocaleString()}</h3>
                                </div>

                                <div className="d-flex flex-column flex-sm-row gap-2">
                                    <button
                                        className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                                        onClick={() => handleQuickPay(unpaidPayment)}
                                    >
                                        <FaCreditCard /> Pay with PayMongo (GCash • Maya • Cards)
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => navigate('/tenant/bills')}
                                    >
                                        Upload Proof Receipt
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-success bg-opacity-10 rounded-4 p-4 border border-success border-opacity-25">
                                <FaCheckCircle size={40} className="text-success mb-2" />
                                <h6 className="fw-bold text-success">Zero Outstanding Rental Balance</h6>
                                <p className="small text-muted mb-0">Your stall lease payments are completely up to date.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Announcements */}
                <div className="col-12 col-lg-5">
                    <div className="modern-card p-4 bg-white border rounded-4 shadow-sm h-100">
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <FaBullhorn className="text-primary" />
                            <h5 className="fw-bold text-dark mb-0">Market Advisories</h5>
                        </div>
                        {announcements.length === 0 ? (
                            <div className="text-center py-4 text-muted small">
                                No active administrative advisories posted.
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {announcements.slice(0, 3).map((ann) => (
                                    <div key={ann.id} className="p-3 bg-light rounded-3 border">
                                        <h6 className="fw-bold text-dark mb-1">{ann.title}</h6>
                                        <p className="text-muted small mb-2 text-truncate">{ann.content}</p>
                                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                                            <span className="badge bg-secondary text-uppercase">{ann.category?.replace('_', ' ')}</span>
                                            <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* QR Placard Modal */}
            {showQRModal && tenant && (
                <QRCodeModal
                    stall={{
                        id: tenant.stall_id,
                        stall_number: tenant.stall_number,
                        location: tenant.location,
                        tenant_name: tenant.name,
                        size: '20 sqm',
                        monthly_rent: tenant.monthly_rent
                    }}
                    onClose={() => setShowQRModal(false)}
                />
            )}
        </div>
    );
};

export default TenantDashboard;
