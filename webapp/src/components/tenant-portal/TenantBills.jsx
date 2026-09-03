import React, { useState, useEffect } from 'react';
import { paymentAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
    FaFileInvoiceDollar,
    FaCreditCard,
    FaUpload,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaReceipt,
    FaEye
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const TenantBills = () => {
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showProofModal, setShowProofModal] = useState(false);

    // Upload form
    const [proofFile, setProofFile] = useState(null);
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

    useEffect(() => {
        loadBills(true);
        const poll = setInterval(() => {
            loadBills(false);
        }, 5000);
        return () => clearInterval(poll);
    }, []);

    const loadBills = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const res = await paymentAPI.getAll();
            if (res.data?.success) {
                setPayments(res.data.data || []);
            }
        } catch (error) {
            console.error('Error loading bills:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Trigger PayMongo Online Checkout
    const handlePaymongoCheckout = async (payment) => {
        try {
            toast.loading('Connecting to PayMongo Gateway...', { id: 'pm-bill' });
            const res = await paymentAPI.createPaymongoCheckout(payment.id);
            toast.dismiss('pm-bill');

            if (res.data?.success) {
                toast.success('Redirecting to PayMongo Gateway');
                window.open(res.data.data.checkoutUrl, '_blank');
            }
        } catch (error) {
            toast.dismiss('pm-bill');
            toast.error('Failed to initiate PayMongo payment');
        }
    };

    // Submit proof upload
    const handleProofSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPayment) return;

        try {
            const formData = new FormData();
            if (proofFile) formData.append('proof_image', proofFile);
            formData.append('reference_number', referenceNumber);
            formData.append('payment_method', paymentMethod);

            const res = await paymentAPI.recordPayment(selectedPayment.id, formData);
            if (res.data?.success) {
                toast.success('Payment receipt submitted for verification');
                setShowUploadModal(false);
                setProofFile(null);
                setReferenceNumber('');
                loadBills(true);
            }
        } catch (error) {
            toast.error('Failed to upload payment proof');
        }
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="mb-4 pb-3 border-bottom">
                <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                    <FaFileInvoiceDollar className="text-primary" /> My Monthly Bills & Receipts
                </h3>
                <p className="text-muted mb-0">Pay lease dues directly with PayMongo or upload your bank deposit/transfer receipts.</p>
            </div>

            {/* Invoices List */}
            <div className="row g-3">
                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <div className="spinner-border text-primary spinner-border-sm me-2" />
                        Loading your invoices...
                    </div>
                ) : payments.length === 0 ? (
                    <div className="col-12 text-center py-5 text-muted modern-card bg-white p-5 rounded-4 border">
                        No billing invoices generated yet.
                    </div>
                ) : (
                    payments.map((p) => (
                        <div className="col-12 col-md-6" key={p.id}>
                            <div className="modern-card p-4 h-100 d-flex flex-column justify-content-between bg-white border rounded-4 shadow-sm">
                                <div>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <span className={`badge ${
                                            p.status === 'paid' ? 'bg-success' :
                                            p.status === 'overdue' ? 'bg-danger' : 'bg-warning text-dark'
                                        } text-uppercase px-2 py-1`}>
                                            {p.status.replace('_', ' ')}
                                        </span>
                                        <h4 className="fw-bold text-primary mb-0">₱{Number(p.amount).toLocaleString()}</h4>
                                    </div>
                                    <h5 className="fw-bold text-dark mb-1">{p.description || 'Monthly Stall Lease'}</h5>
                                    <div className="text-muted small mb-3">
                                        Due Date: <strong>{new Date(p.due_date).toLocaleDateString()}</strong>
                                    </div>

                                    {p.payment_date && (
                                        <div className="small text-success mb-2 d-flex align-items-center gap-1">
                                            <FaCheckCircle /> Paid on {new Date(p.payment_date).toLocaleDateString()} via {p.payment_method || 'Online'}
                                        </div>
                                    )}

                                    {p.reference_number && (
                                        <div className="small text-muted mb-3 font-monospace">
                                            Ref: {p.reference_number}
                                        </div>
                                    )}
                                </div>

                                <div className="d-flex flex-wrap gap-2 pt-3 border-top">
                                    {p.status !== 'paid' ? (
                                        <>
                                            <button
                                                className="btn btn-primary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1 fw-semibold"
                                                onClick={() => handlePaymongoCheckout(p)}
                                            >
                                                <FaCreditCard /> Pay with PayMongo (GCash • Maya • Cards)
                                            </button>
                                            <button
                                                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                                onClick={() => {
                                                    setSelectedPayment(p);
                                                    setShowUploadModal(true);
                                                }}
                                            >
                                                <FaUpload /> Upload Receipt
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-outline-success btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                                            disabled
                                        >
                                            <FaCheckCircle /> Payment Completed & Settled
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal: Upload Proof */}
            {showUploadModal && selectedPayment && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Upload Deposit / Bank Transfer Slip</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUploadModal(false)} />
                            </div>
                            <form onSubmit={handleProofSubmit}>
                                <div className="modal-body p-4">
                                    <div className="alert alert-light border small mb-3">
                                        Settling Invoice: <strong>{selectedPayment.description}</strong> (₱{Number(selectedPayment.amount).toLocaleString()})
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Payment Channel</label>
                                        <select
                                            className="form-select"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <option value="bank_transfer">BPI / BDO Bank Transfer</option>
                                            <option value="manual_gcash">GCash Direct Transfer</option>
                                            <option value="manual_maya">Maya Direct Transfer</option>
                                            <option value="cash_counter">Counter Cash Deposit</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Reference Number / Transaction ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. 10029384912"
                                            required
                                            value={referenceNumber}
                                            onChange={(e) => setReferenceNumber(e.target.value)}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Receipt Screenshot / Photo</label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/*"
                                            onChange={(e) => setProofFile(e.target.files[0])}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowUploadModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4">Submit for Verification</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantBills;
