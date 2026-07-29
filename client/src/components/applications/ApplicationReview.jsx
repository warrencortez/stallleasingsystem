import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { applicationAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaCheck, FaTimes, FaUserPlus } from 'react-icons/fa';

const ApplicationReview = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [action, setAction] = useState(null);

    useEffect(() => {
        // Check for quick action from URL params
        const params = new URLSearchParams(location.search);
        const quickAction = params.get('action');
        if (quickAction === 'approve' || quickAction === 'reject') {
            setAction(quickAction);
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

    const handleReview = async (status) => {
        if (!window.confirm(`Are you sure you want to ${status} this application?`)) return;
        
        setSubmitting(true);
        try {
            await applicationAPI.review(id, { status, notes });
            toast.success(`Application ${status} successfully! ✅`);
            navigate('/applications');
        } catch (error) {
            toast.error('Failed to review application');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const config = {
            pending: { color: 'warning', label: 'Pending Review' },
            approved: { color: 'success', label: '✅ Approved' },
            rejected: { color: 'danger', label: '❌ Rejected' }
        };
        const c = config[status] || { color: 'secondary', label: status };
        return <span className={`badge bg-${c.color} px-3 py-2`}>{c.label}</span>;
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading application details...</p>
                </div>
            </div>
        );
    }

    if (!application) {
        return <div className="text-center py-5">Application not found</div>;
    }

    const isPending = application.status === 'pending';

    return (
        <div className="p-4">
            <button
                className="btn btn-outline-secondary mb-4"
                onClick={() => navigate('/applications')}
            >
                <FaArrowLeft className="me-2" />
                Back to Applications
            </button>

            <div className="row g-4">
                {/* Application Details */}
                <div className="col-lg-8">
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start mb-3">
                                <h4 className="mb-0">{application.full_name}</h4>
                                {getStatusBadge(application.status)}
                            </div>

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <small className="text-muted">Email</small>
                                    <p className="fw-bold">{application.email || 'N/A'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted">Phone</small>
                                    <p className="fw-bold">{application.phone || 'N/A'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted">Business Name</small>
                                    <p className="fw-bold">{application.business_name || 'N/A'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted">Business Type</small>
                                    <p className="fw-bold">{application.business_type || 'N/A'}</p>
                                </div>
                                {application.stall_number && (
                                    <div className="col-md-6">
                                        <small className="text-muted">Requested Stall</small>
                                        <p className="fw-bold">
                                            <span className="badge bg-info">
                                                Stall {application.stall_number}
                                            </span>
                                        </p>
                                    </div>
                                )}
                                <div className="col-md-6">
                                    <small className="text-muted">Application Date</small>
                                    <p className="fw-bold">
                                        {new Date(application.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {application.notes && (
                                <div className="mt-3">
                                    <small className="text-muted">Notes</small>
                                    <p className="border rounded p-2 bg-light">
                                        {application.notes}
                                    </p>
                                </div>
                            )}

                            {application.reviewed_at && (
                                <div className="mt-3">
                                    <small className="text-muted">
                                        Reviewed by {application.reviewer_name || 'Admin'} on{' '}
                                        {new Date(application.reviewed_at).toLocaleDateString()}
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Review Actions */}
                <div className="col-lg-4">
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h5 className="mb-3">📝 Review Application</h5>
                            
                            {isPending ? (
                                <>
                                    <div className="mb-3">
                                        <label className="form-label fw-bold">Review Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows="4"
                                            placeholder="Add notes about this application..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>

                                    <div className="d-grid gap-2">
                                        <button
                                            className="btn btn-success btn-lg"
                                            onClick={() => handleReview('approved')}
                                            disabled={submitting}
                                        >
                                            <FaCheck className="me-2" />
                                            {submitting ? 'Processing...' : '✅ Approve'}
                                        </button>
                                        <button
                                            className="btn btn-danger btn-lg"
                                            onClick={() => handleReview('rejected')}
                                            disabled={submitting}
                                        >
                                            <FaTimes className="me-2" />
                                            {submitting ? 'Processing...' : '❌ Reject'}
                                        </button>
                                    </div>

                                    <div className="mt-3 text-muted small">
                                        <p className="mb-0">
                                            <FaUserPlus className="me-1" />
                                            Approving will automatically create a tenant and assign the stall.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-muted">This application has been reviewed</p>
                                    <span className={`badge bg-${application.status === 'approved' ? 'success' : 'danger'} px-4 py-2`}>
                                        {application.status.toUpperCase()}
                                    </span>
                                    {application.reviewed_at && (
                                        <p className="text-muted small mt-2">
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
    );
};

export default ApplicationReview;