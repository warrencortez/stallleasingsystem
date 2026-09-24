import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import StallList from './components/stalls/StallList';
import StallForm from './components/stalls/StallForm';
import TenantList from './components/tenants/TenantList';
import TenantForm from './components/tenants/TenantForm';
import TenantProfileView from './components/tenants/TenantProfile';
import ApplicationList from './components/applications/ApplicationList';
import ApplicationReview from './components/applications/ApplicationReview';
import PaymentList from './components/payments/PaymentList';
import PaymentStats from './components/payments/PaymentStats';
import MaintenanceList from './components/maintenance/MaintenanceList';
import AnnouncementList from './components/announcements/AnnouncementList';
import Reports from './components/reports/Reports';
import UserList from './components/users/UserList';
import ErrorBoundary from './components/common/ErrorBoundary';
import SystemAssistant from './components/chat/SystemAssistant';
import SupportInbox from './components/chat/SupportInbox';
import SupportProvider from './context/SupportProvider';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/global.css';

const AppContent = () => {
    const { isAuthenticated, loading, isAdmin, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                    <p className="mt-3 text-muted fw-semibold">Loading Administrative Portal...</p>
                </div>
            </div>
        );
    }

    // Strictly enforce Admin Portal Access
    if (!isAuthenticated || !isAdmin) {
        return (
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <SupportProvider key={user.id}>
        <div className="app-wrapper">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="app-main-layout">
                <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <main className="content-container">
                    <Routes>
                        {/* Administrator Routes */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/stalls" element={<StallList />} />
                        <Route path="/stalls/new" element={<StallForm />} />
                        <Route path="/stalls/edit/:id" element={<StallForm />} />
                        <Route path="/tenants" element={<TenantList />} />
                        <Route path="/tenants/new" element={<Navigate to="/tenants" replace />} />
                        <Route path="/tenants/edit/:id" element={<TenantForm />} />
                        <Route path="/tenants/:id" element={<TenantProfileView />} />
                        <Route path="/applications" element={<ApplicationList />} />
                        <Route path="/applications/review/:id" element={<ApplicationReview />} />
                        <Route path="/payments" element={<PaymentList />} />
                        <Route path="/payments/stats" element={<PaymentStats />} />
                        <Route path="/maintenance" element={<MaintenanceList />} />
                        <Route path="/announcements" element={<AnnouncementList />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/users" element={<UserList />} />
                        <Route path="/conversations" element={<SupportInbox />} />

                        {/* Default Redirects */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </main>
                <SystemAssistant key={user.id} />
            </div>
        </div>
        </SupportProvider>
    );
};

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AuthProvider>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                            style: {
                                borderRadius: '10px',
                                background: '#1e293b',
                                color: '#fff',
                                fontSize: '14px'
                            }
                        }}
                    />
                    <AppContent />
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
