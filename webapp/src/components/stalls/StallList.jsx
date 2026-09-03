import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stallAPI } from '../../api/endpoints';
import StallStatusBadge from './StallStatusBadge';
import StallDetailsModal from './StallDetailsModal';
import QRCodeModal from '../common/QRCodeModal';
import ConfirmModal from '../common/ConfirmModal';
import { 
    FaEdit, 
    FaTrash, 
    FaPlus, 
    FaQrcode, 
    FaSearch, 
    FaStore, 
    FaInfoCircle,
    FaExclamationTriangle,
    FaTools,
    FaMapMarkerAlt,
    FaUser
} from 'react-icons/fa';

const StallList = () => {
    const [stalls, setStalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQRStall, setSelectedQRStall] = useState(null);
    const [selectedDetailsStallId, setSelectedDetailsStallId] = useState(null);
    const [deleteStallTarget, setDeleteStallTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    // Initial load and continuous real-time auto-polling every 5s
    useEffect(() => {
        fetchStalls(true);
        const interval = setInterval(() => {
            fetchStalls(false);
        }, 5000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchStalls = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const params = {};
            if (filter) params.status = filter;
            if (searchTerm) params.search = searchTerm;
            
            const response = await stallAPI.getAll(params);
            setStalls(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch stalls:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleDeleteClick = (stall) => {
        setDeleteStallTarget(stall);
    };

    const handleConfirmDelete = async () => {
        if (!deleteStallTarget) return;
        const targetNumber = deleteStallTarget.stall_number;
        const targetId = deleteStallTarget.id;
        try {
            setDeleting(true);
            await stallAPI.delete(targetId);
            toast.success(`Stall ${targetNumber} deleted successfully`);
            setDeleteStallTarget(null);
            fetchStalls(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete stall');
            setDeleteStallTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchStalls(true);
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                        <FaStore className="text-primary" /> Stalls Directory & QR Identification
                    </h3>
                    <p className="text-muted mb-0">Commercial spaces overview, tenant assignment, live maintenance tickets, and QR placards.</p>
                </div>
                <button
                    className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 shadow-sm fw-semibold"
                    onClick={() => navigate('/stalls/new')}
                >
                    <FaPlus /> Add New Commercial Stall
                </button>
            </div>

            {/* Filters Bar */}
            <div className="modern-card p-3 mb-4 bg-white border rounded-3 shadow-sm">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-6">
                        <form onSubmit={handleSearch} className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <FaSearch className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 bg-light"
                                placeholder="Search by stall number or location zone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary px-3">
                                Search
                            </button>
                        </form>
                    </div>
                    <div className="col-12 col-md-4">
                        <select
                            className="form-select bg-light"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="">All Statuses ({stalls.length})</option>
                            <option value="available">Available Only</option>
                            <option value="occupied">Occupied Only</option>
                            <option value="maintenance">Under Maintenance</option>
                            <option value="reserved">Reserved</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-2 text-md-end">
                        <span className="badge bg-light text-muted border px-2 py-2">
                            Auto-Sync Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Stall Cards Grid */}
            <div className="row g-4">
                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <div className="spinner-border text-primary spinner-border-sm me-2" />
                        Loading commercial stalls...
                    </div>
                ) : stalls.length === 0 ? (
                    <div className="col-12 text-center py-5 text-muted modern-card bg-white p-5 rounded-4 border">
                        No stalls found matching current filters.
                    </div>
                ) : (
                    stalls.map((stall) => {
                        const hasReports = Number(stall.active_reports_count || 0) > 0;
                        const priority = stall.highest_report_priority || 'low';
                        const isUrgent = priority === 'urgent';
                        const isHigh = priority === 'high';

                        return (
                            <div key={stall.id} className="col-xl-4 col-lg-6 col-md-6">
                                <div className={`modern-card h-100 p-4 d-flex flex-column justify-content-between bg-white rounded-4 shadow-sm border transition ${
                                    hasReports ? 'border-danger border-2' : ''
                                }`}>
                                    <div>
                                        {/* Priority / Maintenance Report Alert Banner */}
                                        {hasReports && (
                                            <div className={`p-2 px-3 rounded-3 mb-3 d-flex align-items-center justify-content-between ${
                                                isUrgent ? 'bg-danger text-white' : isHigh ? 'bg-warning text-dark' : 'bg-info text-dark'
                                            }`}>
                                                <div className="d-flex align-items-center gap-2 small fw-bold">
                                                    <FaExclamationTriangle />
                                                    <span>Active Damage Report ({stall.active_reports_count})</span>
                                                </div>
                                                <span className="badge bg-dark bg-opacity-25 text-uppercase" style={{ fontSize: '0.65rem' }}>
                                                    {priority} Priority
                                                </span>
                                            </div>
                                        )}

                                        {/* Stall Header with Details Button before Status */}
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5 className="fw-bold mb-0 text-dark">
                                                {stall.stall_number}
                                            </h5>
                                            <div className="d-flex align-items-center gap-2">
                                                {/* Prominent Details Button */}
                                                <button
                                                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 py-1 px-2 fw-semibold"
                                                    onClick={() => setSelectedDetailsStallId(stall.id)}
                                                    title="View complete stall specs & tenant history"
                                                >
                                                    <FaInfoCircle size={13} />
                                                    <span>Details</span>
                                                </button>
                                                <StallStatusBadge status={stall.status} />
                                            </div>
                                        </div>
                                        
                                        <p className="text-muted small mb-3 d-flex align-items-center gap-1">
                                            <FaMapMarkerAlt className="text-muted" /> {stall.location || 'Commercial Complex'}
                                        </p>
                                        
                                        <div className="bg-light p-3 rounded-3 border mb-3 small">
                                            <div className="d-flex justify-content-between mb-1">
                                                <span className="text-muted">Space Size:</span>
                                                <strong className="text-dark">{stall.size || '20 sqm'}</strong>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1">
                                                <span className="text-muted">Rental Rate:</span>
                                                <strong className="text-success fs-6">₱{Number(stall.monthly_rent).toLocaleString()} / mo</strong>
                                            </div>
                                            {stall.tenant_name && (
                                                <div className="d-flex justify-content-between pt-1 border-top mt-2">
                                                    <span className="text-muted">Current Tenant:</span>
                                                    <span className="fw-semibold text-primary d-flex align-items-center gap-1">
                                                        <FaUser size={11} /> {stall.tenant_name}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {stall.description && (
                                            <p className="text-muted small mb-0 text-truncate">
                                                {stall.description}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="d-flex flex-wrap gap-2 pt-3 border-top mt-3">
                                        <button
                                            className="btn btn-outline-dark btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                                            onClick={() => setSelectedQRStall(stall)}
                                            title="View / Print QR Code"
                                        >
                                            <FaQrcode /> QR Card
                                        </button>
                                        <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => navigate(`/stalls/edit/${stall.id}`)}
                                            title="Edit Stall"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={() => handleDeleteClick(stall)}
                                            title="Delete Stall"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Stall Complete Details Modal */}
            {selectedDetailsStallId && (
                <StallDetailsModal
                    stallId={selectedDetailsStallId}
                    onClose={() => setSelectedDetailsStallId(null)}
                    onOpenQR={(stall) => setSelectedQRStall(stall)}
                />
            )}

            {/* QR Placard Modal */}
            {selectedQRStall && (
                <QRCodeModal
                    stall={selectedQRStall}
                    onClose={() => setSelectedQRStall(null)}
                />
            )}

            {/* Professional Delete Stall Warning Modal */}
            <ConfirmModal
                isOpen={!!deleteStallTarget}
                title={`Delete Commercial Space: ${deleteStallTarget?.stall_number}`}
                message="Are you sure you want to permanently delete this commercial stall space from the facility registry?"
                type="danger"
                confirmText="Yes, Delete Stall"
                cancelText="Cancel"
                loading={deleting}
                details={[
                    'All lease history and records associated with this stall will be affected.',
                    'If a tenant is currently assigned, their active assignment will be unlinked.',
                    'This action cannot be undone.'
                ]}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteStallTarget(null)}
            />
        </div>
    );
};

export default StallList;