import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';
import Sidebar from './components/common/Sidebar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import StallList from './components/stalls/StallList';
import StallForm from './components/stalls/StallForm';
import TenantList from './components/tenants/TenantList';
import TenantForm from './components/tenants/TenantForm';
import TenantProfile from './components/tenants/TenantProfile';
import ApplicationList from './components/applications/ApplicationList';
import ApplicationReview from './components/applications/ApplicationReview';
import PaymentList from './components/payments/PaymentList';
import PaymentStats from './components/payments/PaymentStats';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/global.css';

const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div className="text-center mt-5">Loading...</div>;
    }

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        );
    }

    return (
        <div className="d-flex">
            <Sidebar />
            <div className="flex-grow-1 ms-5" style={{ marginLeft: '250px', padding: '20px' }}>
                <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/stalls" element={<StallList />} />
                    <Route path="/stalls/new" element={<StallForm />} />
                    <Route path="/stalls/edit/:id" element={<StallForm />} />
                    <Route path="/tenants" element={<TenantList />} />
                    <Route path="/tenants/new" element={<TenantForm />} />
                    <Route path="/tenants/edit/:id" element={<TenantForm />} />
                    <Route path="/tenants/:id" element={<TenantProfile />} />
                    <Route path="/applications" element={<ApplicationList />} />
                    <Route path="/applications/review/:id" element={<ApplicationReview />} />
                    <Route path="/payments" element={<PaymentList />} />
                    <Route path="/payments/stats" element={<PaymentStats />} />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
            </div>
        </div>
    );
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <Toaster position="top-right" />
                <AppContent />
            </AuthProvider>
        </Router>
    );
}

export default App;