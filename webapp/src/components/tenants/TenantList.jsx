import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import { 
    FaEdit, 
    FaTrash, 
    FaUserCheck, 
    FaUserTimes, 
    FaEye, 
    FaUsers, 
    FaSearch,
    FaEnvelope,
    FaPhone,
    FaStore
} from 'react-icons/fa';

const TenantList = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    // Initial load and continuous auto-polling every 5 seconds
    useEffect(() => {
        fetchTenants(true);
        const poll = setInterval(() => {
            fetchTenants(false);
        }, 5000);
        return () => clearInterval(poll);
    }, [filter]);

    const fetchTenants = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await tenantAPI.getAll(params);
            setTenants(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch tenants:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleDeleteClick = (tenant) => {
        setDeleteTarget(tenant);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await tenantAPI.delete(deleteTarget.id);
            toast.success(`Tenant ${deleteTarget.name} removed successfully`);
            setDeleteTarget(null);
            fetchTenants(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete tenant');
        } finally {
            setDeleting(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await tenantAPI.updateStatus(id, newStatus);
            toast.success(`Tenant status updated to ${newStatus}`);
            fetchTenants(true);
        } catch (error) {
            toast.error('Failed to update tenant status');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchTenants(true);
    };

    const getStatusBadge = (status) => {
        const colors = {
            active: 'success',
            inactive: 'secondary',
            pending: 'warning text-dark'
        };
        return <span className={`badge bg-${colors[status] || 'secondary'} text-uppercase px-2 py-1`}>{status}</span>;
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FaUsers className="text-primary" /> Commercial Tenants Directory
                    </h3>
                    <p className="text-muted mb-0">Roster of registered market merchants, lease contracts, and assigned retail spaces.</p>
                </div>
            </div>

            {/* Filters */}
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
                                    placeholder="Search by name, email, or business..."
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
                                <option value="">All Statuses ({tenants.length})</option>
                                <option value="active">Active Occupants</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                        <div className="col-md-3 text-md-end">
                            <span className="badge bg-light text-muted border px-2 py-2">
                                Auto-Sync Active
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="card shadow-sm border-0 bg-white rounded-4 overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Merchant Name</th>
                                <th>Business Entity</th>
                                <th>Assigned Stall</th>
                                <th>Contact Information</th>
                                <th>Status</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <div className="spinner-border text-primary spinner-border-sm me-2" />
                                        Loading tenant records...
                                    </td>
                                </tr>
                            ) : tenants.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        No registered tenants found.
                                    </td>
                                </tr>
                            ) : (
                                tenants.map((tenant) => (
                                    <tr key={tenant.id}>
                                        <td className="ps-4">
                                            <div 
                                                className="fw-bold text-dark cursor-pointer" 
                                                onClick={() => navigate(`/tenants/${tenant.id}`)}
                                            >
                                                {tenant.name}
                                            </div>
                                            <small className="text-muted font-monospace">{tenant.email}</small>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{tenant.business_name || 'N/A'}</div>
                                            <small className="text-muted text-capitalize">{tenant.business_type || ''}</small>
                                        </td>
                                        <td>
                                            {tenant.stall_number ? (
                                                <span className="badge bg-primary bg-opacity-10 text-primary fw-bold px-2 py-1">
                                                    <FaStore className="me-1" /> {tenant.stall_number}
                                                </span>
                                            ) : (
                                                <span className="text-muted small">Unassigned</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="small text-dark font-monospace">{tenant.phone || 'N/A'}</div>
                                        </td>
                                        <td>{getStatusBadge(tenant.status)}</td>
                                        <td className="text-end pe-4">
                                            <div className="d-flex justify-content-end gap-1">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                                                    title="View Profile"
                                                >
                                                    <FaEye size={12} />
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-info"
                                                    onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                                                    title="Edit Record"
                                                >
                                                    <FaEdit size={12} />
                                                </button>
                                                {tenant.status === 'active' ? (
                                                    <button
                                                        className="btn btn-sm btn-outline-warning"
                                                        onClick={() => handleStatusChange(tenant.id, 'inactive')}
                                                        title="Deactivate Tenant"
                                                    >
                                                        <FaUserTimes size={12} />
                                                    </button>
                                                ) : tenant.status === 'inactive' ? (
                                                    <button
                                                        className="btn btn-sm btn-outline-success"
                                                        onClick={() => handleStatusChange(tenant.id, 'active')}
                                                        title="Activate Tenant"
                                                    >
                                                        <FaUserCheck size={12} />
                                                    </button>
                                                ) : null}
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDeleteClick(tenant)}
                                                    title="Delete Tenant"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Professional Tenant Removal Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title={`Remove Merchant Record: ${deleteTarget?.name}`}
                message="Are you sure you want to permanently delete this commercial tenant record?"
                type="danger"
                confirmText="Yes, Remove Tenant"
                cancelText="Cancel"
                loading={deleting}
                details={[
                    'The tenant account and all linked personal details will be deleted.',
                    'If a stall is currently leased by this tenant, the stall will be marked vacant.',
                    'Past settled receipts will remain preserved in historical audit ledgers.'
                ]}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default TenantList;
