import React, { useState, useEffect } from 'react';
import { maintenanceAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
    FaWrench,
    FaPlus,
    FaCheckCircle,
    FaClock,
    FaExclamationCircle,
    FaSearch,
    FaFilter,
    FaEye,
    FaUserCheck,
    FaTools,
    FaExclamationTriangle
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MaintenanceList = () => {
    const { isAdmin, isStaff, isTenant } = useAuth();
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Form state for update
    const [updateForm, setUpdateForm] = useState({
        status: 'in_progress',
        assigned_to: '',
        resolution_notes: ''
    });

    // Form state for new request
    const [newRequest, setNewRequest] = useState({
        title: '',
        description: '',
        category: 'general',
        priority: 'medium'
    });

    // Initial load and continuous auto-polling every 5 seconds
    useEffect(() => {
        loadData(true);
        const interval = setInterval(() => {
            loadData(false);
        }, 5000);
        return () => clearInterval(interval);
    }, [statusFilter, categoryFilter]);

    const loadData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;

            const [reqRes, statsRes] = await Promise.all([
                maintenanceAPI.getAll(params),
                maintenanceAPI.getStats()
            ]);

            if (reqRes.data?.success) setRequests(reqRes.data.data || []);
            if (statsRes.data?.success) setStats(statsRes.data.data || null);
        } catch (error) {
            console.error('Error loading maintenance requests:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await maintenanceAPI.updateStatus(selectedRequest.id, updateForm);
            if (res.data?.success) {
                toast.success('Maintenance ticket updated successfully');
                setShowUpdateModal(false);
                loadData(true);
            }
        } catch (error) {
            toast.error('Failed to update maintenance ticket');
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await maintenanceAPI.create(newRequest);
            if (res.data?.success) {
                toast.success('Maintenance report submitted successfully');
                setShowCreateModal(false);
                setNewRequest({ title: '', description: '', category: 'general', priority: 'medium' });
                loadData(true);
            }
        } catch (error) {
            toast.error('Failed to submit maintenance request');
        }
    };

    const filteredRequests = requests.filter((r) => {
        const matchesSearch =
            r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.stall_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FaTools className="text-primary" /> Maintenance & Repair Operations
                    </h3>
                    <p className="text-muted mb-0">Track stall issues submitted by tenants, assign building technicians, and record resolutions.</p>
                </div>
                <button className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" onClick={() => setShowCreateModal(true)}>
                    <FaPlus /> Report New Stall Issue
                </button>
            </div>

            {/* KPI Stats */}
            {stats && (
                <div className="row g-3 mb-4">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-warning bg-opacity-10 text-warning p-3 rounded-circle fs-4">
                                <FaClock />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Pending Reports</span>
                                <h4 className="fw-bold mb-0 text-warning">{stats.pending || 0}</h4>
                                <small className="text-muted">Awaiting technician</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary p-3 rounded-circle fs-4">
                                <FaWrench />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">In Progress</span>
                                <h4 className="fw-bold mb-0 text-primary">{stats.in_progress || 0}</h4>
                                <small className="text-muted">Currently underway</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-success bg-opacity-10 text-success p-3 rounded-circle fs-4">
                                <FaCheckCircle />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Resolved Tickets</span>
                                <h4 className="fw-bold mb-0 text-success">{stats.completed || 0}</h4>
                                <small className="text-muted">Completed repairs</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card bg-white p-3 rounded-4 border shadow-sm d-flex align-items-center gap-3">
                            <div className="stat-icon-wrapper bg-danger bg-opacity-10 text-danger p-3 rounded-circle fs-4">
                                <FaExclamationTriangle />
                            </div>
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Urgent Priority</span>
                                <h4 className="fw-bold mb-0 text-danger">{stats.urgent || 0}</h4>
                                <small className="text-danger fw-semibold">Immediate attention</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="modern-card p-3 mb-4 bg-white border rounded-3 shadow-sm">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-6">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <FaSearch className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 bg-light"
                                placeholder="Search by issue title, stall #, or tenant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-12 col-md-6 d-flex justify-content-md-end gap-2">
                        <select
                            className="form-select form-select-sm bg-light"
                            style={{ width: '180px' }}
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            <option value="roof_leak">Roof Leak</option>
                            <option value="electrical">Electrical</option>
                            <option value="plumbing">Plumbing</option>
                            <option value="structural">Structural</option>
                            <option value="pest_control">Pest Control</option>
                            <option value="general">General</option>
                        </select>
                        <select
                            className="form-select form-select-sm bg-light"
                            style={{ width: '160px' }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses ({requests.length})</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Maintenance Requests List */}
            <div className="row g-3">
                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <div className="spinner-border text-primary spinner-border-sm me-2" />
                        Loading maintenance tickets...
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="col-12 text-center py-5 text-muted modern-card bg-white p-5 rounded-4 border">
                        No maintenance requests recorded.
                    </div>
                ) : (
                    filteredRequests.map((req) => (
                        <div className="col-12 col-lg-6" key={req.id}>
                            <div className="modern-card p-4 h-100 d-flex flex-column justify-content-between bg-white border rounded-4 shadow-sm">
                                <div>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <span className={`badge ${
                                            req.status === 'completed' ? 'bg-success' :
                                            req.status === 'in_progress' ? 'bg-primary' : 'bg-warning text-dark'
                                        } text-uppercase px-2 py-1`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                        <span className={`badge ${
                                            req.priority === 'urgent' ? 'bg-danger' :
                                            req.priority === 'high' ? 'bg-warning text-dark' : 'bg-secondary'
                                        } text-uppercase`}>
                                            {req.priority} Priority
                                        </span>
                                    </div>
                                    <h5 className="fw-bold text-dark mb-1">{req.title}</h5>
                                    <p className="text-muted small mb-3">{req.description}</p>

                                    <div className="bg-light p-3 rounded-3 small border mb-3">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Stall Space:</span>
                                            <strong className="text-dark">{req.stall_number || 'General Complex'}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Tenant / Reporter:</span>
                                            <span className="text-dark fw-semibold">{req.tenant_name || 'Commercial Tenant'}</span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Issue Category:</span>
                                            <span className="text-capitalize text-dark">{req.category?.replace('_', ' ')}</span>
                                        </div>
                                        {req.assigned_to && (
                                            <div className="d-flex justify-content-between pt-1 border-top mt-1">
                                                <span className="text-muted">Assigned Personnel:</span>
                                                <span className="fw-semibold text-primary">{req.assigned_to}</span>
                                            </div>
                                        )}
                                        {req.resolution_notes && (
                                            <div className="mt-2 pt-2 border-top">
                                                <div className="text-muted fw-semibold">Resolution Notes:</div>
                                                <div className="text-dark small">{req.resolution_notes}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                    <small className="text-muted font-monospace">
                                        Reported: {new Date(req.created_at).toLocaleDateString()}
                                    </small>
                                    <div className="d-flex gap-2">
                                        {req.photo_url && (
                                            <button
                                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setShowPhotoModal(true);
                                                }}
                                            >
                                                <FaEye size={12} /> Photo
                                            </button>
                                        )}
                                        {!isTenant && (
                                            <button
                                                className="btn btn-sm btn-primary d-flex align-items-center gap-1 fw-semibold"
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setUpdateForm({
                                                        status: req.status || 'in_progress',
                                                        assigned_to: req.assigned_to || '',
                                                        resolution_notes: req.resolution_notes || ''
                                                    });
                                                    setShowUpdateModal(true);
                                                }}
                                            >
                                                <FaUserCheck size={12} /> Update Status
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal: Update Maintenance Status */}
            {showUpdateModal && selectedRequest && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Update Maintenance Ticket</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUpdateModal(false)} />
                            </div>
                            <form onSubmit={handleUpdateSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Status</label>
                                        <select
                                            className="form-select"
                                            value={updateForm.status}
                                            onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Assigned Technician / Personnel</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Robert (Electrician)"
                                            value={updateForm.assigned_to}
                                            onChange={(e) => setUpdateForm({ ...updateForm, assigned_to: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Resolution Notes</label>
                                        <textarea
                                            rows={3}
                                            className="form-control"
                                            placeholder="Describe action taken, replacement parts, or notes..."
                                            value={updateForm.resolution_notes}
                                            onChange={(e) => setUpdateForm({ ...updateForm, resolution_notes: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowUpdateModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4">Save Ticket Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Create Maintenance Request */}
            {showCreateModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Report Stall Maintenance Issue</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)} />
                            </div>
                            <form onSubmit={handleCreateSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Issue Title</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Water leak near drainage, ceiling fixture repair"
                                            required
                                            value={newRequest.title}
                                            onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Category</label>
                                            <select
                                                className="form-select"
                                                value={newRequest.category}
                                                onChange={(e) => setNewRequest({ ...newRequest, category: e.target.value })}
                                            >
                                                <option value="roof_leak">Roof Leak</option>
                                                <option value="electrical">Electrical</option>
                                                <option value="plumbing">Plumbing</option>
                                                <option value="structural">Structural</option>
                                                <option value="pest_control">Pest Control</option>
                                                <option value="general">General</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Urgency Priority</label>
                                            <select
                                                className="form-select"
                                                value={newRequest.priority}
                                                onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="urgent">Urgent</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Description & Location</label>
                                        <textarea
                                            rows={3}
                                            className="form-control"
                                            placeholder="Detailed description of the issue..."
                                            required
                                            value={newRequest.description}
                                            onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4">Submit Report</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: View Photo */}
            {showPhotoModal && selectedRequest && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4 overflow-hidden">
                            <div className="modal-header bg-dark text-white p-3">
                                <h6 className="modal-title fw-bold">Issue Photo</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPhotoModal(false)} />
                            </div>
                            <div className="modal-body p-4 text-center">
                                <img
                                    src={`http://localhost:5000${selectedRequest.photo_url}`}
                                    alt="Maintenance Photo"
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '350px' }}
                                />
                            </div>
                            <div className="modal-footer bg-light p-3">
                                <button type="button" className="btn btn-secondary btn-sm px-4" onClick={() => setShowPhotoModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceList;
