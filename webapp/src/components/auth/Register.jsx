import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaStore, FaLock, FaEnvelope, FaUser, FaPhoneAlt, FaMapMarkerAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'tenant',
        phone: '',
        address: '',
    });
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match!');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);
        const { name, email, password, role, phone, address } = formData;
        const result = await register({ name, email, password, role, phone, address });
        setLoading(false);
        
        if (result.success) {
            if (role === 'tenant') {
                navigate('/tenant/dashboard');
            } else {
                navigate('/dashboard');
            }
        }
    };

    return (
        <div
            className="d-flex justify-content-center align-items-center min-vh-100 p-3"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #312e81 100%)' }}
        >
            <div className="card border-0 shadow-2xl rounded-4 overflow-hidden my-4" style={{ width: '100%', maxWidth: '520px', background: '#ffffff' }}>
                <div className="p-4 p-sm-5">
                    <div className="text-center mb-4">
                        <div
                            className="bg-primary bg-opacity-10 text-primary p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-sm"
                            style={{ width: '60px', height: '60px' }}
                        >
                            <FaStore size={28} />
                        </div>
                        <h3 className="fw-bold text-dark mb-1">Create an Account</h3>
                        <p className="text-muted small">Join LeaseHub Stall Leasing System</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-dark">Full Name</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaUser className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="Juan Dela Cruz"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-dark">Email Address</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaEnvelope className="text-muted" />
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="juan@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Password</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <FaLock className="text-muted" />
                                    </span>
                                    <input
                                        type="password"
                                        name="password"
                                        className="form-control border-start-0 bg-light"
                                        placeholder="Min 6 chars"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Confirm Password</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <FaLock className="text-muted" />
                                    </span>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        className="form-control border-start-0 bg-light"
                                        placeholder="Repeat password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Phone Number</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <FaPhoneAlt className="text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        name="phone"
                                        className="form-control border-start-0 bg-light"
                                        placeholder="+63 900 000 0000"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Account Role</label>
                                <select
                                    name="role"
                                    className="form-select bg-light"
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    <option value="tenant">Stall Tenant / Owner</option>
                                    <option value="staff">Staff Operations</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label small fw-semibold text-dark">Home / Business Address</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <FaMapMarkerAlt className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    name="address"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="City, District, Province"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mb-3"
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Complete Registration'}
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-muted small mb-0">
                            Already have an account? <Link to="/login" className="fw-semibold text-primary">Sign In</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;