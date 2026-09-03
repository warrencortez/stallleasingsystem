import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tenantAPI, authAPI } from '../../api/endpoints';
import {
    FaUsers,
    FaStore,
    FaCalendarAlt,
    FaPhoneAlt,
    FaMapMarkerAlt,
    FaShieldAlt,
    FaKey
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const TenantProfile = () => {
    const { user, updateUser } = useAuth();
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    const [profileForm, setProfileForm] = useState({
        name: '',
        phone: '',
        address: '',
        emergency_contact: '',
        emergency_phone: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        loadProfile();
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const res = await tenantAPI.getAll();
            if (res.data?.success) {
                const currentTenant = res.data.data?.find(
                    (t) => t.user_id === user?.id || t.email?.toLowerCase() === user?.email?.toLowerCase()
                ) || res.data.data?.[0];

                if (currentTenant) {
                    setTenant(currentTenant);
                    setProfileForm({
                        name: currentTenant.name || user?.name || '',
                        phone: currentTenant.phone || user?.phone || '',
                        address: currentTenant.address || user?.address || '',
                        emergency_contact: currentTenant.emergency_contact || '',
                        emergency_phone: currentTenant.emergency_phone || ''
                    });
                }
            }
        } catch (error) {
            console.error('Error loading tenant profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        try {
            if (tenant) {
                await tenantAPI.update(tenant.id, profileForm);
            }
            await authAPI.updateProfile({
                name: profileForm.name,
                phone: profileForm.phone,
                address: profileForm.address
            });
            updateUser({ ...user, name: profileForm.name, phone: profileForm.phone, address: profileForm.address });
            toast.success('Profile details updated successfully');
        } catch (error) {
            toast.error('Failed to update profile');
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }
        try {
            const res = await authAPI.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            if (res.data?.success) {
                toast.success('Password changed successfully');
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to change password');
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5 text-muted">
                <div className="spinner-border text-primary me-2"></div>
                Loading profile details...
            </div>
        );
    }

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="mb-4">
                <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                    <FaUsers className="text-primary" /> My Stall Lease & Profile
                </h3>
                <p className="text-muted mb-0">View your active lease contract terms, update emergency contacts, and manage password security.</p>
            </div>

            <div className="row g-4">
                {/* Contract Summary Card */}
                {tenant && (
                    <div className="col-12 col-lg-4">
                        <div className="modern-card p-4 h-100">
                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                <h5 className="fw-bold mb-0 text-dark">Active Lease Contract</h5>
                                <span className="badge-status badge-available">Contract Active</span>
                            </div>

                            <div className="d-flex flex-column gap-3 small">
                                <div className="p-3 bg-light rounded-3 border">
                                    <div className="text-muted">Assigned Stall:</div>
                                    <h5 className="fw-bold text-dark mb-0">{tenant.stall_number || 'STALL-A101'}</h5>
                                    <span className="text-muted">{tenant.location}</span>
                                </div>

                                <div>
                                    <span className="text-muted">Business Entity:</span>
                                    <strong className="d-block text-dark">{tenant.business_name} ({tenant.business_type})</strong>
                                </div>

                                <div>
                                    <span className="text-muted">Monthly Rental Rate:</span>
                                    <strong className="d-block text-success fs-5">₱{Number(tenant.monthly_rent || 15000).toLocaleString()}/month</strong>
                                </div>

                                <div className="row g-2">
                                    <div className="col-6">
                                        <span className="text-muted">Contract Start:</span>
                                        <strong className="d-block text-dark">{tenant.contract_start ? new Date(tenant.contract_start).toLocaleDateString() : '2026-01-01'}</strong>
                                    </div>
                                    <div className="col-6">
                                        <span className="text-muted">Contract End:</span>
                                        <strong className="d-block text-dark">{tenant.contract_end ? new Date(tenant.contract_end).toLocaleDateString() : '2026-12-31'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Edit & Security Forms */}
                <div className="col-12 col-lg-8">
                    {/* Contact Info Form */}
                    <div className="modern-card p-4 mb-4">
                        <h5 className="fw-bold text-dark mb-3">Contact & Emergency Details</h5>
                        <form onSubmit={handleProfileSubmit}>
                            <div className="row g-3 mb-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label small fw-semibold">Tenant Full Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        required
                                        value={profileForm.name}
                                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label small fw-semibold">Primary Phone</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        required
                                        value={profileForm.phone}
                                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label small fw-semibold">Home / Business Billing Address</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={profileForm.address}
                                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                                />
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-12 col-md-6">
                                    <label className="form-label small fw-semibold">Emergency Contact Person</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Carlos Santos (Brother)"
                                        value={profileForm.emergency_contact}
                                        onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
                                    />
                                </div>
                                <div className="col-12 col-md-6">
                                    <label className="form-label small fw-semibold">Emergency Phone Number</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. +63 920 111 2222"
                                        value={profileForm.emergency_phone}
                                        onChange={(e) => setProfileForm({ ...profileForm, emergency_phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary">
                                Save Profile Changes
                            </button>
                        </form>
                    </div>

                    {/* Change Password Form */}
                    <div className="modern-card p-4">
                        <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                            <FaKey className="text-secondary" /> Change Account Password
                        </h5>
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="row g-3 mb-3">
                                <div className="col-12 col-md-4">
                                    <label className="form-label small fw-semibold">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        required
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    />
                                </div>
                                <div className="col-12 col-md-4">
                                    <label className="form-label small fw-semibold">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        required
                                        minLength={6}
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    />
                                </div>
                                <div className="col-12 col-md-4">
                                    <label className="form-label small fw-semibold">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        required
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-outline-dark">
                                Update Security Password
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantProfile;
