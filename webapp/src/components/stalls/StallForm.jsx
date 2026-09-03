import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { stallAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaSave, FaTimes, FaStore, FaEdit, FaPlus, FaMoneyBillWave } from 'react-icons/fa';

const StallForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [formData, setFormData] = useState({
        stall_number: '',
        location: '',
        size: '',
        rent_type: 'monthly', // 'monthly' or 'daily'
        monthly_rent: '',
        daily_rent: '',
        status: 'available',
        description: '',
        image_url: ''
    });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);

    useEffect(() => {
        if (isEdit) {
            fetchStall();
        }
    }, [id]);

    const fetchStall = async () => {
        try {
            const response = await stallAPI.getById(id);
            const stall = response.data.data;
            
            const isDaily = stall.description?.includes('[Billing: DAILY]');
            const rentVal = stall.monthly_rent || '';

            setFormData({
                stall_number: stall.stall_number || '',
                location: stall.location || '',
                size: stall.size || '',
                rent_type: isDaily ? 'daily' : 'monthly',
                monthly_rent: isDaily ? '' : rentVal,
                daily_rent: isDaily ? rentVal : '',
                status: stall.status || 'available',
                description: stall.description ? stall.description.replace(/\[Billing: (DAILY|MONTHLY)\]\s*/g, '') : '',
                image_url: stall.image_url || ''
            });
        } catch (error) {
            toast.error('Failed to fetch stall details');
            navigate('/stalls');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRentTypeChange = (type) => {
        setFormData((prev) => ({
            ...prev,
            rent_type: type
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const effectiveRent = formData.rent_type === 'daily' 
            ? Number(formData.daily_rent || 0)
            : Number(formData.monthly_rent || 0);

        if (!formData.stall_number || !effectiveRent || effectiveRent <= 0) {
            toast.error('Stall number and a valid rental rate amount are required.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                stall_number: formData.stall_number.trim(),
                location: formData.location.trim(),
                size: formData.size.trim(),
                rent_type: formData.rent_type,
                monthly_rent: effectiveRent,
                status: formData.status,
                description: formData.description.trim(),
                image_url: formData.image_url
            };

            if (isEdit) {
                await stallAPI.update(id, payload);
                toast.success('Stall information updated successfully');
            } else {
                await stallAPI.create(payload);
                toast.success('Commercial stall created successfully');
            }
            navigate('/stalls');
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to save stall';
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
                        <span className="visually-hidden">Loading stall details...</span>
                    </div>
                    <p className="mt-2 text-muted fw-semibold">Loading stall details...</p>
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
                                {isEdit ? <FaEdit /> : <FaPlus />}
                            </div>
                            <div>
                                <h4 className="mb-0 fw-bold text-dark">
                                    {isEdit ? `Edit Stall: ${formData.stall_number}` : 'Add New Commercial Stall'}
                                </h4>
                                <p className="text-muted mb-0 small">
                                    {isEdit ? 'Update stall attributes, pricing, and occupancy status' : 'Register a new retail space in the commercial complex'}
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-outline-secondary btn-sm px-3"
                            onClick={() => navigate('/stalls')}
                        >
                            <FaTimes className="me-1" />
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="row g-4">
                            {/* Stall Number */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">
                                    Stall Number / Identifier <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="stall_number"
                                    className="form-control"
                                    placeholder="e.g. Stall A-101"
                                    value={formData.stall_number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            {/* Location Zone */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Location / Zone</label>
                                <input
                                    type="text"
                                    name="location"
                                    className="form-control"
                                    placeholder="e.g. Building A, Ground Floor, Food Court"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Rent Billing Frequency Selection */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">
                                    Rental Billing Frequency <span className="text-danger">*</span>
                                </label>
                                <div className="d-flex gap-3 mt-1">
                                    <div className="form-check form-check-inline border p-2 px-3 rounded-3 bg-light flex-grow-1 cursor-pointer">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="rent_type_option"
                                            id="rent_monthly"
                                            value="monthly"
                                            checked={formData.rent_type === 'monthly'}
                                            onChange={() => handleRentTypeChange('monthly')}
                                        />
                                        <label className="form-check-label fw-semibold ms-2" htmlFor="rent_monthly">
                                            Monthly Lease
                                        </label>
                                    </div>
                                    <div className="form-check form-check-inline border p-2 px-3 rounded-3 bg-light flex-grow-1 cursor-pointer">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="rent_type_option"
                                            id="rent_daily"
                                            value="daily"
                                            checked={formData.rent_type === 'daily'}
                                            onChange={() => handleRentTypeChange('daily')}
                                        />
                                        <label className="form-check-label fw-semibold ms-2" htmlFor="rent_daily">
                                            Daily Rent
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Rate Amount */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">
                                    {formData.rent_type === 'daily' ? 'Daily Rent Rate (₱)' : 'Monthly Rent Rate (₱)'} <span className="text-danger">*</span>
                                </label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light fw-bold text-muted">₱</span>
                                    <input
                                        type="number"
                                        name={formData.rent_type === 'daily' ? 'daily_rent' : 'monthly_rent'}
                                        className="form-control"
                                        placeholder={formData.rent_type === 'daily' ? 'e.g. 500' : 'e.g. 15000'}
                                        value={formData.rent_type === 'daily' ? formData.daily_rent : formData.monthly_rent}
                                        onChange={handleChange}
                                        required
                                        step="0.01"
                                        min="1"
                                    />
                                    <span className="input-group-text bg-light text-muted small">
                                        {formData.rent_type === 'daily' ? '/ day' : '/ month'}
                                    </span>
                                </div>
                            </div>

                            {/* Size Dimensions */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Floor Area / Dimensions</label>
                                <input
                                    type="text"
                                    name="size"
                                    className="form-control"
                                    placeholder="e.g. 20 sqm (4m x 5m)"
                                    value={formData.size}
                                    onChange={handleChange}
                                />
                            </div>

                            {/* Status */}
                            <div className="col-md-6">
                                <label className="form-label fw-semibold small text-muted">Occupancy Status</label>
                                <select
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="available">Available (Vacant)</option>
                                    <option value="occupied">Occupied</option>
                                    <option value="maintenance">Under Maintenance</option>
                                    <option value="reserved">Reserved</option>
                                </select>
                            </div>

                            {/* Description */}
                            <div className="col-12">
                                <label className="form-label fw-semibold small text-muted">Stall Description & Amenities</label>
                                <textarea
                                    name="description"
                                    className="form-control"
                                    rows="3"
                                    placeholder="Add notes about power outlets, water line connection, corner visibility..."
                                    value={formData.description}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                            <button
                                type="button"
                                className="btn btn-light border px-4"
                                onClick={() => navigate('/stalls')}
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
                                        <span>{isEdit ? 'Save Changes' : 'Create Stall'}</span>
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

export default StallForm;