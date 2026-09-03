import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { applicationAPI } from '../../api/endpoints';
import ConfirmModal from '../common/ConfirmModal';
import toast from 'react-hot-toast';
import { 
    FaArrowLeft, 
    FaCheck, 
    FaTimes, 
    FaUserPlus, 
    FaStore, 
    FaEnvelope, 
    FaPhone, 
    FaCalendarAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaHourglassHalf,
    FaExclamationCircle
} from 'react-icons/fa';

const ApplicationReview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [confirmAction, setConfirmAction] = useState(null); // 'approved' | 'rejected' | null

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const quickAction = params.get('action');
        if (quickAction === 'approve' || quickAction === 'reject') {
            setConfirmAction(quickAction === 'approve' ? 'approved' : 'rejected');
        }
        fetchApplication();
    }, [id]);

    const fetchApplication = async () => {
        try {
            const response = await applicationAPI.getById(id);
            setApplication(response.data.data);
            if (response.data.data.notes) {
                setNotes(response.data.data.notes);
            }
        } catch (error) {
            toast.error('Failed to fetch application details');
            navigate('/applications');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDecision = async () => {
        if (!confirmAction) return;
        setSubmitting(true);
        try {
            await applicationAPI.review(id, { status: confirmAction, notes });
            toast.success(`Application marked as ${confirmAction.toUpperCase()}`);
            setConfirmAction(null);
            navigate('/applications');
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to review application';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            pending: { color: 'warning text-dark', icon: <FaHourglassHalf className="me-1" />, label: 'Pending Review' },
            approved: { color: 'success', icon: <FaCheckCircle className="me-1" />, label: 'Approved & Leased' },
            rejected: { color: 'danger', icon: <FaTimesCircle className="me-1" />, label: 'Rejected' }
        };
        const c = config[status] || { color: 'secondary', icon: null, label: status };
        return <span className={`badge bg-${c.color} px-3 py-2 d-inline-flex align-items-center`}>{c.icon} {c.label}</span>;
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading application details...</span>
                    </div>
                    <p className="mt-2 text-muted fw-semibold">Loading applicant file...</p>
                </div>
            </div>
        );
    }

    if (!application) {
        return (
            <div className="p-4">
                <div className="alert alert-danger shadow-sm">Application record not found.</div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                    onClick={() => navigate('/applications')}
                >
                    <FaArrowLeft /> Back to Applications
                </button>
                <div>
                    {getStatusBadge(application.status)}
                </div>
            </div>

            <div className="row g-4">
                {/* Left Column: Applicant & Stall Details */}
                <div className="col-lg-8">
                    <div className="card shadow-sm border-0 bg-white rounded-4 mb-4">
                        <div className="card-body p-4">
                            <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2">
                                <FaStore className="text-primary" /> Proposed Space & Lease Terms
                            </h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Commercial Stall</small>
                                    <p className="fw-bold text-dark fs-5 mb-0 mt-1">{application.stall_number || 'STALL-001'}</p>
                                    <small className="text-muted">{application.stall_location || 'Ground Floor'}</small>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Monthly Contract Rent</small>
                                    <p className="fw-bold text-success fs-5 mb-0 mt-1">
                                        ₱{Number(application.monthly_rent || 0).toLocaleString()}
                                    </p>
                                    <small className="text-muted">Space Size: {application.stall_size || '20 sqm'}</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card shadow-sm border-0 bg-white rounded-4">
                        <div className="card-body p-4">
                            <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2">
                                <FaUserPlus className="text-primary" /> Merchant Applicant Profile
                            </h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Full Legal Name</small>
                                    <p className="fw-bold text-dark fs-6 mb-0 mt-1">{application.applicant_name || application.full_name || 'Applicant'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Business Trade Name</small>
                                    <p className="fw-bold text-dark fs-6 mb-0 mt-1">{application.business_name || 'Individual Merchant'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Email Address</small>
                                    <p className="fw-semibold text-muted mb-0 mt-1 d-flex align-items-center gap-1">
                                        <FaEnvelope className="text-primary" /> {application.email || 'N/A'}
                                    </p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Phone Number</small>
                                    <p className="fw-semibold text-muted mb-0 mt-1 d-flex align-items-center gap-1">
                                        <FaPhone className="text-primary" /> {application.phone || 'N/A'}
                                    </p>
                                </div>
                                <div className="col-12">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Line of Business</small>
                                    <p className="fw-semibold text-dark mb-0 mt-1 text-capitalize">{application.business_type || 'General Merchandise'}</p>
                                </div>
                                {application.notes && (
                                    <div className="col-12">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Applicant's Proposal Notes</small>
                                        <div className="p-3 bg-light rounded-3 border mt-1 small text-dark">
                                            {application.notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Decision Action Center */}
                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 bg-white rounded-4 h-100">
                        <div className="card-body p-4 d-flex flex-column justify-content-between">
                            <div>
                                <h5 className="mb-3 fw-bold text-dark">Administrative Decision</h5>
                                
                                {application.status === 'pending' ? (
                                    <>
                                        <div className="mb-3">
                                            <label className="form-label small fw-semibold text-muted">Administrative Assessment Notes</label>
                                            <textarea
                                                className="form-control"
                                                rows="4"
                                                placeholder="Add assessment remarks, lease conditions, or reasons..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                            />
                                        </div>

                                        <div className="d-grid gap-2">
                                            <button
                                                className="btn btn-success btn-lg d-flex align-items-center justify-content-center gap-2 fw-semibold shadow-sm"
                                                onClick={() => setConfirmAction('approved')}
                                                disabled={submitting}
                                            >
                                                <FaCheck />
                                                <span>Approve & Lease Stall</span>
                                            </button>
                                            <button
                                                className="btn btn-danger btn-lg d-flex align-items-center justify-content-center gap-2 fw-semibold shadow-sm"
                                                onClick={() => setConfirmAction('rejected')}
                                                disabled={submitting}
                                            >
                                                <FaTimes />
                                                <span>Reject Application</span>
                                            </button>
                                        </div>

                                        <div className="mt-4 p-3 bg-light rounded-3 border text-muted small">
                                            <div className="d-flex align-items-start gap-2">
                                                <FaExclamationCircle className="text-primary flex-shrink-0 mt-1" />
                                                <div>
                                                    <strong className="text-dark">1-Tenant-Per-Stall Rule:</strong>
                                                    <p className="mb-0 mt-1" style={{ fontSize: '0.8rem' }}>
                                                        Approving automatically assigns this stall to the tenant, marks the stall as Occupied, and auto-rejects any other competing applications.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-muted small mb-2">This application has already been processed.</p>
                                        <span className={`badge bg-${application.status === 'approved' ? 'success' : 'danger'} px-4 py-2 text-uppercase fs-6`}>
                                            {application.status}
                                        </span>
                                        {application.reviewed_at && (
                                            <p className="text-muted small mt-3 mb-0">
                                                Reviewed on {new Date(application.reviewed_at).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decision Confirmation Modal */}
            <ConfirmModal
                isOpen={!!confirmAction}
                title={confirmAction === 'approved' ? `Approve Lease for ${application.applicant_name || 'Applicant'}` : `Reject Application for ${application.applicant_name || 'Applicant'}`}
                message={
                    confirmAction === 'approved'
                        ? `Are you sure you want to approve this lease application for ${application.stall_number || 'the stall'}?`
                        : `Are you sure you want to reject this lease application?`
                }
                type={confirmAction === 'approved' ? 'success' : 'danger'}
                confirmText={confirmAction === 'approved' ? 'Confirm Approval & Lease' : 'Confirm Rejection'}
                cancelText="Cancel"
                loading={submitting}
                details={
                    confirmAction === 'approved'
                        ? [
                            `Stall ${application.stall_number || ''} will be officially marked as Occupied.`,
                            `A commercial tenant record will be created / assigned for ${application.applicant_name || 'the applicant'}.`,
                            `All other competing pending applications for this stall will be automatically rejected.`,
                            `An automated approval notification will be delivered to the tenant.`
                        ]
                        : [
                            'The applicant will be marked as Rejected.',
                            'The stall will remain available for other applications.'
                        ]
                }
                onConfirm={handleConfirmDecision}
                onClose={() => setConfirmAction(null)}
            />
        </div>
    );
};

export default ApplicationReview;