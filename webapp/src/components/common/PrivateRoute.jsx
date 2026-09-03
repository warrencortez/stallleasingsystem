import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PrivateRoute = ({ children, roles = [] }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return <div className="text-center mt-5">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }

    // Check if user has required role
    if (roles.length > 0 && !roles.includes(user?.role)) {
        return <Navigate to="/dashboard" />;
    }

    return children;
};

export default PrivateRoute;