import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaEye, FaCheck, FaTimes, FaClock, FaFileAlt } from 'react-icons/fa';

const ApplicationList = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchApplications();
    }, [filter]);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await applicationAPI.getAll(params);
            setApplications(response.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch applications');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this application?')) return;
        try {
            await applicationAPI.delete(id);
            toast.success('Application deleted successfully!');
            fetchApplications();
        } catch (error) {
            toast.error('Failed to delete application');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchApplications();
    };

    const getStatusBadge = (status) => {
        const config = {
            pending: { color: 'warning', icon: <FaClock />, label: 'Pending' },
            approved: { color: 'success', icon: <FaCheck />, label: 'Approved' },
            rejected: { color: 'danger', icon: <FaTimes />, label: 'Rejected' }
        };
        const c = config[status] || { color: 'secondary', icon: null, label: status };
        return (
            <span className={`badge bg-${c.color} px-3 py-2`}>
                {c.icon} {c.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading applications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">📋 Applications</h2>
                    <p className="text-muted mb-0">Review and manage stall applications</p>
                </div>
                <div>
                    <span className="badge bg-warning p-2 me-2">
                        Pending: {applications.filter(a => a.status === 'pending').length}
                    </span>
                    <span className="badge bg-success p-2">
                        Total: {applications.length}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <form onSubmit={handleSearch} className="d-flex">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by name, email, or business..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary ms-2">
                                    Search
                                </button>
                            </form>
                        </div>
                        <div className="col-md-3">
                            <select
                                className="form-select"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="">All</option>
                            </select>
                        </div>
                        <div className="col-md-5 text-end">
                            <button className="btn btn-outline-secondary me-2" onClick={fetchApplications}>
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Applications Cards */}
            <div className="row g-4">
                {applications.map((app) => (
                    <div key={app.id} className="col-lg-6 col-xl-4">
                        <div className="card shadow-sm h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h5 className="card-title mb-0">{app.full_name}</h5>
                                    {getStatusBadge(app.status)}
                                </div>
                                
                                <p className="text-muted mb-1">
                                    <small>📧 {app.email || 'No email'}</small>
                                </p>
                                <p className="text-muted mb-2">
                                    <small>📱 {app.phone || 'No phone'}</small>
                                </p>

                                <div className="mb-2">
                                    <strong>Business:</strong> {app.business_name || 'N/A'}
                                </div>
                                <div className="mb-2">
                                    <strong>Type:</strong> {app.business_type || 'N/A'}
                                </div>

                                {app.stall_number && (
                                    <div className="mb-2">
                                        <span className="badge bg-info">
                                            🏪 Stall {app.stall_number}
                                        </span>
                                    </div>
                                )}

                                {app.notes && (
                                    <p className="text-muted small mb-0">
                                        <strong>Notes:</strong> {app.notes}
                                    </p>
                                )}

                                {app.reviewed_at && (
                                    <p className="text-muted small mt-2 mb-0">
                                        Reviewed: {new Date(app.reviewed_at).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            
                            <div className="card-footer bg-transparent border-top-0">
                                <div className="d-flex gap-2">
                                    <button
                                        className="btn btn-outline-primary btn-sm flex-grow-1"
                                        onClick={() => navigate(`/applications/review/${app.id}`)}
                                    >
                                        <FaEye className="me-1" /> Review
                                    </button>
                                    {app.status === 'pending' && (
                                        <>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => navigate(`/applications/review/${app.id}?action=approve`)}
                                                title="Quick Approve"
                                            >
                                                <FaCheck />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => navigate(`/applications/review/${app.id}?action=reject`)}
                                                title="Quick Reject"
                                            >
                                                <FaTimes />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleDelete(app.id)}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {applications.length === 0 && (
                <div className="text-center py-5">
                    <p className="text-muted">No applications found</p>
                    <FaFileAlt style={{ fontSize: '48px', color: '#ccc' }} />
                </div>
            )}
        </div>
    );
};

export default ApplicationList;