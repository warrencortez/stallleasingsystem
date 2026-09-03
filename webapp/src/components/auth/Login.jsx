import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaStore, FaLock, FaEnvelope, FaShieldAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';

const Login = () => {
    const [formData, setFormData] = useState({
        email: 'rentastall@gmail.com',
        password: 'admin123',
    });
    const [loading, setLoading] = useState(false);
    const { login, logout } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await login(formData.email, formData.password);
        setLoading(false);
        if (result.success) {
            if (result.user?.role !== 'admin') {
                logout();
                toast.error('Access Restricted: The Web Management Hub is reserved for Administrators only. Tenants must access the system via the Mobile App.');
                return;
            }
            navigate('/dashboard');
        }
    };

    return (
        <div
            className="d-flex justify-content-center align-items-center min-vh-100 p-3"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #312e81 100%)' }}
        >
            <div className="card border-0 shadow-2xl rounded-4 overflow-hidden" style={{ width: '100%', maxWidth: '440px', background: '#ffffff' }}>
                <div className="p-4 p-sm-5">
                    <div className="text-center mb-4">
                        <div
                            className="bg-primary bg-opacity-10 text-primary p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm"
                            style={{ width: '64px', height: '64px' }}
                        >
                            <FaStore size={32} />
                        </div>
                        <h3 className="fw-bold text-dark mb-1">LeaseHub</h3>
                        <p className="text-muted small">Administrative Management Portal</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-dark">Administrator Email</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaEnvelope className="text-muted" />
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="rentastall@gmail.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label small fw-semibold text-dark">Password</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaLock className="text-muted" />
                                </span>
                                <input
                                    type="password"
                                    name="password"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-2.5 fw-semibold shadow-sm mb-3"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" />
                                    Authenticating Administrator...
                                </>
                            ) : (
                                'Sign In to Admin Portal'
                            )}
                        </button>
                    </form>

                    <div className="p-3 bg-light rounded-3 border text-center text-muted small">
                        <div className="d-flex align-items-center justify-content-center gap-1 mb-1 text-primary fw-semibold">
                            <FaShieldAlt /> Enterprise Security Active
                        </div>
                        <div>Authorized facility management personnel only.</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;