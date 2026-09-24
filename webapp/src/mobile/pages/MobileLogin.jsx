import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaStore, FaLock, FaEnvelope, FaArrowRight, FaBolt } from 'react-icons/fa';
import toast from 'react-hot-toast';
import '../styles/mobile.css';

const MobileLogin = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await login(formData.email, formData.password);
            if (res.success) {
                toast.success('Welcome back to Dela Costa HOA Stall Leasing.');
                navigate('/mobile/dashboard');
            } else {
                toast.error(res.message || 'Invalid email or password');
            }
        } catch (error) {
            toast.error('Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleFillDemoTenant = () => {
        setFormData({
            email: 'maria@stalllease.com',
            password: 'tenant123'
        });
        toast.success('Demo Tenant credentials loaded');
    };

    return (
        <div className="mobile-app-container d-flex flex-column justify-content-between p-4 bg-white" style={{ minHeight: '100vh' }}>
            <div>
                {/* Brand Header */}
                <div className="text-center mt-4 mb-4">
                    <div
                        className="bg-primary text-white rounded-4 d-inline-flex align-items-center justify-content-center mb-3 shadow"
                        style={{ width: 64, height: 64 }}
                    >
                        <FaStore size={32} />
                    </div>
                    <h4 className="fw-bold text-dark mb-1">Dela Costa HOA Stall Leasing</h4>
                    <p className="text-muted small">Tenant Self-Service & Commercial Space Portal</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="mb-4">
                    <div className="mb-3">
                        <label className="form-label small fw-semibold text-muted">Email Address</label>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 text-muted">
                                <FaEnvelope />
                            </span>
                            <input
                                type="email"
                                className="form-control bg-light border-start-0 py-2"
                                placeholder="name@domain.com"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="form-label small fw-semibold text-muted">Password</label>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 text-muted">
                                <FaLock />
                            </span>
                            <input
                                type="password"
                                className="form-control bg-light border-start-0 py-2"
                                placeholder="••••••••"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-100 py-3 rounded-4 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" /> Signing In...
                            </>
                        ) : (
                            <>
                                <span>Sign In to Portal</span> <FaArrowRight />
                            </>
                        )}
                    </button>
                </form>

                {/* Demo Shortcut */}
                <div className="text-center mb-3">
                    <button
                        type="button"
                        onClick={handleFillDemoTenant}
                        className="btn btn-sm btn-outline-secondary rounded-pill px-3 d-inline-flex align-items-center gap-1"
                    >
                        <FaBolt className="text-warning" /> Fill Demo Tenant (Maria Santos)
                    </button>
                </div>
            </div>

            {/* Bottom Register Prompt */}
            <div className="text-center pt-3 border-top pb-4">
                <p className="text-muted small mb-0">
                    Don't have an account yet?{' '}
                    <Link to="/mobile/register" className="fw-bold text-primary text-decoration-none">
                        Register as Tenant
                    </Link>
                </p>
                <div className="mt-2">
                    <Link to="/dashboard" className="text-muted small text-decoration-underline" style={{ fontSize: '0.75rem' }}>
                        Switch to Admin Dashboard Website
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default MobileLogin;
