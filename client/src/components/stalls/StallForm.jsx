import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { stallAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaSave, FaTimes } from 'react-icons/fa';

const StallForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [formData, setFormData] = useState({
        stall_number: '',
        location: '',
        size: '',
        monthly_rent: '',
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
            setFormData({
                stall_number: stall.stall_number || '',
                location: stall.location || '',
                size: stall.size || '',
                monthly_rent: stall.monthly_rent || '',
                status: stall.status || 'available',
                description: stall.description || '',
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
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate required fields
        if (!formData.stall_number || !formData.monthly_rent) {
            toast.error('Stall number and monthly rent are required');
            return;
        }

        setLoading(true);
        try {
            if (isEdit) {
                await stallAPI.update(id, formData);
                toast.success('Stall updated successfully! ✅');
            } else {
                await stallAPI.create(formData);
                toast.success('Stall created successfully! 🎉');
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
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading stall details...</p>
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
                                {isEdit ? '✏️ Edit Stall' : '➕ Add New Stall'}
                            </h4>
                            <p className="text-muted mb-0">
                                {isEdit ? 'Update stall information' : 'Create a new market stall'}
                            </p>
                        </div>
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() => navigate('/stalls')}
                        >
                            <FaTimes className="me-2" />
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label fw-bold">
                                    Stall Number <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="stall_number"
                                    className="form-control"
                                    placeholder="e.g., A-101"
                                    value={formData.stall_number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-bold">Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    className="form-control"
                                    placeholder="e.g., Building A, Ground Floor"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-bold">Size (sqm)</label>
                                <input
                                    type="number"
                                    name="size"
                                    className="form-control"
                                    placeholder="e.g., 15.5"
                                    value={formData.size}
                                    onChange={handleChange}
                                    step="0.5"
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-bold">
                                    Monthly Rent ₱ <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="monthly_rent"
                                    className="form-control"
                                    placeholder="e.g., 5000"
                                    value={formData.monthly_rent}
                                    onChange={handleChange}
                                    required
                                    step="0.01"
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-bold">Status</label>
                                <select
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="available">Available</option>
                                    <option value="occupied">Occupied</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="reserved">Reserved</option>
                                </select>
                            </div>

                            <div className="col-12">
                                <label className="form-label fw-bold">Description</label>
                                <textarea
                                    name="description"
                                    className="form-control"
                                    rows="3"
                                    placeholder="Describe the stall (location, features, etc.)"
                                    value={formData.description}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label fw-bold">Image URL</label>
                                <input
                                    type="text"
                                    name="image_url"
                                    className="form-control"
                                    placeholder="https://example.com/stall-image.jpg"
                                    value={formData.image_url}
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
                                        {loading ? 'Saving...' : (isEdit ? 'Update Stall' : 'Create Stall')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => navigate('/stalls')}
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

export default StallForm;