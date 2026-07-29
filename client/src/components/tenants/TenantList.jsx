import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaEdit, FaTrash, FaPlus, FaUserCheck, FaUserTimes, FaEye } from 'react-icons/fa';

const TenantList = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchTenants();
    }, [filter]);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await tenantAPI.getAll(params);
            setTenants(response.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch tenants');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this tenant?')) return;
        try {
            await tenantAPI.delete(id);
            toast.success('Tenant deleted successfully!');
            fetchTenants();
        } catch (error) {
            toast.error('Failed to delete tenant');
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await tenantAPI.updateStatus(id, newStatus);
            toast.success(`Tenant status updated to ${newStatus}`);
            fetchTenants();
        } catch (error) {
            toast.error('Failed to update tenant status');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchTenants();
    };

    const getStatusBadge = (status) => {
        const colors = {
            active: 'success',
            inactive: 'secondary',
            pending: 'warning'
        };
        return <span className={`badge bg-${colors[status] || 'secondary'}`}>{status}</span>;
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading tenants...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">👥 Tenants</h2>
                    <p className="text-muted mb-0">Manage your stall tenants</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/tenants/new')}
                >
                    <FaPlus className="me-2" />
                    Add Tenant
                </button>
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
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                        <div className="col-md-5 text-end">
                            <button className="btn btn-outline-secondary me-2" onClick={fetchTenants}>
                                🔄 Refresh
                            </button>
                            <span className="badge bg-primary p-2">
                                {tenants.length} Tenants
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="card shadow-sm">
                <div className="table-responsive">
                    <table className="table table-hover mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Name</th>
                                <th>Business</th>
                                <th>Stall</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td>
                                        <div 
                                            className="fw-bold text-primary" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => navigate(`/tenants/${tenant.id}`)}
                                        >
                                            {tenant.name}
                                        </div>
                                        <small className="text-muted">{tenant.email}</small>
                                    </td>
                                    <td>
                                        <div>{tenant.business_name || 'N/A'}</div>
                                        <small className="text-muted">{tenant.business_type || ''}</small>
                                    </td>
                                    <td>
                                        {tenant.stall_number ? (
                                            <span className="badge bg-info">
                                                {tenant.stall_number}
                                            </span>
                                        ) : (
                                            <span className="text-muted">No stall</span>
                                        )}
                                    </td>
                                    <td>{tenant.phone || 'N/A'}</td>
                                    <td>{getStatusBadge(tenant.status)}</td>
                                    <td>
                                        <div className="d-flex gap-1">
                                            <button
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => navigate(`/tenants/${tenant.id}`)}
                                                title="View Profile"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-info"
                                                onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            {tenant.status === 'active' ? (
                                                <button
                                                    className="btn btn-sm btn-outline-warning"
                                                    onClick={() => handleStatusChange(tenant.id, 'inactive')}
                                                    title="Deactivate"
                                                >
                                                    <FaUserTimes />
                                                </button>
                                            ) : tenant.status === 'inactive' ? (
                                                <button
                                                    className="btn btn-sm btn-outline-success"
                                                    onClick={() => handleStatusChange(tenant.id, 'active')}
                                                    title="Activate"
                                                >
                                                    <FaUserCheck />
                                                </button>
                                            ) : null}
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => handleDelete(tenant.id)}
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {tenants.length === 0 && (
                <div className="text-center py-5">
                    <p className="text-muted">No tenants found</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/tenants/new')}
                    >
                        <FaPlus className="me-2" />
                        Add Your First Tenant
                    </button>
                </div>
            )}
        </div>
    );
};

export default TenantList;