import React, { useState, useEffect } from 'react';
import { maintenanceAPI, tenantAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import MobileHeader from '../components/MobileHeader';
import {
    FaWrench,
    FaPlus,
    FaCheckCircle,
    FaClock,
    FaTimes,
    FaCamera,
    FaExclamationTriangle,
    FaTools,
    FaBolt,
    FaTint
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MobileMaintenance = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [tenantProfile, setTenantProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        title: '',
        category: 'general',
        priority: 'medium',
        description: '',
        photo_url: ''
    });
    const [submitting, setSubmitting] = useState(false);

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
            const [mainRes, tenRes] = await Promise.allSettled([
                maintenanceAPI.getAll(),
                user?.email ? tenantAPI.getAll({ search: user.email }) : Promise.resolve({ data: { data: [] } })
            ]);

            if (mainRes.status === 'fulfilled' && mainRes.value.data?.success) {
                setTickets(mainRes.value.data.data || []);
            }

            if (tenRes.status === 'fulfilled' && tenRes.value.data?.data?.length > 0) {
                setTenantProfile(tenRes.value.data.data[0]);
            }
        } catch (error) {
            console.error('Error loading maintenance:', error);
            if (isInitial) toast.error('Failed to load maintenance tickets');
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const payload = {
                tenant_id: tenantProfile?.id,
                stall_id: tenantProfile?.stall_id,
                ...form
            };

            const res = await maintenanceAPI.create(payload);
            if (res.data?.success) {
                toast.success('Maintenance ticket submitted. Admin notified.');
                setShowModal(false);
                setForm({
                    title: '',
                    category: 'general',
                    priority: 'medium',
                    description: '',
                    photo_url: ''
                });
                loadData(true);
            } else {
                toast.error(res.data?.message || 'Failed to submit report');
            }
        } catch (error) {
            console.error('Maintenance submit error:', error);
            toast.error('Could not submit ticket. Please check connection.');
        } finally {
            setSubmitting(false);
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'electrical': return <FaBolt className="text-warning" />;
            case 'plumbing': return <FaTint className="text-info" />;
            case 'roof_leak': return <FaTint className="text-primary" />;
            default: return <FaTools className="text-secondary" />;
        }
    };

    return (
        <>
            <MobileHeader title="Maintenance Hub" subtitle="Report stall damages & track repair status" />

            <div className="mobile-content">
                {/* Header CTA Card */}
                <div className="mobile-card p-3 bg-white border-0 shadow-sm mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <span className="text-muted small d-block">Leased Stall</span>
                            <h6 className="fw-bold text-dark mb-0">
                                {tenantProfile ? `${tenantProfile.stall_number} (${tenantProfile.business_name})` : 'Stall Maintenance'}
                            </h6>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="btn btn-warning btn-sm fw-bold px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1"
                        >
                            <FaPlus /> Report Issue
                        </button>
                    </div>
                </div>

                {/* Tickets Tracker List */}
                <div className="mb-3">
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                        <FaWrench className="text-primary" /> My Maintenance Tickets ({tickets.length})
                    </h6>

                    {loading ? (
                        <div className="text-center py-5 text-muted">
                            <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                            Loading ticket status...
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="mobile-card text-center py-5 text-muted">
                            <FaCheckCircle size={36} className="text-success opacity-50 mb-2" />
                            <h6 className="fw-bold text-dark mb-1">All Clear!</h6>
                            <p className="small mb-0">No active maintenance issues reported for your stall.</p>
                        </div>
                    ) : (
                        tickets.map((t) => {
                            const isPending = t.status === 'pending';
                            const isInProgress = t.status === 'in_progress';
                            const isCompleted = t.status === 'completed';

                            return (
                                <div key={t.id} className="mobile-card p-3 mb-2">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="p-2 bg-light rounded-circle">
                                                {getCategoryIcon(t.category)}
                                            </div>
                                            <div>
                                                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.95rem' }}>{t.title}</h6>
                                                <small className="text-muted text-capitalize">{t.category?.replace('_', ' ')} • {t.stall_number || 'Stall'}</small>
                                            </div>
                                        </div>
                                        <span
                                            className={`badge ${
                                                isCompleted ? 'bg-success' : isInProgress ? 'bg-primary' : 'bg-warning text-dark'
                                            }`}
                                        >
                                            {t.status?.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <p className="text-muted small mb-2">{t.description}</p>

                                    {t.resolution_notes && (
                                        <div className="bg-light p-2 rounded-3 small border mb-2">
                                            <strong className="text-primary">Admin Resolution:</strong> {t.resolution_notes}
                                        </div>
                                    )}

                                    <div className="d-flex justify-content-between align-items-center text-muted" style={{ fontSize: '0.72rem' }}>
                                        <span>Priority: <strong className="text-uppercase text-dark">{t.priority}</strong></span>
                                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* REPORT ISSUE BOTTOM SHEET MODAL */}
            {/* ========================================================= */}
            {showModal && (
                <div className="mobile-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="sheet-handle"></div>

                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h5 className="fw-bold text-dark mb-0">Report Stall Issue</h5>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-sm btn-light rounded-circle p-1"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket}>
                            <div className="mb-3">
                                <label className="form-label small fw-semibold text-muted">Issue Subject / Title</label>
                                <input
                                    type="text"
                                    className="form-control bg-light"
                                    required
                                    placeholder="e.g. Ceiling leak near front shutter"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label small fw-semibold text-muted">Category</label>
                                    <select
                                        className="form-select bg-light"
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    >
                                        <option value="roof_leak">Roof / Ceiling Leak</option>
                                        <option value="electrical">Electrical / Lights</option>
                                        <option value="plumbing">Plumbing / Water</option>
                                        <option value="structural">Door / Shutter Damage</option>
                                        <option value="pest_control">Pest Control</option>
                                        <option value="general">General Repair</option>
                                    </select>
                                </div>

                                <div className="col-6">
                                    <label className="form-label small fw-semibold text-muted">Priority</label>
                                    <select
                                        className="form-select bg-light"
                                        value={form.priority}
                                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small fw-semibold text-muted">Detailed Description</label>
                                <textarea
                                    rows="3"
                                    className="form-control bg-light"
                                    required
                                    placeholder="Describe the issue, location inside stall, and when it started..."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn btn-warning w-100 py-3 rounded-4 fw-bold shadow text-dark"
                            >
                                {submitting ? 'Submitting Report...' : 'Submit Issue to Admin'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileMaintenance;
