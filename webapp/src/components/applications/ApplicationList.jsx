import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationAPI } from '../../api/endpoints';
import ConfirmModal from '../common/ConfirmModal';
import toast from 'react-hot-toast';
import { 
    FaEye, 
    FaCheck, 
    FaTimes, 
    FaFileAlt, 
    FaEnvelope, 
    FaPhone, 
    FaStore, 
    FaTrash,
    FaSearch,
    FaCheckCircle,
    FaTimesCircle,
    FaHourglassHalf
} from 'react-icons/fa';

const ApplicationList = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    // Initial load and continuous real-time auto-polling every 5 seconds
    useEffect(() => {
        fetchApplications(true);
        const interval = setInterval(() => {
            fetchApplications(false);
        }, 5000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchApplications = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await applicationAPI.getAll(params);
            setApplications(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch applications:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleDeleteClick = (app) => {
        setDeleteTarget(app);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await applicationAPI.delete(deleteTarget.id);
            toast.success('Application record deleted successfully');
            setDeleteTarget(null);
            fetchApplications(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete application');
        } finally {
            setDeleting(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchApplications(true);
    };

    const getStatusBadge = (status) => {
        const config = {
            pending: { color: 'warning text-dark', icon: <FaHourglassHalf className="me-1" />, label: 'Pending Review' },
            approved: { color: 'success', icon: <FaCheckCircle className="me-1" />, label: 'Approved & Leased' },
            rejected: { color: 'danger', icon: <FaTimesCircle className="me-1" />, label: 'Rejected' }
        };
        const c = config[status] || { color: 'secondary', icon: null, label: status };
        return (
            <span className={`badge bg-${c.color} px-3 py-2 d-inline-flex align-items-center`}>
                {c.icon} {c.label}
            </span>
        );
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FaFileAlt className="text-primary" /> Stall Lease Applications Pipeline
                    </h3>
                    <p className="text-muted mb-0">Review incoming applicant submissions from the Tenant Mobile App and manage lease approvals.</p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-warning text-dark p-2 border">
                        Pending: {applications.filter(a => a.status === 'pending').length}
                    </span>
                    <span className="badge bg-light text-dark p-2 border">
                        Total Submissions: {applications.length}
                    </span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="card shadow-sm border-0 bg-white rounded-3 mb-4">
                <div className="card-body p-3">
                    <div className="row g-3 align-items-center">
                        <div className="col-md-5">
                            <form onSubmit={handleSearch} className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaSearch className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="Search by applicant name, email, or business..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary px-3">
                                    Search
                                </button>
                            </form>
                        </div>
                        <div className="col-md-4">
                            <select
                                className="form-select bg-light"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="pending">Pending Review Only</option>
                                <option value="approved">Approved Applications</option>
                                <option value="rejected">Rejected Applications</option>
                                <option value="">All Applications</option>
                            </select>
                        </div>
                        <div className="col-md-3 text-md-end">
                            <span className="badge bg-light text-muted border px-2 py-2">
                                Live Auto-Sync Active
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Applications Grid */}
            {loading ? (
                <div className="text-center py-5 text-muted">
                    <div className="spinner-border text-primary spinner-border-sm me-2" />
                    Loading lease applications...
                </div>
            ) : applications.length === 0 ? (
                <div className="text-center py-5 text-muted card bg-white border-0 shadow-sm rounded-4 p-5">
                    <FaFileAlt style={{ fontSize: '48px', color: '#cbd5e1' }} className="mx-auto mb-3" />
                    <h6 className="fw-bold text-dark">No applications found</h6>
                    <p className="small text-muted mb-0">No applicant submissions match your current filter.</p>
                </div>
            ) : (
                <div className="row g-4">
                    {applications.map((app) => (
                        <div key={app.id} className="col-lg-6 col-xl-4">
                            <div className="card shadow-sm h-100 border-0 bg-white rounded-4 overflow-hidden d-flex flex-column justify-content-between">
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <h5 className="card-title fw-bold text-dark mb-0">{app.full_name}</h5>
                                        {getStatusBadge(app.status)}
                                    </div>
                                    
                                    <div className="d-flex flex-column gap-1 mb-3 text-muted small">
                                        <div className="d-flex align-items-center gap-2">
                                            <FaEnvelope className="text-primary" size={13} />
                                            <span>{app.email || 'No email registered'}</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <FaPhone className="text-primary" size={13} />
                                            <span>{app.phone || 'No contact number'}</span>
                                        </div>
                                    </div>

                                    <div className="bg-light p-3 rounded-3 border mb-3 small">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Business Name:</span>
                                            <strong className="text-dark">{app.business_name || 'Retail / Merchandise'}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Concept / Category:</span>
                                            <span className="fw-semibold text-capitalize">{app.business_type || 'General'}</span>
                                        </div>
                                        {app.stall_number && (
                                            <div className="d-flex justify-content-between pt-1 border-top mt-2">
                                                <span className="text-muted">Requested Space:</span>
                                                <span className="badge bg-primary px-2 py-1">
                                                    <FaStore className="me-1" /> Stall {app.stall_number}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {app.notes && (
                                        <p className="text-muted small mb-2 bg-light p-2 rounded border">
                                            <strong>Notes:</strong> {app.notes}
                                        </p>
                                    )}

                                    <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                                        <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                                        {app.reviewed_at && (
                                            <span>Reviewed: {new Date(app.reviewed_at).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="card-footer bg-light p-3 border-top d-flex gap-2">
                                    <button
                                        className="btn btn-outline-primary btn-sm flex-grow-1 fw-semibold d-flex align-items-center justify-content-center gap-1"
                                        onClick={() => navigate(`/applications/review/${app.id}`)}
                                    >
                                        <FaEye size={12} /> Review Application
                                    </button>
                                    {app.status === 'pending' && (
                                        <>
                                            <button
                                                className="btn btn-success btn-sm px-3"
                                                onClick={() => navigate(`/applications/review/${app.id}?action=approve`)}
                                                title="Approve & Lease Stall"
                                            >
                                                <FaCheck />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm px-3"
                                                onClick={() => navigate(`/applications/review/${app.id}?action=reject`)}
                                                title="Reject Application"
                                            >
                                                <FaTimes />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="btn btn-outline-danger btn-sm px-2"
                                        onClick={() => handleDeleteClick(app)}
                                        title="Delete Application"
                                    >
                                        <FaTrash size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Professional Application Removal Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title={`Delete Application: ${deleteTarget?.applicant_name || deleteTarget?.full_name || 'Applicant'}`}
                message="Are you sure you want to permanently delete this stall rental application record?"
                type="danger"
                confirmText="Yes, Delete Record"
                cancelText="Cancel"
                loading={deleting}
                details={[
                    'The application submission and all associated applicant notes will be removed.',
                    'The applicant will not receive automatic approval or rejection emails.'
                ]}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default ApplicationList;