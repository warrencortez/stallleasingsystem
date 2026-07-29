import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tenantAPI, paymentAPI } from '../../api/endpoints';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaStore, FaPhone, FaEnvelope, FaMapMarkerAlt, FaMoneyBillWave, FaEdit } from 'react-icons/fa';

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
            
            console.log('Fetching tenant with ID:', id);
            
            const [tenantRes, paymentsRes, summaryRes] = await Promise.all([
                tenantAPI.getById(id),
                paymentAPI.getByTenant(id),
                paymentAPI.getTenantSummary(id)
            ]);
            
            console.log('Tenant data:', tenantRes.data);
            
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
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading tenant profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <button
                    className="btn btn-outline-secondary mb-4"
                    onClick={() => navigate('/tenants')}
                >
                    <FaArrowLeft className="me-2" />
                    Back to Tenants
                </button>
                <div className="alert alert-danger">
                    <h5>Error Loading Tenant</h5>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchTenantData}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="p-4">
                <button
                    className="btn btn-outline-secondary mb-4"
                    onClick={() => navigate('/tenants')}
                >
                    <FaArrowLeft className="me-2" />
                    Back to Tenants
                </button>
                <div className="alert alert-warning">
                    <h5>Tenant Not Found</h5>
                    <p>The tenant you're looking for doesn't exist or has been removed.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <button
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/tenants')}
                >
                    <FaArrowLeft className="me-2" />
                    Back to Tenants
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                >
                    <FaEdit className="me-2" />
                    Edit Tenant
                </button>
            </div>

            <div className="row g-4">
                {/* Profile Card */}
                <div className="col-lg-4">
                    <div className="card shadow-sm">
                        <div className="card-body text-center">
                            <div className="rounded-circle bg-primary bg-opacity-10 p-4 mx-auto mb-3" style={{ width: '100px', height: '100px' }}>
                                <span style={{ fontSize: '40px' }}>👤</span>
                            </div>
                            <h4 className="mb-1">{tenant.name}</h4>
                            <span className={`badge bg-${tenant.status === 'active' ? 'success' : tenant.status === 'pending' ? 'warning' : 'secondary'}`}>
                                {tenant.status || 'N/A'}
                            </span>
                            
                            <hr />
                            
                            <div className="text-start">
                                <p className="mb-2">
                                    <FaEnvelope className="text-muted me-2" />
                                    {tenant.email || 'No email'}
                                </p>
                                <p className="mb-2">
                                    <FaPhone className="text-muted me-2" />
                                    {tenant.phone || 'No phone'}
                                </p>
                                <p className="mb-2">
                                    <FaMapMarkerAlt className="text-muted me-2" />
                                    {tenant.address || 'No address'}
                                </p>
                                <p className="mb-0">
                                    <FaStore className="text-muted me-2" />
                                    {tenant.stall_number ? `Stall ${tenant.stall_number}` : 'No stall assigned'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Business Info */}
                <div className="col-lg-8">
                    <div className="card shadow-sm mb-4">
                        <div className="card-body">
                            <h5 className="mb-3">🏢 Business Information</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <small className="text-muted">Business Name</small>
                                    <p className="fw-bold">{tenant.business_name || 'N/A'}</p>
                                </div>
                                <div className="col-md-6">
                                    <small className="text-muted">Business Type</small>
                                    <p className="fw-bold">{tenant.business_type || 'N/A'}</p>
                                </div>
                                {tenant.contract_start && (
                                    <div className="col-md-6">
                                        <small className="text-muted">Contract Start</small>
                                        <p className="fw-bold">{new Date(tenant.contract_start).toLocaleDateString()}</p>
                                    </div>
                                )}
                                {tenant.contract_end && (
                                    <div className="col-md-6">
                                        <small className="text-muted">Contract End</small>
                                        <p className="fw-bold">{new Date(tenant.contract_end).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h5 className="mb-3">💰 Payment Summary</h5>
                            {summary ? (
                                <div className="row g-3">
                                    <div className="col-4">
                                        <div className="bg-success bg-opacity-10 p-3 rounded text-center">
                                            <small className="text-muted">Total Paid</small>
                                            <p className="fw-bold text-success mb-0">
                                                ₱{Number(summary.total_paid || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-danger bg-opacity-10 p-3 rounded text-center">
                                            <small className="text-muted">Balance</small>
                                            <p className="fw-bold text-danger mb-0">
                                                ₱{Number(summary.total_balance || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="bg-info bg-opacity-10 p-3 rounded text-center">
                                            <small className="text-muted">Total Bills</small>
                                            <p className="fw-bold text-info mb-0">
                                                {summary.total || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted">No payment records found</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantProfile;