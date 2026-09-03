import React, { useState, useEffect } from 'react';
import { announcementAPI } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../common/ConfirmModal';
import {
    FaBullhorn,
    FaPlus,
    FaThumbtack,
    FaTag,
    FaTrash,
    FaCalendarAlt,
    FaUsers
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const AnnouncementList = () => {
    const { isAdmin, isStaff } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [form, setForm] = useState({
        title: '',
        content: '',
        category: 'general',
        is_pinned: false,
        target_audience: 'all'
    });

    useEffect(() => {
        loadAnnouncements(true);
        const poll = setInterval(() => {
            loadAnnouncements(false);
        }, 5000);
        return () => clearInterval(poll);
    }, [categoryFilter]);

    const loadAnnouncements = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const res = await announcementAPI.getAll(categoryFilter ? { category: categoryFilter } : {});
            if (res.data?.success) {
                setAnnouncements(res.data.data || []);
            }
        } catch (error) {
            console.error('Error loading announcements:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await announcementAPI.create(form);
            if (res.data?.success) {
                toast.success('Announcement broadcasted successfully');
                setShowCreateModal(false);
                setForm({ title: '', content: '', category: 'general', is_pinned: false, target_audience: 'all' });
                loadAnnouncements(true);
            }
        } catch (error) {
            toast.error('Failed to broadcast announcement');
        }
    };

    const handleDeleteClick = (ann) => {
        setDeleteTarget(ann);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await announcementAPI.delete(deleteTarget.id);
            toast.success('Announcement deleted.');
            setDeleteTarget(null);
            loadAnnouncements(true);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete announcement');
        } finally {
            setDeleting(false);
        }
    };

    const getCategoryBadgeClass = (category) => {
        switch (category) {
            case 'event': return 'bg-success text-white';
            case 'market_advisory': return 'bg-warning text-dark';
            case 'maintenance_notice': return 'bg-danger text-white';
            case 'billing_reminder': return 'bg-primary text-white';
            default: return 'bg-secondary text-white';
        }
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <FaBullhorn className="text-primary" /> Market Announcements & Advisories
                    </h3>
                    <p className="text-muted mb-0">Broadcast center news, mall schedule adjustments, and advisories to all tenants.</p>
                </div>
                {(isAdmin || isStaff) && (
                    <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowCreateModal(true)}>
                        <FaPlus /> Post Announcement
                    </button>
                )}
            </div>

            {/* Category Filter Pills */}
            <div className="d-flex flex-wrap gap-2 mb-4">
                <button
                    className={`btn btn-sm ${categoryFilter === '' ? 'btn-dark' : 'btn-light border'}`}
                    onClick={() => setCategoryFilter('')}
                >
                    All Announcements
                </button>
                <button
                    className={`btn btn-sm ${categoryFilter === 'event' ? 'btn-dark' : 'btn-light border'} d-inline-flex align-items-center gap-1`}
                    onClick={() => setCategoryFilter('event')}
                >
                    <FaCalendarAlt size={12} /> Events
                </button>
                <button
                    className={`btn btn-sm ${categoryFilter === 'market_advisory' ? 'btn-dark' : 'btn-light border'} d-inline-flex align-items-center gap-1`}
                    onClick={() => setCategoryFilter('market_advisory')}
                >
                    <FaBullhorn size={12} /> Market Advisories
                </button>
                <button
                    className={`btn btn-sm ${categoryFilter === 'billing_reminder' ? 'btn-dark' : 'btn-light border'} d-inline-flex align-items-center gap-1`}
                    onClick={() => setCategoryFilter('billing_reminder')}
                >
                    <FaTag size={12} /> Billing Notices
                </button>
                <button
                    className={`btn btn-sm ${categoryFilter === 'maintenance_notice' ? 'btn-dark' : 'btn-light border'} d-inline-flex align-items-center gap-1`}
                    onClick={() => setCategoryFilter('maintenance_notice')}
                >
                    <FaThumbtack size={12} /> Maintenance
                </button>
            </div>

            {/* Announcements Feed */}
            <div className="row g-4">
                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                        Loading announcements...
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="col-12 text-center py-5 text-muted modern-card">
                        No announcements posted in this category.
                    </div>
                ) : (
                    announcements.map((item) => (
                        <div className="col-12 col-md-6" key={item.id}>
                            <div className={`modern-card p-4 h-100 position-relative ${item.is_pinned ? 'border-primary border-2' : ''}`}>
                                {item.is_pinned && (
                                    <div className="position-absolute top-0 end-0 p-3 text-primary">
                                        <FaThumbtack title="Pinned Announcement" />
                                    </div>
                                )}

                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <span className={`badge ${getCategoryBadgeClass(item.category)} text-capitalize`}>
                                        {item.category?.replace('_', ' ')}
                                    </span>
                                    <span className="badge bg-light text-muted border">
                                        <FaUsers className="me-1" /> {item.target_audience === 'all' ? 'All Tenants & Staff' : item.target_audience}
                                    </span>
                                </div>

                                <h5 className="fw-bold text-dark mb-2">{item.title}</h5>
                                <p className="text-muted small mb-4" style={{ lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                                    {item.content}
                                </p>

                                <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-auto small text-muted">
                                    <div className="d-flex align-items-center gap-1">
                                        <FaCalendarAlt />
                                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {(isAdmin || isStaff) && (
                                        <button
                                            className="btn btn-sm btn-outline-danger p-1 px-2 rounded"
                                            onClick={() => handleDeleteClick(item)}
                                            title="Delete Announcement"
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal: Post Announcement */}
            {showCreateModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Broadcast New Announcement</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreateSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Announcement Title</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Schedule Update, Fair Event..."
                                            required
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Category</label>
                                            <select
                                                className="form-select"
                                                value={form.category}
                                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                            >
                                                <option value="general">General</option>
                                                <option value="event">Event / Fair</option>
                                                <option value="market_advisory">Market Advisory</option>
                                                <option value="billing_reminder">Billing Notice</option>
                                                <option value="maintenance_notice">Maintenance Notice</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Target Audience</label>
                                            <select
                                                className="form-select"
                                                value={form.target_audience}
                                                onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                                            >
                                                <option value="all">All (Everyone)</option>
                                                <option value="tenants">Tenants Only</option>
                                                <option value="staff">Staff Only</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Content</label>
                                        <textarea
                                            rows={4}
                                            className="form-control"
                                            placeholder="Full announcement message..."
                                            required
                                            value={form.content}
                                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="pinCheck"
                                            checked={form.is_pinned}
                                            onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                                        />
                                        <label className="form-check-label small" htmlFor="pinCheck">
                                            Pin this announcement to top of feed
                                        </label>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Broadcast Announcement</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Professional Delete Announcement Warning Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title={`Delete Announcement: ${deleteTarget?.title}`}
                message="Are you sure you want to permanently remove this announcement bulletin?"
                type="danger"
                confirmText="Yes, Delete Announcement"
                cancelText="Cancel"
                loading={deleting}
                details={[
                    'This advisory will be removed from all tenant dashboard notice feeds.',
                    'This action cannot be undone.'
                ]}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default AnnouncementList;
