import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaStore, FaLock, FaUser, FaPhone, FaArrowRight, FaCheck } from 'react-icons/fa';
import toast from 'react-hot-toast';
import '../styles/mobile.css';

const MobileRegister = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);

    const hasMinLength = formData.password.length >= 6;
    const hasNoSymbols = formData.password.length > 0 && /^[a-zA-Z0-9]+$/.test(formData.password);
    const isPasswordValid = hasMinLength && hasNoSymbols;

    const handlePhoneChange = (e) => {
        let digits = e.target.value.replace(/[^0-9]/g, '');
        if (digits.startsWith('63')) digits = digits.slice(2);
        while (digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length > 0 && !digits.startsWith('9')) {
            const idx = digits.indexOf('9');
            digits = idx !== -1 ? digits.slice(idx) : '';
        }
        if (digits.length > 10) digits = digits.slice(0, 10);
        setFormData({ ...formData, phone: digits });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Please enter your full name.');
            return;
        }
        if (formData.phone.length !== 10 || !formData.phone.startsWith('9')) {
            toast.error('Please enter a valid 10-digit mobile number starting with 9.');
            return;
        }
        if (!isPasswordValid) {
            toast.error('Password must be a minimum of 6 digits or letters with no symbols.');
            return;
        }
        try {
            setLoading(true);
            const res = await register({
                name: formData.name.trim(),
                phone: `+63${formData.phone}`,
                password: formData.password,
                role: 'tenant'
            });
            if (res.success) {
                toast.success('Registration successful. Welcome to Dela Costa HOA Stall Leasing.');
                navigate('/mobile/dashboard');
            } else {
                toast.error(res.message || 'Registration failed');
            }
        } catch (error) {
            toast.error('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mobile-app-container p-4 bg-white" style={{ minHeight: '100vh' }}>
            {/* Header */}
            <div className="text-center mt-3 mb-4">
                <div
                    className="bg-primary text-white rounded-4 d-inline-flex align-items-center justify-content-center mb-2 shadow"
                    style={{ width: 56, height: 56 }}
                >
                    <FaStore size={28} />
                </div>
                <h4 className="fw-bold text-dark mb-1">Create Tenant Account</h4>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="mb-4">
                <div className="mb-3">
                    <label className="form-label small fw-semibold text-muted">Full Name</label>
                    <div className="input-group">
                        <span className="input-group-text bg-light border-end-0 text-muted">
                            <FaUser />
                        </span>
                        <input
                            type="text"
                            className="form-control bg-light border-start-0 py-2"
                            placeholder="Maria Santos"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                </div>

                <div className="mb-3">
                    <label className="form-label small fw-semibold text-muted">Mobile Number</label>
                    <div className="input-group">
                        <span className="input-group-text bg-secondary bg-opacity-10 border-end-0 fw-bold text-dark">
                            +63
                        </span>
                        <input
                            type="tel"
                            className="form-control bg-light py-2 fw-semibold"
                            placeholder="9XXXXXXXXX"
                            required
                            maxLength={10}
                            value={formData.phone}
                            onChange={handlePhoneChange}
                        />
                    </div>
                </div>

                <div className="mb-3">
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

                    {/* Requirements Indicator Circles */}
                    <div className="mt-2 d-flex flex-column gap-1 ps-1">
                        <div className="d-flex align-items-center gap-2">
                            <span
                                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{
                                    width: 13,
                                    height: 13,
                                    border: `1.5px solid ${hasMinLength ? '#10b981' : '#cbd5e1'}`,
                                    backgroundColor: hasMinLength ? '#10b981' : '#f8fafc',
                                    color: '#fff',
                                    fontSize: 8,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {hasMinLength && <FaCheck size={7} />}
                            </span>
                            <span className="small" style={{ color: hasMinLength ? '#10b981' : '#94a3b8', fontSize: '0.8rem', fontWeight: hasMinLength ? 600 : 500 }}>
                                Minimum of 6 digits or letters
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <span
                                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{
                                    width: 13,
                                    height: 13,
                                    border: `1.5px solid ${hasNoSymbols ? '#10b981' : '#cbd5e1'}`,
                                    backgroundColor: hasNoSymbols ? '#10b981' : '#f8fafc',
                                    color: '#fff',
                                    fontSize: 8,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {hasNoSymbols && <FaCheck size={7} />}
                            </span>
                            <span className="small" style={{ color: hasNoSymbols ? '#10b981' : '#94a3b8', fontSize: '0.8rem', fontWeight: hasNoSymbols ? 600 : 500 }}>
                                No symbols
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary w-100 py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mt-4"
                    disabled={loading || formData.phone.length !== 10 || !isPasswordValid || !formData.name.trim()}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm" />
                            Creating Tenant Account...
                        </>
                    ) : (
                        <>
                            <span>Register as Tenant</span>
                            <FaArrowRight size={14} />
                        </>
                    )}
                </button>
            </form>

            <div className="text-center mt-3">
                <p className="text-muted small">
                    Already registered? <Link to="/mobile/login" className="fw-bold text-primary">Sign In</Link>
                </p>
            </div>
        </div>
    );
};

export default MobileRegister;
