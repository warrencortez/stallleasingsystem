import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tenantAPI, paymentAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaStore, FaPhone, FaEnvelope, FaMapMarkerAlt, FaMoneyBillWave, FaEdit, FaBuilding, FaUser } from 'react-icons/fa';

const TenantProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState(null);
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) {
            fetchTenantData();
        } else {
            setError('No tenant ID provided');
            setLoading(false);
        }
    }, [id]);

    const fetchTenantData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [tenantRes, paymentsRes, summaryRes] = await Promise.all([
                tenantAPI.getById(id),
                paymentAPI.getByTenant(id),
                paymentAPI.getTenantSummary(id)
            ]);
            
            if (!tenantRes.data || !tenantRes.data.data) {
                throw new Error('Tenant not found');
            }
            
            setTenant(tenantRes.data.data);
            setPayments(paymentsRes.data.data || []);
            setSummary(summaryRes.data.data);
        } catch (error) {
            console.error('Error fetching tenant:', error);
            setError(error.response?.data?.message || 'Failed to fetch tenant details');
            toast.error('Failed to fetch tenant details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading tenant profile...</span>
                    </div>
                    <p className="mt-2 text-muted fw-semibold">Loading merchant profile...</p>
                </div>
            </div>
        );
    }

    if (error || !tenant) {
        return (
            <div className="p-4">
                <button
                    className="btn btn-outline-secondary mb-4 btn-sm"
                    onClick={() => navigate('/tenants')}
                >
                    <FaArrowLeft className="me-2" /> Back to Tenants
                </button>
                <div className="alert alert-danger shadow-sm">
                    {error || 'Tenant not found'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                    onClick={() => navigate('/tenants')}
                >
                    <FaArrowLeft /> Back to Tenants List
                </button>
                <button
                    className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
                    onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                >
                    <FaEdit /> Edit Tenant Record
                </button>
            </div>

            <div className="row g-4">
                {/* Personal Profile Card */}
                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 bg-white rounded-4 overflow-hidden h-100">
                        <div className="card-body p-4 text-center">
                            <div className="bg-primary bg-opacity-10 text-primary p-4 rounded-circle d-inline-flex mb-3 fs-2">
                                <FaUser />
                            </div>
                            <h4 className="fw-bold text-dark mb-1">{tenant.name}</h4>
                            <p className="text-muted small mb-3">{tenant.business_name || 'Commercial Merchant'}</p>
                            
                            <span className={`badge ${
                                tenant.status === 'active' ? 'bg-success' : 'bg-secondary'
                            } px-3 py-2 text-uppercase mb-4`}>
                                {tenant.status}
                            </span>

                            <div className="text-start border-top pt-3 small">
                                <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                                    <FaEnvelope className="text-primary" />
                                    <span>{tenant.email || 'No email registered'}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                                    <FaPhone className="text-primary" />
                                    <span>{tenant.phone || 'No phone registered'}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                                    <FaMapMarkerAlt className="text-primary" />
                                    <span>{tenant.address || 'No mailing address'}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2 text-muted">
                                    <FaStore className="text-primary" />
                                    <strong className="text-dark">
                                        {tenant.stall_number ? `Stall ${tenant.stall_number}` : 'No stall assigned'}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Business Info & Payment Summary */}
                <div className="col-lg-8">
                    <div className="card shadow-sm border-0 bg-white rounded-4 mb-4">
                        <div className="card-body p-4">
                            <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2">
                                <FaBuilding className="text-primary" /> Business Trade Information
                            </h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Business Entity</small>
                                    <p className="fw-bold text-dark fs-6 mb-0 mt-1">{tenant.business_name || 'Individual Merchant'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Line of Business</small>
                                    <p className="fw-semibold text-dark mb-0 text-capitalize mt-1">{tenant.business_type || 'General Merchandise'}</p>
                                </div>
                                {tenant.contract_start && (
                                    <div className="col-md-6">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Contract Commenced</small>
                                        <p className="fw-semibold text-dark font-monospace mb-0 mt-1">{new Date(tenant.contract_start).toLocaleDateString()}</p>
                                    </div>
                                )}
                                {tenant.contract_end && (
                                    <div className="col-md-6">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Contract Expiry</small>
                                        <p className="fw-semibold text-dark font-monospace mb-0 mt-1">{new Date(tenant.contract_end).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="card shadow-sm border-0 bg-white rounded-4">
                        <div className="card-body p-4">
                            <h5 className="mb-3 fw-bold text-dark d-flex align-items-center gap-2">
                                <FaMoneyBillWave className="text-success" /> Payment & Ledger Summary
                            </h5>
                            {summary ? (
                                <div className="row g-3">
                                    <div className="col-4">
                                        <div className="bg-success bg-opacity-10 p-3 rounded-3 text-center">
                                            <small className="text-muted d-block">Total Paid</small>
                                            <h5 className="fw-bold text-success mb-0 mt-1">
                                                ₱{Number(summary.total_paid || 0).toLocaleString()}
                                            </h5>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-danger bg-opacity-10 p-3 rounded-3 text-center">
                                            <small className="text-muted d-block">Outstanding</small>
                                            <h5 className="fw-bold text-danger mb-0 mt-1">
                                                ₱{Number(summary.total_balance || 0).toLocaleString()}
                                            </h5>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-primary bg-opacity-10 p-3 rounded-3 text-center">
                                            <small className="text-muted d-block">Total Invoices</small>
                                            <h5 className="fw-bold text-primary mb-0 mt-1">
                                                {summary.total || 0}
                                            </h5>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted small mb-0">No past payment ledger records found for this tenant.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantProfile;