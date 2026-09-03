import React, { useState, useEffect } from 'react';
import { stallAPI, applicationAPI, tenantAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
    FaStore,
    FaCheckCircle,
    FaTimesCircle,
    FaSearch,
    FaMapMarkerAlt,
    FaRulerCombined,
    FaMoneyBillWave,
    FaFileAlt,
    FaCheck,
    FaTimes,
    FaArrowRight
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MobileStalls = () => {
    const { user } = useAuth();
    const [stalls, setStalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, available, my_lease, occupied
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStall, setSelectedStall] = useState(null);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Current user's tenant record if active
    const [myTenant, setMyTenant] = useState(null);
    const [myStallId, setMyStallId] = useState(null);

    // Application form state
    const [appForm, setAppForm] = useState({
        full_name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        business_name: '',
        business_type: 'Retail / Merchandise',
        notes: ''
    });

    useEffect(() => {
        loadData(true);
        const poll = setInterval(() => {
            loadData(false);
        }, 5000);
        return () => clearInterval(poll);
    }, [user]);

    const loadData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);

            const [stallsRes, tenantRes] = await Promise.allSettled([
                stallAPI.getAll(),
                user?.email ? tenantAPI.getAll({ search: user.email }) : Promise.resolve({ data: { data: [] } })
            ]);

            if (stallsRes.status === 'fulfilled' && stallsRes.value.data?.success) {
                setStalls(stallsRes.value.data.data || []);
            }

            if (tenantRes.status === 'fulfilled' && tenantRes.value.data?.data?.length > 0) {
                const t = tenantRes.value.data.data[0];
                setMyTenant(t);
                setMyStallId(t.stall_id);
            }
        } catch (error) {
            console.error('Error loading stalls data:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleApplyClick = (stall) => {
        setSelectedStall(stall);
        setAppForm({
            full_name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            business_name: '',
            business_type: 'Retail / Merchandise',
            notes: ''
        });
        setShowApplyModal(true);
    };

    const handleApplicationSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStall) return;

        setSubmitting(true);
        try {
            const res = await applicationAPI.create({
                stall_id: selectedStall.id,
                full_name: appForm.full_name,
                email: appForm.email,
                phone: appForm.phone,
                business_name: appForm.business_name,
                business_type: appForm.business_type,
                notes: appForm.notes
            });

            if (res.data?.success) {
                toast.success('Lease application submitted. Admin has been notified for review.');
                setShowApplyModal(false);
                loadData(true);
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to submit application';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredStalls = stalls.filter((s) => {
        const matchesSearch =
            s.stall_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.description?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filter === 'available') return s.status === 'available';
        if (filter === 'occupied') return s.status === 'occupied';
        if (filter === 'my_lease') return s.id === myStallId;

        return true;
    });

    return (
        <div className="mobile-view-container">
            {/* Header */}
            <div className="mobile-header p-3 bg-white border-bottom shadow-sm">
                <h5 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
                    <FaStore className="text-primary" /> Commercial Stalls
                </h5>
                <p className="text-muted small mb-0">Browse vacant spaces, check monthly rates, and apply for leases.</p>
            </div>

            <div className="p-3">
                {/* Search Bar */}
                <div className="input-group mb-3 shadow-sm rounded-3 overflow-hidden">
                    <span className="input-group-text bg-white border-end-0">
                        <FaSearch className="text-muted" />
                    </span>
                    <input
                        type="text"
                        className="form-control border-start-0 bg-white"
                        placeholder="Search stalls or locations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filter Pills */}
                <div className="d-flex gap-2 mb-3 overflow-auto pb-1">
                    <button
                        onClick={() => setFilter('all')}
                        className={`btn btn-sm rounded-pill px-3 fw-semibold ${filter === 'all' ? 'btn-dark' : 'btn-white border text-muted'}`}
                    >
                        All Stalls ({stalls.length})
                    </button>
                    <button
                        onClick={() => setFilter('available')}
                        className={`btn btn-sm rounded-pill px-3 fw-semibold ${filter === 'available' ? 'btn-success' : 'btn-white border text-muted'}`}
                    >
                        Available ({stalls.filter((s) => s.status === 'available').length})
                    </button>
                    {myStallId && (
                        <button
                            onClick={() => setFilter('my_lease')}
                            className={`btn btn-sm rounded-pill px-3 fw-semibold ${filter === 'my_lease' ? 'btn-primary' : 'btn-white border text-muted'}`}
                        >
                            My Rented Stall
                        </button>
                    )}
                    <button
                        onClick={() => setFilter('occupied')}
                        className={`btn btn-sm rounded-pill px-3 fw-semibold ${filter === 'occupied' ? 'btn-secondary' : 'btn-white border text-muted'}`}
                    >
                        Occupied
                    </button>
                </div>

                {/* Stalls List */}
                {loading ? (
                    <div className="text-center py-5 text-muted">
                        <div className="spinner-border text-primary spinner-border-sm me-2" />
                        Loading commercial stalls...
                    </div>
                ) : filteredStalls.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-white rounded-4 p-4 border shadow-sm">
                        <FaStore size={36} className="text-muted mb-2 opacity-50" />
                        <h6 className="fw-bold text-dark">No stalls found</h6>
                        <p className="small text-muted mb-0">No spaces matching your search/filter criteria.</p>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filteredStalls.map((stall) => {
                            const isMyStall = stall.id === myStallId;
                            const isAvailable = stall.status === 'available';

                            return (
                                <div
                                    key={stall.id}
                                    className={`bg-white rounded-4 p-3 border shadow-sm transition ${
                                        isMyStall ? 'border-primary border-2' : ''
                                    }`}
                                >
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <span className="badge bg-light text-primary border mb-1">
                                                {stall.size || '20 sqm'}
                                            </span>
                                            <h5 className="fw-bold text-dark mb-0">{stall.stall_number}</h5>
                                        </div>
                                        <div>
                                            {isMyStall ? (
                                                <span className="badge bg-primary px-2 py-1">MY RENTED STALL</span>
                                            ) : (
                                                <span
                                                    className={`badge ${
                                                        isAvailable ? 'bg-success' : 'bg-secondary'
                                                    } text-uppercase px-2 py-1`}
                                                >
                                                    {stall.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="small text-muted mb-2 d-flex align-items-center gap-1">
                                        <FaMapMarkerAlt className="text-primary" />
                                        <span>{stall.location || 'Commercial Complex'}</span>
                                    </div>

                                    {stall.description && (
                                        <p className="small text-muted mb-3 line-clamp-2">{stall.description}</p>
                                    )}

                                    <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                        <div>
                                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                                MONTHLY LEASE
                                            </small>
                                            <strong className="text-success fs-6">
                                                ₱{Number(stall.monthly_rent || 0).toLocaleString()}
                                            </strong>
                                            <small className="text-muted"> / mo</small>
                                        </div>

                                        <div>
                                            {isMyStall ? (
                                                <span className="badge bg-success bg-opacity-10 text-success p-2 small fw-semibold d-inline-flex align-items-center gap-1">
                                                    <FaCheckCircle /> Active Lease
                                                </span>
                                            ) : isAvailable ? (
                                                <button
                                                    className="btn btn-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                                                    onClick={() => handleApplyClick(stall)}
                                                >
                                                    <span>Apply to Rent</span>
                                                    <FaArrowRight size={11} />
                                                </button>
                                            ) : (
                                                <button className="btn btn-light border btn-sm text-muted" disabled>
                                                    Occupied
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Application Submission */}
            {showApplyModal && selectedStall && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
                >
                    <div className="modal-dialog modal-dialog-centered p-3">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-primary text-white p-3">
                                <div>
                                    <h6 className="modal-title fw-bold text-white mb-0">
                                        Apply for {selectedStall.stall_number}
                                    </h6>
                                    <small className="text-white text-opacity-75">
                                        ₱{Number(selectedStall.monthly_rent).toLocaleString()} / month • {selectedStall.size || '20 sqm'}
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowApplyModal(false)}
                                />
                            </div>

                            <form onSubmit={handleApplicationSubmit}>
                                <div className="modal-body p-3">
                                    <div className="mb-2">
                                        <label className="form-label small fw-bold text-muted mb-1">Full Legal Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            required
                                            value={appForm.full_name}
                                            onChange={(e) => setAppForm({ ...appForm, full_name: e.target.value })}
                                        />
                                    </div>

                                    <div className="row g-2 mb-2">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold text-muted mb-1">Email</label>
                                            <input
                                                type="email"
                                                className="form-control form-control-sm"
                                                required
                                                value={appForm.email}
                                                onChange={(e) => setAppForm({ ...appForm, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold text-muted mb-1">Contact Phone</label>
                                            <input
                                                type="tel"
                                                className="form-control form-control-sm"
                                                required
                                                value={appForm.phone}
                                                onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label small fw-bold text-muted mb-1">Business Trade Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="e.g. Maria's Cafe / Artisan Store"
                                            required
                                            value={appForm.business_name}
                                            onChange={(e) => setAppForm({ ...appForm, business_name: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label small fw-bold text-muted mb-1">Business Category</label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={appForm.business_type}
                                            onChange={(e) => setAppForm({ ...appForm, business_type: e.target.value })}
                                        >
                                            <option value="Food & Beverage">Food & Beverage / Dining</option>
                                            <option value="Retail / Merchandise">Retail / Apparel / Gifts</option>
                                            <option value="Services / Repair">Services / Salon / Repair</option>
                                            <option value="Electronics & Tech">Electronics & Gadgets</option>
                                            <option value="General Commercial">General Commercial</option>
                                        </select>
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label small fw-bold text-muted mb-1">Proposal Notes / Intent</label>
                                        <textarea
                                            rows="2"
                                            className="form-control form-control-sm"
                                            placeholder="Describe your products, operating hours, special requirements..."
                                            value={appForm.notes}
                                            onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer bg-light p-2 px-3">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setShowApplyModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-sm btn-primary px-3 fw-semibold"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Submitting Application...' : 'Send Application for Review'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileStalls;
