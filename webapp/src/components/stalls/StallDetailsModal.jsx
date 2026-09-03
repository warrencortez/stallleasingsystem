import React, { useState, useEffect } from 'react';
import { stallAPI } from '../../api/endpoints';
import StallStatusBadge from './StallStatusBadge';
import {
    FaStore,
    FaUser,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaWrench,
    FaFileAlt,
    FaTimes,
    FaExclamationTriangle,
    FaHistory,
    FaCheckCircle,
    FaQrcode,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt
} from 'react-icons/fa';

const StallDetailsModal = ({ stallId, onClose, onOpenQR }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'leases', 'payments', 'maintenance', 'applications'

    useEffect(() => {
        if (stallId) {
            fetchStallDetails();
        }
    }, [stallId]);

    const fetchStallDetails = async () => {
        try {
            setLoading(true);
            const res = await stallAPI.getDetails(stallId);
            if (res.data?.success) {
                setDetails(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching stall details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!stallId) return null;

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    {/* Modal Header */}
                    <div className="modal-header bg-dark text-white p-3 px-4 d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary p-2 rounded-3 text-white">
                                <FaStore size={22} />
                            </div>
                            <div>
                                <h5 className="modal-title fw-bold mb-0 text-white">
                                    Stall {details?.stall_number || 'Details'}
                                </h5>
                                <small className="text-light opacity-75">Commercial Space Overview & Complete Ledger History</small>
                            </div>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-light rounded-circle p-2" onClick={onClose}>
                            <FaTimes />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body p-4 bg-light">
                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status" />
                                <p className="mt-2 text-muted fw-semibold">Loading stall details and history records...</p>
                            </div>
                        ) : !details ? (
                            <div className="text-center py-4 text-muted">
                                <p>Stall details could not be retrieved.</p>
                            </div>
                        ) : (
                            <div>
                                {/* Top Stats Bar */}
                                <div className="card shadow-sm border-0 mb-3 bg-white">
                                    <div className="card-body p-3">
                                        <div className="row g-3 align-items-center">
                                            <div className="col-md-3 border-end">
                                                <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Status</small>
                                                <div className="mt-1">
                                                    <StallStatusBadge status={details.status} />
                                                </div>
                                            </div>
                                            <div className="col-md-3 border-end">
                                                <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Rental Rate</small>
                                                <h6 className="fw-bold text-success mb-0 mt-1">
                                                    ₱{Number(details.monthly_rent || 0).toLocaleString()}
                                                    <small className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}> / month</small>
                                                </h6>
                                            </div>
                                            <div className="col-md-3 border-end">
                                                <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Space Size</small>
                                                <h6 className="fw-bold text-dark mb-0 mt-1">{details.size || 'Standard (20 sqm)'}</h6>
                                            </div>
                                            <div className="col-md-3 text-md-end">
                                                <button
                                                    className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1"
                                                    onClick={() => {
                                                        onClose();
                                                        if (onOpenQR) onOpenQR(details);
                                                    }}
                                                >
                                                    <FaQrcode /> View QR Code
                                                </button>
                                            </div>
                                        </div>

                                        {details.location && (
                                            <div className="d-flex align-items-center gap-2 mt-3 pt-2 border-top text-muted small">
                                                <FaMapMarkerAlt className="text-primary" />
                                                <span>{details.location}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Active Renter Profile */}
                                <div className="card shadow-sm border-0 mb-3 bg-white">
                                    <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center gap-2">
                                            <FaUser className="text-primary" />
                                            <h6 className="mb-0 fw-bold">Current Active Tenant</h6>
                                        </div>
                                        {details.active_tenant_name ? (
                                            <span className="badge bg-success bg-opacity-10 text-success fw-bold px-2 py-1">
                                                Active Occupant
                                            </span>
                                        ) : (
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary fw-bold px-2 py-1">
                                                Vacant Space
                                            </span>
                                        )}
                                    </div>
                                    <div className="card-body p-3">
                                        {details.active_tenant_name ? (
                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <div className="fw-bold text-dark fs-6">{details.active_tenant_name}</div>
                                                    <div className="text-muted small fw-semibold">{details.active_business_name || 'Individual Merchant'}</div>
                                                </div>
                                                <div className="col-md-6 text-md-end">
                                                    {details.active_tenant_phone && (
                                                        <div className="small text-muted mb-1">
                                                            <FaPhone className="me-1 text-primary" /> {details.active_tenant_phone}
                                                        </div>
                                                    )}
                                                    {details.active_tenant_email && (
                                                        <div className="small text-muted">
                                                            <FaEnvelope className="me-1 text-primary" /> {details.active_tenant_email}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-12 pt-2 border-top">
                                                    <div className="d-flex flex-wrap gap-4 text-muted small">
                                                        <div>
                                                            <span className="text-muted">Contract Period: </span>
                                                            <strong className="text-dark">
                                                                {details.contract_start ? new Date(details.contract_start).toLocaleDateString() : 'N/A'} - {details.contract_end ? new Date(details.contract_end).toLocaleDateString() : 'Active'}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-3 text-muted">
                                                <p className="mb-0 small">No tenant is currently assigned to this stall space.</p>
                                                <small className="text-muted">You can approve pending applications to lease this space.</small>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Navigation Tabs for History */}
                                <ul className="nav nav-pills nav-fill bg-white p-1 rounded-3 border shadow-sm mb-3">
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link py-2 small fw-bold ${activeTab === 'overview' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('overview')}
                                        >
                                            <FaHistory className="me-1" /> Description & Specs
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link py-2 small fw-bold ${activeTab === 'leases' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('leases')}
                                        >
                                            <FaUser className="me-1" /> Lease History ({details.tenants_history?.length || 0})
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link py-2 small fw-bold ${activeTab === 'payments' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('payments')}
                                        >
                                            <FaMoneyBillWave className="me-1" /> Payments ({details.payments_history?.length || 0})
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link py-2 small fw-bold ${activeTab === 'maintenance' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('maintenance')}
                                        >
                                            <FaWrench className="me-1" /> Maintenance ({details.maintenance_history?.length || 0})
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link py-2 small fw-bold ${activeTab === 'applications' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('applications')}
                                        >
                                            <FaFileAlt className="me-1" /> Applications ({details.applications_history?.length || 0})
                                        </button>
                                    </li>
                                </ul>

                                {/* Tab Contents */}
                                <div className="card shadow-sm border-0 bg-white p-3">
                                    {activeTab === 'overview' && (
                                        <div>
                                            <h6 className="fw-bold mb-2 text-dark">Stall Specifications</h6>
                                            <p className="text-muted small mb-3">
                                                {details.description || 'No detailed specifications or remarks recorded for this stall.'}
                                            </p>
                                            <div className="row g-2 text-muted small">
                                                <div className="col-sm-6">
                                                    <strong>Created Date:</strong> {new Date(details.created_at || Date.now()).toLocaleDateString()}
                                                </div>
                                                <div className="col-sm-6">
                                                    <strong>Last Updated:</strong> {new Date(details.updated_at || Date.now()).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'leases' && (
                                        <div>
                                            <h6 className="fw-bold mb-3 text-dark">Tenant Occupancy History</h6>
                                            {details.tenants_history?.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">No past lease records found.</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-sm table-hover align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Tenant Name</th>
                                                                <th>Business Entity</th>
                                                                <th>Contract Window</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details.tenants_history.map((t) => (
                                                                <tr key={t.id}>
                                                                    <td className="fw-semibold">{t.name}</td>
                                                                    <td>{t.business_name || 'Retail'}</td>
                                                                    <td className="small font-monospace">
                                                                        {t.contract_start ? new Date(t.contract_start).toLocaleDateString() : 'N/A'} - {t.contract_end ? new Date(t.contract_end).toLocaleDateString() : 'Active'}
                                                                    </td>
                                                                    <td>
                                                                        <span className={`badge ${t.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
                                                                            {t.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'payments' && (
                                        <div>
                                            <h6 className="fw-bold mb-3 text-dark">Payment Settlement Records</h6>
                                            {details.payments_history?.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">No payment history recorded for this stall.</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-sm table-hover align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Receipt / Reference</th>
                                                                <th>Tenant</th>
                                                                <th>Amount</th>
                                                                <th>Due Date</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details.payments_history.map((p) => (
                                                                <tr key={p.id}>
                                                                    <td className="font-monospace small">{p.reference_number || 'INV-PENDING'}</td>
                                                                    <td>{p.tenant_name || 'Tenant'}</td>
                                                                    <td className="fw-bold text-success">₱{Number(p.amount).toLocaleString()}</td>
                                                                    <td className="small">{new Date(p.due_date).toLocaleDateString()}</td>
                                                                    <td>
                                                                        <span className={`badge ${p.status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                                            {p.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'maintenance' && (
                                        <div>
                                            <h6 className="fw-bold mb-3 text-dark">Maintenance & Damage Reports</h6>
                                            {details.maintenance_history?.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">No maintenance tickets reported. Space is in good condition.</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-sm table-hover align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Issue Title</th>
                                                                <th>Category</th>
                                                                <th>Priority</th>
                                                                <th>Status</th>
                                                                <th>Reported Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details.maintenance_history.map((m) => (
                                                                <tr key={m.id}>
                                                                    <td className="fw-semibold">{m.title}</td>
                                                                    <td className="text-capitalize">{m.category?.replace('_', ' ')}</td>
                                                                    <td>
                                                                        <span className={`badge ${
                                                                            m.priority === 'urgent' ? 'bg-danger' :
                                                                            m.priority === 'high' ? 'bg-warning text-dark' : 'bg-info text-dark'
                                                                        }`}>
                                                                            {m.priority}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`badge ${m.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                                            {m.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="small font-monospace">{new Date(m.created_at).toLocaleDateString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'applications' && (
                                        <div>
                                            <h6 className="fw-bold mb-3 text-dark">Lease Applications History</h6>
                                            {details.applications_history?.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">No applications received for this space.</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <table className="table table-sm table-hover align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Applicant Name</th>
                                                                <th>Business</th>
                                                                <th>Contact</th>
                                                                <th>Status</th>
                                                                <th>Submitted</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {details.applications_history.map((app) => (
                                                                <tr key={app.id}>
                                                                    <td className="fw-semibold">{app.full_name}</td>
                                                                    <td>{app.business_name}</td>
                                                                    <td className="small">{app.phone}</td>
                                                                    <td>
                                                                        <span className={`badge ${
                                                                            app.status === 'approved' ? 'bg-success' :
                                                                            app.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'
                                                                        }`}>
                                                                            {app.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="small font-monospace">{new Date(app.created_at).toLocaleDateString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer bg-white p-3 border-top">
                        <button className="btn btn-outline-secondary btn-sm px-4" onClick={onClose}>
                            Close Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StallDetailsModal;
