import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaStore, FaBell, FaArrowLeft } from 'react-icons/fa';

const MobileHeader = ({ title, showBack = false, subtitle }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const getInitial = () => {
        if (!user?.name) return 'T';
        return user.name.charAt(0).toUpperCase();
    };

    return (
        <header className="mobile-header">
            <div className="d-flex align-items-center gap-2">
                {showBack ? (
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-sm btn-light rounded-circle p-2 d-flex align-items-center justify-content-center border"
                        style={{ width: 34, height: 34 }}
                    >
                        <FaArrowLeft size={14} className="text-dark" />
                    </button>
                ) : (
                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                        <FaStore size={18} />
                    </div>
                )}
                <div>
                    <h6 className="mobile-header-title mb-0">
                        {title || 'Dela Costa HOA Stall Leasing'}
                    </h6>
                    {subtitle && <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{subtitle}</small>}
                </div>
            </div>

            <div className="d-flex align-items-center gap-2">
                <button
                    onClick={() => navigate('/mobile/profile')}
                    className="mobile-avatar-badge border-0"
                    title="My Profile"
                >
                    {getInitial()}
                </button>
            </div>
        </header>
    );
};

export default MobileHeader;
