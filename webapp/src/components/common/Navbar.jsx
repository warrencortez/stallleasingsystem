import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI } from '../../api/endpoints';
import {
    FaBell,
    FaUserCircle,
    FaSignOutAlt,
    FaStore,
    FaUserShield,
    FaExchangeAlt,
    FaBars,
    FaCheckDouble,
    FaUserTie,
    FaUser
} from 'react-icons/fa';
import { IoNotificationsOutline } from 'react-icons/io5';
import toast from 'react-hot-toast';
import playNotificationSound from '../../utils/notificationSound';

const Navbar = ({ onToggleSidebar }) => {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const prevUnreadRef = useRef(null);

    useEffect(() => {
        if (user) {
            fetchNotifications(true);
            // Fast auto-polling for instant real-time notifications (every 4 seconds)
            const interval = setInterval(() => fetchNotifications(false), 4000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchNotifications = async (isInitial = false) => {
        try {
            const res = await notificationAPI.getAll();
            if (res.data?.success) {
                const list = res.data.data || [];
                const currentUnread = res.data.unreadCount || 0;

                // If not initial load and unread count increased, play ring chime and alert admin!
                if (!isInitial && prevUnreadRef.current !== null && currentUnread > prevUnreadRef.current) {
                    playNotificationSound();
                    const latest = list.find((n) => !n.is_read);
                    if (latest) {
                        toast(
                            (t) => (
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        if (latest.link) navigate(latest.link);
                                    }}
                                >
                                    <div className="fw-bold small">{latest.title}</div>
                                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>{latest.message}</div>
                                </div>
                            ),
                            {
                                icon: latest.type?.includes('maintenance') ? '🛠️' : '🔔',
                                duration: 8000,
                                style: {
                                    background: '#0f172a',
                                    color: '#f8fafc',
                                    border: '1px solid #38bdf8',
                                    borderRadius: '10px'
                                }
                            }
                        );
                    }
                }

                prevUnreadRef.current = currentUnread;
                setNotifications(list);
                setUnreadCount(currentUnread);
            }
        } catch (error) {
            // Silently handle
        }
    };

    const handleNotificationClick = async (n) => {
        try {
            await handleMarkAsRead(n.id);
            setShowNotifications(false);
            if (n.link) {
                navigate(n.link);
            }
        } catch (err) {
            console.error('Notification click error:', err);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationAPI.markRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            if (prevUnreadRef.current !== null) {
                prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
            }
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationAPI.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
            prevUnreadRef.current = 0;
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error('Mark all read error:', error);
        }
    };

    return (
        <header className="top-navbar">
            <div className="d-flex align-items-center gap-3">
                <button
                    className="btn btn-sm btn-outline-secondary d-lg-none"
                    onClick={onToggleSidebar}
                    aria-label="Toggle menu"
                >
                    <FaBars />
                </button>
                <div>
                    <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                        <FaStore className="text-primary" />
                        Commercial Lease Hub
                    </h5>
                    <small className="text-muted">Enterprise Stall Management & Operations Platform</small>
                </div>
            </div>

            <div className="d-flex align-items-center gap-3">
                {/* Admin Secure Badge */}
                <div className="d-none d-md-flex align-items-center gap-2 bg-light px-3 py-1.5 rounded-pill border">
                    <FaUserShield className="text-primary" />
                    <span className="small fw-bold text-dark">Administrator Portal</span>
                </div>

                {/* Notifications Dropdown */}
                <div className="position-relative">
                    <button
                        className="btn btn-light position-relative p-2 rounded-circle border shadow-sm"
                        onClick={() => setShowNotifications(!showNotifications)}
                        aria-label="Notifications"
                    >
                        <FaBell className="text-secondary" />
                        {unreadCount > 0 && (
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div
                            className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border p-0"
                            style={{ width: '340px', zIndex: 1050 }}
                        >
                            <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light rounded-top-3">
                                <div className="d-flex align-items-center gap-2">
                                    <IoNotificationsOutline className="text-primary fw-bold" size={18} />
                                    <h6 className="mb-0 fw-bold">Live Notifications</h6>
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        className="btn btn-link btn-sm text-decoration-none p-0 text-primary"
                                        onClick={handleMarkAllRead}
                                    >
                                        <FaCheckDouble className="me-1" /> Mark all read
                                    </button>
                                )}
                            </div>
                            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-muted small">
                                        No recent system alerts. All operational.
                                    </div>
                                ) : (
                                    notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            className={`p-3 border-bottom cursor-pointer transition ${
                                                !n.is_read ? 'bg-light' : ''
                                            }`}
                                            onClick={() => handleNotificationClick(n)}
                                        >
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <strong className="small text-dark">{n.title}</strong>
                                                {!n.is_read && (
                                                    <span className="badge bg-primary" style={{ fontSize: '0.65rem' }}>
                                                        NEW
                                                    </span>
                                                )}
                                            </div>
                                            <p className="small text-muted mb-0">{n.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile Info & Logout */}
                <div className="d-flex align-items-center gap-2 ps-2 border-start">
                    <div className="stat-icon-wrapper bg-primary-light text-primary" style={{ width: '38px', height: '38px', fontSize: '1.2rem' }}>
                        <FaUserCircle />
                    </div>
                    <div className="d-none d-sm-block text-start">
                        <div className="fw-semibold text-dark small">{user?.name || 'Administrator'}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{user?.email || 'rentastall@gmail.com'}</div>
                    </div>
                    <button
                        onClick={logout}
                        className="btn btn-sm btn-outline-danger ms-2 p-2 rounded-circle"
                        title="Sign Out"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
