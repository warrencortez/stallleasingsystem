import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantAPI, stallAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaSave, FaTimes } from 'react-icons/fa';

const TenantForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        business_name: '',
        business_type: '',
        stall_id: '',
        status: 'pending',
        contract_start: '',
        contract_end: ''
    });
    const [stalls, setStalls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);

    useEffect(() => {
        fetchStalls();
        if (isEdit) {
            fetchTenant();
        }
    }, [id]);

    const fetchStalls = async () => {
        try {
            const response = await stallAPI.getAll({ status: 'available' });
            setStalls(response.data.data || []);
        } catch (error) {
            console.error('Error fetching stalls:', error);
        }
    };

    const fetchTenant = async () => {
        try {
            const response = await tenantAPI.getById(id);
            const tenant = response.data.data;
            setFormData({
                name: tenant.name || '',
                email: tenant.email || '',
                phone: tenant.phone || '',
                address: tenant.address || '',
                business_name: tenant.business_name || '',
                business_type: tenant.business_type || '',
                stall_id: tenant.stall_id || '',
                status: tenant.status || 'pending',
                contract_start: tenant.contract_start ? tenant.contract_start.split('T')[0] : '',
                contract_end: tenant.contract_end ? tenant.contract_end.split('T')[0] : ''
            });
        } catch (error) {
            toast.error('Failed to fetch tenant details');
            navigate('/tenants');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name) {
            toast.error('Tenant name is required');
            return;
        }

        setLoading(true);
        try {
            if (isEdit) {
                await tenantAPI.update(id, formData);
                toast.success('Tenant updated successfully! ✅');
            } else {
                await tenantAPI.create(formData);
                toast.success('Tenant created successfully! 🎉');
            }
            navigate('/tenants');
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to save tenant';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading tenant details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="card shadow-sm">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h4 className="mb-1">
                                {isEdit ? '✏️ Edit Tenant' : '➕ Add New Tenant'}
                            </h4>
                            <p className="text-muted mb-0">
                                {isEdit ? 'Update tenant information' : 'Register a new tenant'}
                            </p>
                        </div>
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => navigate('/tenants')}
                        >
                            <FaTimes className="me-2" />
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="row g-3">
                            {/* Personal Information */}
                            <div className="col-12">
                                <h6 className="text-muted mb-3">Personal Information</h6>
                            </div>
                            
                            <div className="col-md-6">
                                <label className="form-label fw-bold">
                                    Full Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-control"
                                    placeholder="Enter full name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-control"
                                    placeholder="Enter email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Phone</label>
                                <input
                                    type="text"
                                    name="phone"
                                    className="form-control"
                                    placeholder="Enter phone number"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Address</label>
                                <input
                                    type="text"
                                    name="address"
                                    className="form-control"
                                    placeholder="Enter address"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Business Information */}
                            <div className="col-12 mt-3">
                                <h6 className="text-muted mb-3">Business Information</h6>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Business Name</label>
                                <input
                                    type="text"
                                    name="business_name"
                                    className="form-control"
                                    placeholder="Enter business name"
                                    value={formData.business_name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Business Type</label>
                                <input
                                    type="text"
                                    name="business_type"
                                    className="form-control"
                                    placeholder="e.g., Retail, Food & Beverage"
                                    value={formData.business_type}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Stall Assignment */}
                            <div className="col-12 mt-3">
                                <h6 className="text-muted mb-3">Stall Assignment</h6>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Assign Stall</label>
                                <select
                                    name="stall_id"
                                    className="form-select"
                                    value={formData.stall_id}
                                    onChange={handleChange}
                                >
                                    <option value="">No stall assigned</option>
                                    {stalls.map((stall) => (
                                        <option key={stall.id} value={stall.id}>
                                            {stall.stall_number} - {stall.location} (₱{stall.monthly_rent})
                                        </option>
                                    ))}
                                </select>
                                {isEdit && formData.stall_id && !stalls.find(s => s.id === formData.stall_id) && (
                                    <small className="text-warning">
                                        ⚠️ Current stall is occupied. Changing will free it up.
                                    </small>
                                )}
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Status</label>
                                <select
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </div>

                            {/* Contract Dates */}
                            <div className="col-12 mt-3">
                                <h6 className="text-muted mb-3">Contract Details</h6>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Contract Start</label>
                                <input
                                    type="date"
                                    name="contract_start"
                                    className="form-control"
                                    value={formData.contract_start}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Contract End</label>
                                <input
                                    type="date"
                                    name="contract_end"
                                    className="form-control"
                                    value={formData.contract_end}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-12">
                                <hr />
                                <div className="d-flex gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading}
                                    >
                                        <FaSave className="me-2" />
                                        {loading ? 'Saving...' : (isEdit ? 'Update Tenant' : 'Create Tenant')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => navigate('/tenants')}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TenantForm;