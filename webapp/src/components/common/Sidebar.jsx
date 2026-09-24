import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { maintenanceAPI } from '../../api/endpoints';
import { useSupport } from '../../context/supportContext';
import {
    FaHome,
    FaStore,
    FaUsers,
    FaFileAlt,
    FaCreditCard,
    FaWrench,
    FaBullhorn,
    FaChartBar,
    FaUserCog,
    FaSignOutAlt,
    FaComments
} from 'react-icons/fa';

const Sidebar = ({ isOpen, onClose }) => {
    const { logout, user, isAdmin } = useAuth();
    const { waitingCount, unreadCount } = useSupport();
    const [pendingMaintenance, setPendingMaintenance] = useState(0);

    useEffect(() => {
        const fetchPending = async () => {
            try {
                const res = await maintenanceAPI.getStats();
                if (res.data?.success && res.data.data?.pending !== undefined) {
                    setPendingMaintenance(res.data.data.pending);
                }
            } catch (e) {
                // Silently handle
            }
        };
        fetchPending();
        const interval = setInterval(fetchPending, 5000);
        return () => clearInterval(interval);
    }, []);

    const adminMenuItems = [
        { path: '/dashboard', icon: <FaHome />, label: 'Dashboard' },
        { path: '/stalls', icon: <FaStore />, label: 'Stalls & QR Codes' },
        { path: '/tenants', icon: <FaUsers />, label: 'Tenants Directory' },
        { path: '/conversations', icon: <FaComments />, label: 'Tenant Conversations', badge: waitingCount || unreadCount },
        { path: '/applications', icon: <FaFileAlt />, label: 'Stall Applications' },
        { path: '/payments', icon: <FaCreditCard />, label: 'Billing & Payments' },
        { path: '/maintenance', icon: <FaWrench />, label: 'Maintenance Hub', badge: pendingMaintenance },
        { path: '/announcements', icon: <FaBullhorn />, label: 'Announcements' },
        { path: '/reports', icon: <FaChartBar />, label: 'Reports & Analytics' },
        ...(isAdmin ? [{ path: '/users', icon: <FaUserCog />, label: 'User Accounts' }] : []),
    ];

    return (
        <aside className={`app-sidebar ${isOpen ? 'show-mobile' : ''}`}>
            <div className="sidebar-header d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                    <div className="bg-primary p-2 rounded-3 text-white">
                        <FaStore size={20} />
                    </div>
                    <div>
                        <h6 className="mb-0 fw-bold text-white">Dela Costa HOA Stall Leasing</h6>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Admin Operations
                        </small>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="text-uppercase text-muted px-3 mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    Operations Menu
                </div>
                {adminMenuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `nav-link-custom ${isActive ? 'active' : ''}`
                        }
                    >
                        <span className="fs-5">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge > 0 && (
                            <span className="badge bg-danger rounded-pill ms-auto px-2 py-1" style={{ fontSize: '0.7rem' }}>
                                {item.badge}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-3 border-top border-secondary border-opacity-25">
                <div className="d-flex align-items-center justify-content-between p-2 rounded bg-dark bg-opacity-50">
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div className="badge bg-primary text-capitalize">{user?.role || 'Admin'}</div>
                        <span className="text-white small text-truncate">{user?.name || 'Administrator'}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="btn btn-sm btn-outline-danger p-1 rounded"
                        title="Sign Out"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
