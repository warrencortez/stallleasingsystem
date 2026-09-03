import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantAPI, stallAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaSave, FaTimes, FaUsers, FaUserPlus, FaEdit } from 'react-icons/fa';

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
                toast.success('Tenant record updated successfully');
            } else {
                await tenantAPI.create(formData);
                toast.success('Tenant created successfully');
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
                        <span className="visually-hidden">Loading tenant details...</span>
                    </div>
                    <p className="mt-2 text-muted fw-semibold">Loading tenant details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="card shadow-sm border-0 bg-white rounded-4 overflow-hidden">
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary bg-opacity-10 text-primary p-3 rounded-3 fs-4">
                                {isEdit ? <FaEdit /> : <FaUserPlus />}
                            </div>
                            <div>
                                <h4 className="mb-0 fw-bold text-dark">
                                    {isEdit ? `Edit Tenant: ${formData.name}` : 'Register New Commercial Tenant'}
                                </h4>
                                <p className="text-muted mb-0 small">
                                    {isEdit ? 'Update tenant identity, contact details, and contract window' : 'Add a new market merchant and assign a commercial stall'}
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-outline-secondary btn-sm px-3"
                            onClick={() => navigate('/tenants')}
                        >
                            <FaTimes className="me-1" />
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="row g-4">
                            <div className="col-12">
                                <h6 className="text-dark fw-bold mb-1">Personal & Contact Identity</h6>
                                <p className="text-muted small mb-0">Merchant legal name and communications info</p>
                            </div>
                            
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">
                                    Full Legal Name <span className="text-danger">*</span>
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
                                <label className="form-label fw-semibold small text-muted">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-control"
                                    placeholder="e.g. tenant@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Contact Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    className="form-control"
                                    placeholder="e.g. 0917-123-4567"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Residential / Mailing Address</label>
                                <input
                                    type="text"
                                    name="address"
                                    className="form-control"
                                    placeholder="Enter full address"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-12 pt-3 border-top">
                                <h6 className="text-dark fw-bold mb-1">Business & Lease Terms</h6>
                                <p className="text-muted small mb-0">Commercial entity and assigned stall information</p>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Business Trade Name</label>
                                <input
                                    type="text"
                                    name="business_name"
                                    className="form-control"
                                    placeholder="e.g. Reese Gourmet Cafe"
                                    value={formData.business_name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Business Concept / Category</label>
                                <input
                                    type="text"
                                    name="business_type"
                                    className="form-control"
                                    placeholder="e.g. Food & Beverage, Apparel, Electronics"
                                    value={formData.business_type}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-muted">Assign Commercial Stall</label>
                                <select
                                    name="stall_id"
                                    className="form-select"
                                    value={formData.stall_id}
                                    onChange={handleChange}
                                >
                                    <option value="">-- No Stall Assigned --</option>
                                    {stalls.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.stall_number} - {s.location || 'Complex'} (₱{Number(s.monthly_rent).toLocaleString()}/mo)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-muted">Contract Start Date</label>
                                <input
                                    type="date"
                                    name="contract_start"
                                    className="form-control"
                                    value={formData.contract_start}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-muted">Contract End Date</label>
                                <input
                                    type="date"
                                    name="contract_end"
                                    className="form-control"
                                    value={formData.contract_end}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold small text-muted">Account Status</label>
                                <select
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="pending">Pending Approval</option>
                                    <option value="active">Active Occupant</option>
                                    <option value="inactive">Inactive / Terminated</option>
                                </select>
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                            <button
                                type="button"
                                className="btn btn-light border px-4"
                                onClick={() => navigate('/tenants')}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="spinner-border spinner-border-sm" />
                                ) : (
                                    <>
                                        <FaSave />
                                        <span>{isEdit ? 'Save Changes' : 'Register Tenant'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TenantForm;