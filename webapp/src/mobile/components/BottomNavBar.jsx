import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    FaHome,
    FaStore,
    FaWrench,
    FaCreditCard,
    FaUser
} from 'react-icons/fa';

const BottomNavBar = () => {
    const navItems = [
        { path: '/mobile/dashboard', icon: <FaHome />, label: 'Home' },
        { path: '/mobile/stalls', icon: <FaStore />, label: 'Stalls' },
        { path: '/mobile/maintenance', icon: <FaWrench />, label: 'Fix Hub' },
        { path: '/mobile/billing', icon: <FaCreditCard />, label: 'Billing' },
        { path: '/mobile/profile', icon: <FaUser />, label: 'Profile' }
    ];

    return (
        <nav className="mobile-bottom-nav">
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                        `mobile-nav-item ${isActive ? 'active' : ''}`
                    }
                >
                    {item.icon}
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
};

export default BottomNavBar;
