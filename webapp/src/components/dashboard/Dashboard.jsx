import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaStore, 
    FaUsers, 
    FaFileAlt, 
    FaCreditCard, 
    FaExclamationTriangle,
    FaCalendarCheck,
    FaMoneyBillWave,
    FaClock,
    FaCalendarAlt,
    FaBolt,
    FaCheckCircle,
    FaArrowRight
} from 'react-icons/fa';
import { 
    stallAPI, 
    tenantAPI, 
    applicationAPI, 
    paymentAPI 
} from '../../api/endpoints';
import StatsCard from './StatsCard';
import RecentActivity from './RecentActivity';

const Dashboard = () => {
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
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
            total_outstanding: 0,
            today_unpaid_amount: 0,
            today_unpaid_count: 0
        }
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expiringContracts, setExpiringContracts] = useState([]);
    const [overduePayments, setOverduePayments] = useState([]);

    // Live clock updater
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Initial load and continuous real-time auto-polling every 6 seconds
    useEffect(() => {
        fetchDashboardData(true);
        const pollInterval = setInterval(() => {
            fetchDashboardData(false);
        }, 6000);
        return () => clearInterval(pollInterval);
    }, []);

    const fetchDashboardData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            
            const [
                stallRes,
                tenantRes,
                appRes,
                paymentRes,
                expiringRes,
                overdueRes
            ] = await Promise.allSettled([
                stallAPI.getStats(),
                tenantAPI.getStats(),
                applicationAPI.getStats(),
                paymentAPI.getStats(),
                tenantAPI.getExpiring(30),
                paymentAPI.getOverdue()
            ]);

            const stallStats = stallRes.status === 'fulfilled' ? stallRes.value.data?.data : null;
            const tenantStats = tenantRes.status === 'fulfilled' ? tenantRes.value.data?.data : null;
            const appStats = appRes.status === 'fulfilled' ? appRes.value.data?.data : null;
            const paymentStats = paymentRes.status === 'fulfilled' ? paymentRes.value.data?.data : null;
            const expiring = expiringRes.status === 'fulfilled' ? expiringRes.value.data?.data : [];
            const overdue = overdueRes.status === 'fulfilled' ? overdueRes.value.data?.data : [];

            setStats({
                stalls: stallStats || { total: 0, available: 0, occupied: 0, maintenance: 0 },
                tenants: tenantStats || { total: 0, active: 0, inactive: 0, pending: 0 },
                applications: appStats || { total: 0, pending: 0, approved: 0, rejected: 0 },
                payments: paymentStats || { 
                    total: 0, 
                    paid: 0, 
                    unpaid: 0, 
                    overdue: 0,
                    total_collected: 0,
                    total_outstanding: 0,
                    today_unpaid_amount: 0,
                    today_unpaid_count: 0
                }
            });

            setExpiringContracts(expiring || []);
            setOverduePayments(overdue || []);

            // Build activity feed
            buildRecentActivity(overdue || [], expiring || []);

        } catch (error) {
            console.error('Dashboard data fetch error:', error);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    const buildRecentActivity = (overdueList, expiringList) => {
        const activities = [];

        overdueList.forEach(payment => {
            const daysOverdue = Math.floor(
                (new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)
            );
            activities.push({
                id: `overdue-${payment.id}`,
                type: 'overdue',
                message: `${payment.tenant_name || 'Tenant'} has an overdue rental bill of ₱${Number(payment.amount).toLocaleString()} (${daysOverdue} days overdue)`,
                date: payment.due_date,
                priority: 'high'
            });
        });

        expiringList.forEach(tenant => {
            const daysLeft = Math.floor(
                (new Date(tenant.contract_end) - new Date()) / (1000 * 60 * 60 * 24)
            );
            activities.push({
                id: `expiring-${tenant.id}`,
                type: 'expiring',
                message: `${tenant.name}'s lease contract for ${tenant.stall_number || 'Stall'} expires in ${daysLeft} days`,
                date: tenant.contract_end,
                priority: 'medium'
            });
        });

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentActivity(activities.slice(0, 10));
    };

    const formattedFullDateTime = currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) + ' • ' + currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Loading system metrics...</span>
                    </div>
                    <p className="mt-3 text-muted fw-semibold">Loading operations dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            {/* Header with Professional Full Date & Time and Live Sync Status */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                <div>
                    <h3 className="mb-1 fw-bold text-dark">Executive Operations Dashboard</h3>
                    <p className="text-muted mb-0">Real-time commercial stall operations, occupancy pipeline, and revenue tracking.</p>
                </div>
                <div className="d-flex flex-column align-items-md-end gap-1">
                    <div className="d-flex align-items-center gap-2 bg-light border px-3 py-2 rounded-3 shadow-sm">
                        <FaClock className="text-primary" />
                        <span className="fw-bold text-dark font-monospace" style={{ fontSize: '0.95rem' }}>
                            {formattedFullDateTime}
                        </span>
                    </div>
                    <div className="d-flex align-items-center gap-1 mt-1">
                        <span className="spinner-grow text-success" style={{ width: '8px', height: '8px' }} role="status" />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Live Auto-Sync Active</small>
                    </div>
                </div>
            </div>

            {/* 5-Card Stats Grid (Includes Dedicated "Today's Unpaid Rent" Card) */}
            <div className="row g-3 mb-4">
                {/* 1. Today's Unpaid Rent Card */}
                <div className="col-xl-4 col-lg-6 col-md-6">
                    <div className="card shadow-sm border-danger border-opacity-50 h-100 bg-white">
                        <div className="card-body d-flex flex-column justify-content-between p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <span className="badge bg-danger bg-opacity-10 text-danger fw-bold mb-1 px-2 py-1">
                                        ACTION REQUIRED
                                    </span>
                                    <h6 className="text-muted mb-0 fw-semibold">Today's Unpaid Rent</h6>
                                </div>
                                <div className="p-2 rounded-3 bg-danger bg-opacity-10 text-danger fs-4">
                                    <FaExclamationTriangle />
                                </div>
                            </div>
                            <div>
                                <h3 className="fw-bold text-danger mb-1">
                                    ₱{Number(stats.payments.today_unpaid_amount || stats.payments.total_outstanding || 0).toLocaleString()}
                                </h3>
                                <p className="text-muted small mb-2">
                                    {stats.payments.today_unpaid_count || stats.payments.unpaid} pending invoice(s) due for collection
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/payments')}
                                className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-between w-100 fw-bold mt-2"
                            >
                                <span>Review Outstanding Invoices</span>
                                <FaArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Total Stalls Card */}
                <div className="col-xl-2 col-lg-3 col-md-6">
                    <StatsCard
                        title="Commercial Stalls"
                        value={stats.stalls.total}
                        sub={`${stats.stalls.available} Available • ${stats.stalls.occupied} Occupied`}
                        icon={<FaStore />}
                        color="primary"
                        trend={`${stats.stalls.occupied} Active Leases`}
                    />
                </div>

                {/* 3. Active Tenants Card */}
                <div className="col-xl-2 col-lg-3 col-md-6">
                    <StatsCard
                        title="Active Tenants"
                        value={stats.tenants.active}
                        sub={`${stats.tenants.total} Total Registered`}
                        icon={<FaUsers />}
                        color="success"
                        trend={`${stats.tenants.inactive} Inactive`}
                    />
                </div>

                {/* 4. Pending Applications Card */}
                <div className="col-xl-2 col-lg-6 col-md-6">
                    <StatsCard
                        title="Applications"
                        value={stats.applications.pending}
                        sub={`${stats.applications.total} Total • ${stats.applications.approved} Approved`}
                        icon={<FaFileAlt />}
                        color="warning"
                        trend={`${stats.applications.rejected} Rejected`}
                    />
                </div>

                {/* 5. Total Collected Revenue Card */}
                <div className="col-xl-2 col-lg-6 col-md-6">
                    <StatsCard
                        title="Total Collected"
                        value={`₱${Number(stats.payments.total_collected || 0).toLocaleString()}`}
                        sub={`${stats.payments.paid} Invoices Settled`}
                        icon={<FaCreditCard />}
                        color="info"
                        trend={`₱${Number(stats.payments.total_outstanding || 0).toLocaleString()} Balance`}
                    />
                </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="row g-3 mb-4">
                <div className="col-12">
                    <div className="card shadow-sm border-0 bg-white">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center gap-2 mb-3">
                                <FaBolt className="text-primary" />
                                <h6 className="mb-0 fw-bold text-dark">Operational Quick Shortcuts</h6>
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                                <button className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" onClick={() => navigate('/stalls')}>
                                    <FaStore /> Add Commercial Stall
                                </button>
                                <button className="btn btn-success btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" onClick={() => navigate('/tenants')}>
                                    <FaUsers /> Register Tenant
                                </button>
                                <button className="btn btn-warning btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm text-dark" onClick={() => navigate('/applications')}>
                                    <FaFileAlt /> Review Applications ({stats.applications.pending})
                                </button>
                                <button className="btn btn-info btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm text-white" onClick={() => navigate('/payments')}>
                                    <FaMoneyBillWave /> Billing & PayMongo Gateway
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
                            <div className="card border-danger border-opacity-25 shadow-sm h-100">
                                <div className="card-body p-3">
                                    <h6 className="text-danger mb-3 fw-bold d-flex align-items-center gap-2">
                                        <FaExclamationTriangle />
                                        Overdue Rental Invoices ({overduePayments.length})
                                    </h6>
                                    {overduePayments.slice(0, 3).map(payment => (
                                        <div key={payment.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                                            <div>
                                                <div className="fw-semibold small">{payment.tenant_name || 'Tenant'}</div>
                                                <small className="text-muted">{payment.stall_number || 'Stall'}</small>
                                            </div>
                                            <span className="badge bg-danger">₱{Number(payment.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {overduePayments.length > 3 && (
                                        <small className="text-muted d-block mt-2">+{overduePayments.length - 3} additional overdue invoices</small>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {expiringContracts.length > 0 && (
                        <div className="col-md-6">
                            <div className="card border-warning border-opacity-25 shadow-sm h-100">
                                <div className="card-body p-3">
                                    <h6 className="text-warning text-dark mb-3 fw-bold d-flex align-items-center gap-2">
                                        <FaCalendarCheck className="text-warning" />
                                        Lease Contracts Expiring Soon ({expiringContracts.length})
                                    </h6>
                                    {expiringContracts.slice(0, 3).map(tenant => (
                                        <div key={tenant.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                                            <div>
                                                <div className="fw-semibold small">{tenant.name}</div>
                                                <small className="text-muted">{tenant.business_name || 'Merchant'}</small>
                                            </div>
                                            <span className="badge bg-light text-dark border">{tenant.stall_number || 'Stall'}</span>
                                        </div>
                                    ))}
                                    {expiringContracts.length > 3 && (
                                        <small className="text-muted d-block mt-2">+{expiringContracts.length - 3} additional expiring contracts</small>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent Activity Log */}
            <div className="row">
                <div className="col-12">
                    <RecentActivity activities={recentActivity} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;