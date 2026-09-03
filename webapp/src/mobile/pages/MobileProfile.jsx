import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tenantAPI } from '../../api/endpoints';
import MobileHeader from '../components/MobileHeader';
import {
    FaUser,
    FaEnvelope,
    FaPhone,
    FaBriefcase,
    FaStore,
    FaSignOutAlt,
    FaLock,
    FaShieldAlt,
    FaDesktop
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const MobileProfile = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [tenantProfile, setTenantProfile] = useState(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await tenantAPI.getAll();
            if (res.data?.success) {
                const list = res.data.data || [];
                const current = list.find((t) => t.email?.toLowerCase() === user?.email?.toLowerCase());
                if (current) {
                    setTenantProfile(current);
                }
            }
        } catch (error) {
            console.error('Profile load error:', error);
        }
    };

    const handleSignOut = () => {
        logout();
        toast.success('Signed out successfully.');
        navigate('/mobile/login');
    };

    return (
        <>
            <MobileHeader title="Tenant Profile" subtitle="Account details & lease info" />

            <div className="mobile-content">
                {/* Profile Card */}
                <div className="mobile-card text-center p-4 mb-3">
                    <div
                        className="rounded-circle text-white d-inline-flex align-items-center justify-content-center mb-3 shadow"
                        style={{
                            width: 72,
                            height: 72,
                            background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                            fontSize: '1.8rem',
                            fontWeight: 'bold'
                        }}
                    >
                        {user?.name?.charAt(0).toUpperCase() || 'T'}
                    </div>
                    <h5 className="fw-bold text-dark mb-1">{user?.name}</h5>
                    <p className="text-muted small mb-2">{user?.email}</p>
                    <span className="badge bg-primary px-3 py-1 rounded-pill text-capitalize">
                        {user?.role || 'Tenant'} Member
                    </span>
                </div>

                {/* Lease & Business Details */}
                <div className="mobile-card p-3 mb-3">
                    <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <FaStore className="text-primary" /> Lease & Business Info
                    </h6>
                    <div className="d-flex flex-column gap-2 small">
                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span className="text-muted">Assigned Stall:</span>
                            <strong className="text-dark">{tenantProfile?.stall_number || 'N/A'}</strong>
                        </div>
                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span className="text-muted">Business Name:</span>
                            <strong className="text-dark">{tenantProfile?.business_name || 'Individual Merchant'}</strong>
                        </div>
                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span className="text-muted">Phone Contact:</span>
                            <span className="text-dark">{tenantProfile?.phone || user?.phone || 'Not set'}</span>
                        </div>
                        <div className="d-flex justify-content-between py-2">
                            <span className="text-muted">Monthly Rate:</span>
                            <strong className="text-success">₱{Number(tenantProfile?.monthly_rent || 0).toLocaleString()}</strong>
                        </div>
                    </div>
                </div>

                {/* App Switcher & Sign Out */}
                <div className="mobile-card p-3 mb-4">
                    <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <FaShieldAlt className="text-primary" /> Preferences & Actions
                    </h6>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn btn-light w-100 py-2 rounded-3 text-dark fw-semibold d-flex align-items-center justify-content-center gap-2 mb-2 border"
                    >
                        <FaDesktop /> Open Admin Management Website
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="btn btn-outline-danger w-100 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                    >
                        <FaSignOutAlt /> Sign Out of Tenant App
                    </button>
                </div>
            </div>
        </>
    );
};

export default MobileProfile;
