import React, { useState, useEffect } from 'react';
import { paymentAPI, stallAPI, tenantAPI, maintenanceAPI } from '../../api/endpoints';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    FaChartBar,
    FaMoneyBillWave,
    FaStore,
    FaUsers,
    FaWrench,
    FaDownload,
    FaCalendarAlt,
    FaCalendarDay,
    FaCalendarWeek,
    FaHistory,
    FaCheckCircle,
    FaExclamationTriangle,
    FaCreditCard
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-dark text-white p-3 rounded-3 shadow-lg border border-secondary small">
                <p className="fw-bold mb-1 border-bottom pb-1 border-secondary">{label}</p>
                {payload.map((entry, index) => (
                    <p key={`item-${index}`} className="mb-0 d-flex justify-content-between gap-3" style={{ color: entry.color }}>
                        <span>{entry.name}:</span>
                        <span className="fw-bold">₱{Number(entry.value).toLocaleString()}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const Reports = () => {
    const [timeframe, setTimeframe] = useState('monthly'); // 'daily', 'weekly', 'monthly', 'yearly'
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [chartType, setChartType] = useState('area'); // 'area', 'bar'

    // Data States
    const [analytics, setAnalytics] = useState(null);
    const [stallStats, setStallStats] = useState(null);
    const [tenantStats, setTenantStats] = useState(null);
    const [maintenanceStats, setMaintenanceStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalyticsData();
    }, [timeframe, selectedYear]);

    const loadAnalyticsData = async () => {
        try {
            setLoading(true);
            const [analyticsRes, stallRes, tenRes, mainRes] = await Promise.allSettled([
                paymentAPI.getAnalytics({ timeframe, year: selectedYear }),
                stallAPI.getStats(),
                tenantAPI.getStats(),
                maintenanceAPI.getStats()
            ]);

            if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.success) {
                setAnalytics(analyticsRes.value.data.data);
            }
            if (stallRes.status === 'fulfilled' && stallRes.value.data?.success) {
                setStallStats(stallRes.value.data.data);
            }
            if (tenRes.status === 'fulfilled' && tenRes.value.data?.success) {
                setTenantStats(tenRes.value.data.data);
            }
            if (mainRes.status === 'fulfilled' && mainRes.value.data?.success) {
                setMaintenanceStats(mainRes.value.data.data);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            toast.error('Notice: Could not load some analytics reports.');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReport = () => {
        window.print();
    };

    const summary = analytics?.summary || {};
    const chartData = analytics?.chartData || [];
    const paymentMethods = analytics?.paymentMethods || [];

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <FaChartBar className="text-primary" /> Reports & Financial Analytics
                    </h3>
                    <p className="text-muted mb-0">
                        Real-time revenue monitoring, multi-timeframe collection graphs, and commercial stall capacity.
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '110px' }}
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                    >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={handlePrintReport}>
                        <FaDownload /> Print Report
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 1. QUICK GLANCE DATA AT THE TOP */}
            {/* ========================================================= */}
            <div className="row g-3 mb-4">
                {/* Total Collections */}
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card">
                        <div className="stat-icon-wrapper bg-success bg-opacity-10 text-success">
                            <FaMoneyBillWave />
                        </div>
                        <div>
                            <span className="text-muted small">Total Collections</span>
                            <h4 className="fw-bold mb-0 text-success">
                                ₱{Number(summary.all_time_collected || 0).toLocaleString()}
                            </h4>
                            <div className="small text-muted d-flex align-items-center gap-1 mt-1">
                                <span className="badge bg-success bg-opacity-10 text-success fw-semibold">
                                    {summary.collection_rate || 100}% Rate
                                </span>
                                <span>{summary.paid_count || 0} Paid</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Outstanding / Overdue */}
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card">
                        <div className="stat-icon-wrapper bg-danger bg-opacity-10 text-danger">
                            <FaExclamationTriangle />
                        </div>
                        <div>
                            <span className="text-muted small">Total Outstanding</span>
                            <h4 className="fw-bold mb-0 text-danger">
                                ₱{Number(summary.total_outstanding || 0).toLocaleString()}
                            </h4>
                            <div className="small text-muted mt-1">
                                <span className="text-danger fw-semibold">{summary.unpaid_count || 0} Unpaid</span> Invoices
                            </div>
                        </div>
                    </div>
                </div>

                {/* Today & This Week Collections */}
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card">
                        <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary">
                            <FaCalendarDay />
                        </div>
                        <div>
                            <span className="text-muted small">Today's Collections</span>
                            <h4 className="fw-bold mb-0 text-primary">
                                ₱{Number(summary.today_collected || 0).toLocaleString()}
                            </h4>
                            <small className="text-muted">
                                Week Total: <strong>₱{Number(summary.week_collected || 0).toLocaleString()}</strong>
                            </small>
                        </div>
                    </div>
                </div>

                {/* Stall Occupancy & Tenant Health */}
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="stat-card">
                        <div className="stat-icon-wrapper bg-warning bg-opacity-10 text-warning">
                            <FaStore />
                        </div>
                        <div>
                            <span className="text-muted small">Stall Occupancy</span>
                            <h4 className="fw-bold mb-0 text-dark">
                                {stallStats?.total > 0
                                    ? `${Math.round(((stallStats.occupied || 0) / stallStats.total) * 100)}%`
                                    : '0%'}
                            </h4>
                            <small className="text-muted">
                                {stallStats?.occupied || 0} / {stallStats?.total || 0} Stalls Leased
                            </small>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 2. DETAILED REPORT GRAPH (DAILY, WEEKLY, MONTHLY, YEARLY) */}
            {/* ========================================================= */}
            <div className="modern-card p-4 mb-4 shadow-sm">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 border-bottom pb-3">
                    <div>
                        <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                            <FaChartBar className="text-primary" /> Revenue & Collections Breakdown
                        </h5>
                        <p className="text-muted small mb-0">
                            Select a timeframe below to view daily, weekly, monthly, or multi-year financial trends.
                        </p>
                    </div>

                    {/* Timeframe & Chart Style Toggles */}
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <div className="btn-group btn-group-sm p-1 bg-light rounded-3 border" role="group">
                            <button
                                type="button"
                                className={`btn btn-sm ${timeframe === 'daily' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setTimeframe('daily')}
                            >
                                <FaCalendarDay className="me-1" /> Daily
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${timeframe === 'weekly' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setTimeframe('weekly')}
                            >
                                <FaCalendarWeek className="me-1" /> Weekly
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${timeframe === 'monthly' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setTimeframe('monthly')}
                            >
                                <FaCalendarAlt className="me-1" /> Monthly
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${timeframe === 'yearly' ? 'btn-primary shadow-sm' : 'btn-light text-muted'}`}
                                onClick={() => setTimeframe('yearly')}
                            >
                                <FaHistory className="me-1" /> Yearly
                            </button>
                        </div>

                        <div className="btn-group btn-group-sm bg-light rounded-3 border" role="group">
                            <button
                                type="button"
                                className={`btn btn-sm ${chartType === 'area' ? 'btn-dark' : 'btn-light text-muted'}`}
                                onClick={() => setChartType('area')}
                                title="Smooth Area Graph"
                            >
                                Area
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${chartType === 'bar' ? 'btn-dark' : 'btn-light text-muted'}`}
                                onClick={() => setChartType('bar')}
                                title="Bar Chart"
                            >
                                Bar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Graph Visualization */}
                <div style={{ width: '100%', height: 360 }}>
                    {loading ? (
                        <div className="h-100 d-flex align-items-center justify-content-center text-muted">
                            <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                            Calculating analytics...
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                            <FaChartBar size={36} className="text-muted opacity-50 mb-2" />
                            <p className="mb-0">No payment transactions recorded for this timeframe.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'area' ? (
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                        </linearGradient>
                                        <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Area type="monotone" dataKey="collected" name="Collected Revenue (₱)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" />
                                    <Area type="monotone" dataKey="expected" name="Expected Invoices (₱)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorExpected)" />
                                </AreaChart>
                            ) : (
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="collected" name="Collected Revenue (₱)" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="expected" name="Expected Invoices (₱)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* 3. SECONDARY BREAKDOWNS: PAYMENT METHODS & CAPACITY */}
            {/* ========================================================= */}
            <div className="row g-4 mb-4">
                {/* Payment Gateway Distribution */}
                <div className="col-12 col-lg-6">
                    <div className="modern-card p-4 h-100 shadow-sm">
                        <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                            <FaCreditCard className="text-primary" /> Settlement Channels
                        </h5>
                        {paymentMethods.length > 0 ? (
                            <div className="row align-items-center">
                                <div className="col-6" style={{ height: 180 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={paymentMethods}
                                                dataKey="total_amount"
                                                nameKey="method"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={75}
                                                paddingAngle={4}
                                            >
                                                {paymentMethods.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="col-6">
                                    <div className="d-flex flex-column gap-2 small">
                                        {paymentMethods.map((pm, idx) => (
                                            <div key={idx} className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                                    <span className="text-capitalize text-dark fw-medium">{pm.method.replace('_', ' ')}</span>
                                                </div>
                                                <span className="fw-bold text-dark">₱{Number(pm.total_amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted small py-4 text-center">
                                No settled payments found yet. Settle an invoice to see channel metrics.
                            </div>
                        )}
                    </div>
                </div>

                {/* Stall Capacity Breakdown */}
                <div className="col-12 col-lg-6">
                    <div className="modern-card p-4 h-100 shadow-sm">
                        <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                            <FaStore className="text-primary" /> Commercial Stall Capacity
                        </h5>
                        {stallStats ? (
                            <div className="d-flex flex-column gap-3">
                                <div>
                                    <div className="d-flex justify-content-between mb-1 small">
                                        <span className="fw-semibold text-dark">Occupied Leases</span>
                                        <span className="fw-bold text-primary">
                                            {stallStats.occupied || 0} ({Math.round(((stallStats.occupied || 0) / (stallStats.total || 1)) * 100)}%)
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '10px' }}>
                                        <div
                                            className="progress-bar bg-primary rounded-pill"
                                            style={{ width: `${((stallStats.occupied || 0) / (stallStats.total || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="d-flex justify-content-between mb-1 small">
                                        <span className="fw-semibold text-dark">Available Stalls</span>
                                        <span className="fw-bold text-success">
                                            {stallStats.available || 0} ({Math.round(((stallStats.available || 0) / (stallStats.total || 1)) * 100)}%)
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '10px' }}>
                                        <div
                                            className="progress-bar bg-success rounded-pill"
                                            style={{ width: `${((stallStats.available || 0) / (stallStats.total || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="d-flex justify-content-between mb-1 small">
                                        <span className="fw-semibold text-dark">Under Maintenance</span>
                                        <span className="fw-bold text-warning">{stallStats.maintenance || 0}</span>
                                    </div>
                                    <div className="progress" style={{ height: '10px' }}>
                                        <div
                                            className="progress-bar bg-warning rounded-pill"
                                            style={{ width: `${((stallStats.maintenance || 0) / (stallStats.total || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted small">Loading occupancy stats...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 4. BREAKDOWN AUDIT TABLE */}
            {/* ========================================================= */}
            <div className="modern-card overflow-hidden shadow-sm">
                <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold mb-0 text-dark">
                        {timeframe.toUpperCase()} Financial Audit Breakdown ({selectedYear})
                    </h6>
                    <span className="badge bg-secondary">{chartData.length} Intervals Recorded</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Interval / Period</th>
                                <th>Collected Revenue</th>
                                <th>Expected Invoices</th>
                                <th>Settlement Efficiency</th>
                                <th className="text-end pe-4">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-4 text-muted">
                                        No data available for this timeframe.
                                    </td>
                                </tr>
                            ) : (
                                chartData.map((row, idx) => {
                                    const collected = Number(row.collected || 0);
                                    const expected = Number(row.expected || 0);
                                    const eff = expected > 0 ? Math.round((collected / expected) * 100) : (collected > 0 ? 100 : 0);

                                    return (
                                        <tr key={idx}>
                                            <td className="ps-4 fw-semibold text-dark">{row.label}</td>
                                            <td className="fw-bold text-success">₱{collected.toLocaleString()}</td>
                                            <td className="text-muted">₱{expected.toLocaleString()}</td>
                                            <td>
                                                <span className={`badge ${eff >= 80 ? 'bg-success' : eff > 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                                    {eff}%
                                                </span>
                                            </td>
                                            <td className="text-end pe-4 text-muted">{row.count || 0} payments</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;
