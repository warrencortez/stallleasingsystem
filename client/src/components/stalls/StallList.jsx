import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stallAPI } from '../../api/endpoints';
import StallStatusBadge from './StallStatusBadge';
import toast from 'react-hot-toast';
import { FaEdit, FaTrash, FaPlus, FaEye } from 'react-icons/fa';

const StallList = () => {
    const [stalls, setStalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchStalls();
    }, [filter]);

    const fetchStalls = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await stallAPI.getAll(params);
            setStalls(response.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch stalls');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this stall?')) return;
        try {
            await stallAPI.delete(id);
            toast.success('Stall deleted successfully!');
            fetchStalls();
        } catch (error) {
            toast.error('Failed to delete stall');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchStalls();
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading stalls...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">🏪 Stalls</h2>
                    <p className="text-muted mb-0">Manage your market stalls</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/stalls/new')}
                >
                    <FaPlus className="me-2" />
                    Add Stall
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
                                    placeholder="Search by number or location..."
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
                                <option value="available">Available</option>
                                <option value="occupied">Occupied</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="reserved">Reserved</option>
                            </select>
                        </div>
                        <div className="col-md-5 text-end">
                            <button className="btn btn-outline-secondary me-2" onClick={fetchStalls}>
                                🔄 Refresh
                            </button>
                            <span className="badge bg-primary p-2">
                                {stalls.length} Stalls
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stall Cards */}
            <div className="row g-4">
                {stalls.map((stall) => (
                    <div key={stall.id} className="col-xl-4 col-lg-6 col-md-6">
                        <div className="card shadow-sm h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h5 className="card-title mb-0">
                                        <strong>{stall.stall_number}</strong>
                                    </h5>
                                    <StallStatusBadge status={stall.status} />
                                </div>
                                
                                <p className="text-muted mb-1">
                                    <small>📍 {stall.location || 'No location set'}</small>
                                </p>
                                
                                <div className="row g-2 mt-2">
                                    <div className="col-6">
                                        <small className="text-muted">Size</small>
                                        <p className="mb-0">{stall.size || 'N/A'} sqm</p>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted">Monthly Rent</small>
                                        <p className="mb-0 fw-bold text-success">
                                            ₱{Number(stall.monthly_rent).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {stall.tenant_name && (
                                    <div className="mt-2 p-2 bg-light rounded">
                                        <small className="text-muted">Current Tenant</small>
                                        <p className="mb-0">{stall.tenant_name}</p>
                                    </div>
                                )}

                                {stall.description && (
                                    <p className="text-muted mt-2 mb-0">
                                        <small>{stall.description}</small>
                                    </p>
                                )}
                            </div>
                            
                            <div className="card-footer bg-transparent border-top-0">
                                <div className="d-flex gap-2">
                                    <button
                                        className="btn btn-outline-primary btn-sm flex-grow-1"
                                        onClick={() => navigate(`/stalls/edit/${stall.id}`)}
                                    >
                                        <FaEdit className="me-1" /> Edit
                                    </button>
                                    <button
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleDelete(stall.id)}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {stalls.length === 0 && (
                <div className="text-center py-5">
                    <p className="text-muted">No stalls found</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/stalls/new')}
                    >
                        <FaPlus className="me-2" />
                        Add Your First Stall
                    </button>
                </div>
            )}
        </div>
    );
};

export default StallList;