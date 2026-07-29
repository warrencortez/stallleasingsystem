import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    FaHome, 
    FaStore, 
    FaUsers, 
    FaFileAlt, 
    FaCreditCard, 
    FaChartBar,
    FaCog,
    FaSignOutAlt 
} from 'react-icons/fa';

const Sidebar = () => {
    const { logout, isAdmin, isStaff } = useAuth();

    const menuItems = [
        { path: '/dashboard', icon: <FaHome />, label: 'Dashboard' },
        { path: '/stalls', icon: <FaStore />, label: 'Stalls' },
        { path: '/tenants', icon: <FaUsers />, label: 'Tenants' },
        { path: '/applications', icon: <FaFileAlt />, label: 'Applications' },
        { path: '/payments', icon: <FaCreditCard />, label: 'Payments' },
        { path: '/reports', icon: <FaChartBar />, label: 'Reports' },
        { path: '/settings', icon: <FaCog />, label: 'Settings' },
    ];

    return (
        <div className="bg-dark text-white vh-100 p-3" style={{ width: '250px', position: 'fixed', top: 0, left: 0 }}>
            <h4 className="text-center mb-4">🏪 Stall Leasing</h4>
            <hr className="border-secondary" />
            <nav>
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `nav-link text-white d-flex align-items-center gap-2 py-2 px-3 rounded ${
                                isActive ? 'bg-primary' : 'hover-bg-secondary'
                            }`
                        }
                    >
                        {item.icon}
                        {item.label}
                    </NavLink>
                ))}
                <hr className="border-secondary mt-3" />
                <button
                    onClick={logout}
                    className="nav-link text-white d-flex align-items-center gap-2 py-2 px-3 rounded w-100 border-0 bg-transparent"
                >
                    <FaSignOutAlt />
                    Logout
                </button>
            </nav>
        </div>
    );
};

export default Sidebar;