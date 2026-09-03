import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { announcementAPI, paymentAPI, tenantAPI, maintenanceAPI } from '../../api/endpoints';
import MobileHeader from '../components/MobileHeader';
import {
    FaStore,
    FaCreditCard,
    FaWrench,
    FaBullhorn,
    FaArrowRight,
    FaCheckCircle,
    FaClock,
    FaExclamationCircle,
    FaCalendarAlt
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MobileDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [announcements, setAnnouncements] = useState([]);
    const [tenantProfile, setTenantProfile] = useState(null);
    const [summary, setSummary] = useState(null);
    const [myTickets, setMyTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMobileDashboard();
    }, []);

    const loadMobileDashboard = async () => {
        try {
            setLoading(true);
            const [annRes, tenRes, mainRes] = await Promise.allSettled([
                announcementAPI.getAll({ limit: 5 }),
                tenantAPI.getAll(),
                maintenanceAPI.getAll()
            ]);

            if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
                setAnnouncements(annRes.value.data.data || []);
            }

            // Find current tenant lease profile
            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                const list = tenRes.value.data.data || [];
                const current = list.find((t) => t.email?.toLowerCase() === user?.email?.toLowerCase());
                if (current) {
                    setTenantProfile(current);
                    const sumRes = await paymentAPI.getTenantSummary(current.id);
                    if (sumRes.data?.success) {
                        setSummary(sumRes.data.data);
                    }
                }
            }

            if (mainRes.status === 'fulfilled' && mainRes.value.data?.success) {
                setMyTickets(mainRes.value.data.data || []);
            }
        } catch (error) {
            console.error('Error loading mobile dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <MobileHeader title="Tenant Dashboard" subtitle={`Welcome, ${user?.name?.split(' ')[0] || 'Tenant'}`} />

            <div className="mobile-content">
                {/* 1. Hero Rent Status Card */}
                <div className="mobile-hero-card">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <span className="badge bg-white bg-opacity-25 text-white fw-bold px-3 py-1 rounded-pill mb-2">
                                {tenantProfile ? `Stall: ${tenantProfile.stall_number || 'Assigned'}` : 'Applicant / Member'}
                            </span>
                            <h5 className="fw-bold text-white mb-0">
                                {tenantProfile?.business_name || user?.name}
                            </h5>
                            <small className="text-white text-opacity-75">
                                {tenantProfile?.stall_location || 'Commercial Complex'}
                            </small>
                        </div>
                        <div className="bg-white bg-opacity-20 p-2 rounded-circle text-white">
                            <FaStore size={22} />
                        </div>
                    </div>

                    <div className="border-top border-white border-opacity-25 pt-3 mt-2 d-flex justify-content-between align-items-center">
                        <div>
                            <span className="text-white text-opacity-75 small d-block">Monthly Lease Rent</span>
                            <h4 className="fw-bold text-white mb-0">
                                ₱{Number(tenantProfile?.monthly_rent || 15000).toLocaleString()}
                            </h4>
                        </div>
                        <button
                            onClick={() => navigate('/mobile/billing')}
                            className="btn btn-light btn-sm fw-bold px-3 py-2 rounded-pill shadow-sm text-primary d-inline-flex align-items-center gap-1"
                        >
                            <FaCreditCard size={12} /> Pay Online
                        </button>
                    </div>
                </div>

                {/* 2. Quick Action Buttons */}
                <div className="mobile-actions-grid">
                    <button onClick={() => navigate('/mobile/stalls')} className="mobile-action-btn border-0">
                        <div className="mobile-action-icon bg-primary bg-opacity-10 text-primary">
                            <FaStore />
                        </div>
                        <span>Stalls</span>
                    </button>

                    <button onClick={() => navigate('/mobile/billing')} className="mobile-action-btn border-0">
                        <div className="mobile-action-icon bg-success bg-opacity-10 text-success">
                            <FaCreditCard />
                        </div>
                        <span>PayMongo</span>
                    </button>

                    <button onClick={() => navigate('/mobile/maintenance')} className="mobile-action-btn border-0">
                        <div className="mobile-action-icon bg-warning bg-opacity-10 text-warning">
                            <FaWrench />
                        </div>
                        <span>Report Fix</span>
                    </button>

                    <button onClick={() => navigate('/mobile/billing')} className="mobile-action-btn border-0">
                        <div className="mobile-action-icon bg-info bg-opacity-10 text-info">
                            <FaCalendarAlt />
                        </div>
                        <span>History</span>
                    </button>
                </div>

                {/* 3. Admin Announcements Feed */}
                <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                            <FaBullhorn className="text-primary" /> Admin Advisories & News
                        </h6>
                    </div>

                    {loading ? (
                        <div className="text-center py-4 text-muted small">Loading advisories...</div>
                    ) : announcements.length === 0 ? (
                        <div className="mobile-card text-center py-4 text-muted small">
                            No active admin advisories right now. All operations normal.
                        </div>
                    ) : (
                        announcements.map((ann) => (
                            <div
                                key={ann.id}
                                className={`mobile-announcement-card ${ann.priority === 'urgent' ? 'urgent' : ''}`}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                    <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.95rem' }}>{ann.title}</h6>
                                    <span className="badge bg-secondary text-capitalize" style={{ fontSize: '0.65rem' }}>
                                        {ann.category?.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-muted small mb-2">{ann.content}</p>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                    Posted: {new Date(ann.created_at).toLocaleDateString()}
                                </small>
                            </div>
                        ))
                    )}
                </div>

                {/* 4. Active Maintenance Tracker */}
                <div className="mobile-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                            <FaWrench className="text-warning" /> Stall Maintenance Status
                        </h6>
                        <button
                            onClick={() => navigate('/mobile/maintenance')}
                            className="btn btn-link btn-sm text-primary p-0 text-decoration-none fw-semibold"
                            style={{ fontSize: '0.8rem' }}
                        >
                            + Report Fix
                        </button>
                    </div>

                    {myTickets.length === 0 ? (
                        <div className="text-muted small py-2">
                            No active maintenance tickets for your stall.
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-2">
                            {myTickets.slice(0, 2).map((t) => (
                                <div key={t.id} className="p-2 bg-light rounded-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="fw-semibold text-dark small">{t.title}</div>
                                        <small className="text-muted text-capitalize">{t.category}</small>
                                    </div>
                                    <span className={`badge ${t.status === 'completed' ? 'bg-success' : t.status === 'in_progress' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                                        {t.status?.replace('_', ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MobileDashboard;
