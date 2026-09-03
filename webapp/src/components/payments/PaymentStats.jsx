import React, { useState, useEffect } from 'react';
import { paymentAPI } from '../../api/endpoints';
import {
    FaChartBar,
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaCalendarAlt
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const PaymentStats = () => {
    const [stats, setStats] = useState(null);
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, [month, year]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const [statsRes, reportRes] = await Promise.all([
                paymentAPI.getStats(),
                paymentAPI.getReport(month, year)
            ]);

            if (statsRes.data?.success) setStats(statsRes.data.data);
            if (reportRes.data?.success) setMonthlyReport(reportRes.data.data);
        } catch (error) {
            console.error('Error loading payment stats:', error);
            toast.error('Failed to load payment statistics');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <FaChartBar className="text-primary" /> Payment & Revenue Analytics
                    </h3>
                    <p className="text-muted mb-0">Financial metrics, monthly collection reports, and delinquency tracking.</p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <select className="form-select form-select-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        className="form-control form-control-sm"
                        style={{ width: '100px' }}
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            {stats && (
                <div className="row g-3 mb-4">
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card">
                            <div className="stat-icon-wrapper bg-success bg-opacity-10 text-success">
                                <FaCheckCircle />
                            </div>
                            <div>
                                <span className="text-muted small">Total Collected</span>
                                <h4 className="fw-bold mb-0 text-success">₱{Number(stats.total_collected || 0).toLocaleString()}</h4>
                                <small className="text-muted">{stats.paid || 0} Settled Bills</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card">
                            <div className="stat-icon-wrapper bg-danger bg-opacity-10 text-danger">
                                <FaExclamationTriangle />
                            </div>
                            <div>
                                <span className="text-muted small">Total Outstanding</span>
                                <h4 className="fw-bold mb-0 text-danger">₱{Number(stats.total_outstanding || 0).toLocaleString()}</h4>
                                <small className="text-danger">{stats.overdue || 0} Overdue Bills</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card">
                            <div className="stat-icon-wrapper bg-warning bg-opacity-10 text-warning">
                                <FaClock />
                            </div>
                            <div>
                                <span className="text-muted small">Unpaid Active</span>
                                <h4 className="fw-bold mb-0 text-warning">{stats.unpaid || 0}</h4>
                                <small className="text-muted">Awaiting Payment</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-sm-6 col-xl-3">
                        <div className="stat-card">
                            <div className="stat-icon-wrapper bg-primary bg-opacity-10 text-primary">
                                <FaMoneyBillWave />
                            </div>
                            <div>
                                <span className="text-muted small">Total Invoices</span>
                                <h4 className="fw-bold mb-0 text-primary">{stats.total || 0}</h4>
                                <small className="text-muted">Lifetime Invoices</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Report Breakdown */}
            {monthlyReport && (
                <div className="row g-4">
                    <div className="col-12 col-md-6">
                        <div className="modern-card p-4 h-100">
                            <h5 className="fw-bold text-dark mb-3">
                                Period Collection: {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}
                            </h5>
                            <div className="bg-light p-3 rounded-3 border mb-3">
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted">Total Monthly Bills:</span>
                                    <strong>{monthlyReport.total_bills || 0}</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted">Paid Count:</span>
                                    <strong className="text-success">{monthlyReport.paid_count || 0}</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted">Unpaid Count:</span>
                                    <strong className="text-warning">{monthlyReport.unpaid_count || 0}</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-muted">Overdue Count:</span>
                                    <strong className="text-danger">{monthlyReport.overdue_count || 0}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-md-6">
                        <div className="modern-card p-4 h-100">
                            <h5 className="fw-bold text-dark mb-3">Collection Progress</h5>
                            {monthlyReport.total_bills > 0 ? (
                                <div>
                                    <div className="d-flex justify-content-between mb-2 small">
                                        <span>Collection Rate</span>
                                        <strong>{Math.round(((monthlyReport.paid_count || 0) / monthlyReport.total_bills) * 100)}%</strong>
                                    </div>
                                    <div className="progress mb-4" style={{ height: '12px' }}>
                                        <div
                                            className="progress-bar bg-success"
                                            style={{ width: `${((monthlyReport.paid_count || 0) / monthlyReport.total_bills) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="d-flex justify-content-between pt-2 border-top">
                                        <span className="text-muted">Total Collected for Month:</span>
                                        <strong className="text-success fs-5">₱{Number(monthlyReport.total_collected || 0).toLocaleString()}</strong>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-muted small py-4 text-center">No bills recorded for this month.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentStats;