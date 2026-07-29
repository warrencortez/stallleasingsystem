import React, { useState, useEffect } from 'react';
import { 
    FaStore, 
    FaUsers, 
    FaFileAlt, 
    FaCreditCard, 
    FaExclamationTriangle,
    FaCalendarCheck,
    FaMoneyBillWave
} from 'react-icons/fa';
import { 
    stallAPI, 
    tenantAPI, 
    applicationAPI, 
    paymentAPI 
} from '../../api/endpoints';
import StatsCard from './StatsCard';
import RecentActivity from './RecentActivity';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const [stats, setStats] = useState({
        stalls: { total: 0, available: 0, occupied: 0, maintenance: 0 },
        tenants: { total: 0, active: 0, inactive: 0, pending: 0 },
        applications: { total: 0, pending: 0, approved: 0, rejected: 0 },
        payments: { 
            total: 0, 
            paid: 0, 
            unpaid: 0, 
            overdue: 0,
            total_collected: 0,
            total_outstanding: 0
        }
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expiringContracts, setExpiringContracts] = useState([]);
    const [overduePayments, setOverduePayments] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            
            // Fetch all data in parallel
            const [
                stallStats,
                tenantStats,
                appStats,
                paymentStats,
                expiring,
                overdue
            ] = await Promise.all([
                stallAPI.getStats(),
                tenantAPI.getStats(),
                applicationAPI.getStats(),
                paymentAPI.getStats(),
                tenantAPI.getExpiring(30),
                paymentAPI.getOverdue()
            ]);

            // Update stats
            setStats({
                stalls: stallStats.data.data || { total: 0, available: 0, occupied: 0, maintenance: 0 },
                tenants: tenantStats.data.data || { total: 0, active: 0, inactive: 0, pending: 0 },
                applications: appStats.data.data || { total: 0, pending: 0, approved: 0, rejected: 0 },
                payments: paymentStats.data.data || { 
                    total: 0, 
                    paid: 0, 
                    unpaid: 0, 
                    overdue: 0,
                    total_collected: 0,
                    total_outstanding: 0
                }
            });

            // Set expiring contracts
            setExpiringContracts(expiring.data.data || []);
            setOverduePayments(overdue.data.data || []);

            // Build recent activity
            buildRecentActivity();

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const buildRecentActivity = () => {
        // Create a combined activity feed
        const activities = [];

        // Add overdue payments
        overduePayments.forEach(payment => {
            const daysOverdue = Math.floor(
                (new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)
            );
            activities.push({
                id: `overdue-${payment.id}`,
                type: 'overdue',
                message: `⚠️ ${payment.tenant_name || 'Tenant'} has overdue payment of ₱${payment.amount} (${daysOverdue} days overdue)`,
                date: payment.due_date,
                priority: 'high'
            });
        });

        // Add expiring contracts
        expiringContracts.forEach(tenant => {
            const daysLeft = Math.floor(
                (new Date(tenant.contract_end) - new Date()) / (1000 * 60 * 60 * 24)
            );
            activities.push({
                id: `expiring-${tenant.id}`,
                type: 'expiring',
                message: `📋 ${tenant.name}'s contract expires in ${daysLeft} days`,
                date: tenant.contract_end,
                priority: 'medium'
            });
        });

        // Sort by date (most recent first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Take top 10
        setRecentActivity(activities.slice(0, 10));
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">📊 Dashboard</h2>
                    <p className="text-muted mb-0">Welcome back! Here's what's happening with your stalls today.</p>
                </div>
                <div>
                    <button 
                        className="btn btn-outline-primary me-2"
                        onClick={fetchDashboardData}
                    >
                        🔄 Refresh
                    </button>
                    <span className="badge bg-success p-2">
                        <FaCalendarCheck className="me-1" />
                        {new Date().toLocaleDateString()}
                    </span>
                </div>
            </div>

            {/* Stats Cards Row */}
            <div className="row g-4 mb-4">
                <div className="col-xl-3 col-lg-6 col-md-6">
                    <StatsCard
                        title="Total Stalls"
                        value={stats.stalls.total}
                        sub={`${stats.stalls.available} Available • ${stats.stalls.occupied} Occupied • ${stats.stalls.maintenance} Maintenance`}
                        icon={<FaStore />}
                        color="primary"
                        trend={`${stats.stalls.occupied} occupied`}
                    />
                </div>
                <div className="col-xl-3 col-lg-6 col-md-6">
                    <StatsCard
                        title="Active Tenants"
                        value={stats.tenants.active}
                        sub={`${stats.tenants.total} Total • ${stats.tenants.pending} Pending`}
                        icon={<FaUsers />}
                        color="success"
                        trend={`${stats.tenants.inactive} inactive`}
                    />
                </div>
                <div className="col-xl-3 col-lg-6 col-md-6">
                    <StatsCard
                        title="Pending Applications"
                        value={stats.applications.pending}
                        sub={`${stats.applications.total} Total • ${stats.applications.approved} Approved`}
                        icon={<FaFileAlt />}
                        color="warning"
                        trend={`${stats.applications.rejected} rejected`}
                    />
                </div>
                <div className="col-xl-3 col-lg-6 col-md-6">
                    <StatsCard
                        title="Total Collected"
                        value={`₱${Number(stats.payments.total_collected || 0).toLocaleString()}`}
                        sub={`${stats.payments.paid} Paid • ${stats.payments.unpaid} Unpaid • ${stats.payments.overdue} Overdue`}
                        icon={<FaCreditCard />}
                        color="info"
                        trend={`₱${Number(stats.payments.total_outstanding || 0).toLocaleString()} outstanding`}
                    />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="row g-3 mb-4">
                <div className="col-12">
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h6 className="text-muted mb-3">⚡ Quick Actions</h6>
                            <div className="d-flex flex-wrap gap-2">
                                <button className="btn btn-primary btn-sm">
                                    <FaStore className="me-1" /> Add Stall
                                </button>
                                <button className="btn btn-success btn-sm">
                                    <FaUsers className="me-1" /> Add Tenant
                                </button>
                                <button className="btn btn-warning btn-sm">
                                    <FaFileAlt className="me-1" /> Review Applications
                                </button>
                                <button className="btn btn-info btn-sm">
                                    <FaMoneyBillWave className="me-1" /> Record Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts Row */}
            {(expiringContracts.length > 0 || overduePayments.length > 0) && (
                <div className="row g-3 mb-4">
                    {overduePayments.length > 0 && (
                        <div className="col-md-6">
                            <div className="card border-danger shadow-sm">
                                <div className="card-body">
                                    <h6 className="text-danger mb-2">
                                        <FaExclamationTriangle className="me-1" />
                                        Overdue Payments ({overduePayments.length})
                                    </h6>
                                    {overduePayments.slice(0, 3).map(payment => (
                                        <div key={payment.id} className="d-flex justify-content-between align-items-center border-bottom py-1">
                                            <span>{payment.tenant_name || 'Unknown Tenant'}</span>
                                            <span className="text-danger">₱{payment.amount}</span>
                                        </div>
                                    ))}
                                    {overduePayments.length > 3 && (
                                        <small className="text-muted">+{overduePayments.length - 3} more</small>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {expiringContracts.length > 0 && (
                        <div className="col-md-6">
                            <div className="card border-warning shadow-sm">
                                <div className="card-body">
                                    <h6 className="text-warning mb-2">
                                        <FaCalendarCheck className="me-1" />
                                        Expiring Contracts ({expiringContracts.length})
                                    </h6>
                                    {expiringContracts.slice(0, 3).map(tenant => (
                                        <div key={tenant.id} className="d-flex justify-content-between align-items-center border-bottom py-1">
                                            <span>{tenant.name}</span>
                                            <span className="text-warning">{tenant.stall_number || 'No stall'}</span>
                                        </div>
                                    ))}
                                    {expiringContracts.length > 3 && (
                                        <small className="text-muted">+{expiringContracts.length - 3} more</small>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent Activity */}
            <div className="row">
                <div className="col-12">
                    <RecentActivity activities={recentActivity} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;