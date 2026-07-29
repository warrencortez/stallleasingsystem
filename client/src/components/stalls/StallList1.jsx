import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stallAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';

const StallList = () => {
    const [stalls, setStalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchStalls();
    }, []);

    const fetchStalls = async () => {
        try {
            setLoading(true);
            const response = await stallAPI.getAll({ status: filter || undefined });
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

    const getStatusBadge = (status) => {
        const colors = {
            available: 'success',
            occupied: 'danger',
            maintenance: 'warning',
            reserved: 'info',
        };
        return <span className={`badge bg-${colors[status] || 'secondary'}`}>{status}</span>;
    };

    if (loading) {
        return <div className="text-center mt-5">Loading stalls...</div>;
    }

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Stalls</h2>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate('/stalls/new')}
                >
                    + Add Stall
                </button>
            </div>

            <div className="mb-3">
                <select
                    className="form-select w-auto"
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

            <div className="table-responsive">
                <table className="table table-hover">
                    <thead>
                        <tr>
                            <th>Stall Number</th>
                            <th>Location</th>
                            <th>Size (sqm)</th>
                            <th>Monthly Rent</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stalls.map((stall) => (
                            <tr key={stall.id}>
                                <td><strong>{stall.stall_number}</strong></td>
                                <td>{stall.location}</td>
                                <td>{stall.size}</td>
                                <td>₱{stall.monthly_rent}</td>
                                <td>{getStatusBadge(stall.status)}</td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-outline-primary me-1"
                                        onClick={() => navigate(`/stalls/edit/${stall.id}`)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => handleDelete(stall.id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {stalls.length === 0 && (
                    <div className="text-center py-4 text-muted">No stalls found</div>
                )}
            </div>
        </div>
    );
};

export default StallList;