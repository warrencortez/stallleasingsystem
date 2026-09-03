import React from 'react';
import { FaQrcode, FaPrint, FaTimes, FaStore, FaMapMarkerAlt, FaTag, FaExternalLinkAlt } from 'react-icons/fa';

const QRCodeModal = ({ stall, onClose }) => {
    if (!stall) return null;

    const qrData = encodeURIComponent(
        JSON.stringify({
            stallId: stall.id,
            stallNumber: stall.stall_number,
            location: stall.location,
            monthlyRent: stall.monthly_rent,
            status: stall.status,
            tenant: stall.tenant_name || 'Available'
        })
    );

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}&color=1e293b`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div className="modal-header bg-dark text-white p-3 border-0">
                        <h6 className="modal-title fw-bold d-flex align-items-center gap-2">
                            <FaQrcode className="text-primary" /> Stall QR Identification Card
                        </h6>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
                    </div>

                    <div className="modal-body p-4 text-center">
                        {/* Printable Stall Identification Card */}
                        <div id="printable-qr-card" className="p-4 border rounded-4 bg-white shadow-sm position-relative">
                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <FaStore className="text-primary fs-4" />
                                    <h5 className="fw-bold mb-0 text-dark">{stall.stall_number}</h5>
                                </div>
                                <span className={`badge-status badge-${stall.status}`}>
                                    {stall.status}
                                </span>
                            </div>

                            {/* QR Code Container */}
                            <div className="my-3 d-flex justify-content-center">
                                <div className="p-2 border rounded-3 bg-light shadow-sm">
                                    <img
                                        src={qrCodeUrl}
                                        alt={`QR Code for ${stall.stall_number}`}
                                        width={200}
                                        height={200}
                                        className="img-fluid rounded"
                                    />
                                </div>
                            </div>

                            <p className="small text-muted mb-3">
                                Scan with mobile camera to view stall lease details or submit a maintenance ticket.
                            </p>

                            <div className="bg-light p-3 rounded-3 text-start small border">
                                <div className="d-flex justify-content-between mb-1">
                                    <span className="text-muted"><FaMapMarkerAlt className="me-1" /> Location:</span>
                                    <span className="fw-semibold text-dark">{stall.location || 'N/A'}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1">
                                    <span className="text-muted"><FaTag className="me-1" /> Monthly Rent:</span>
                                    <span className="fw-bold text-success">₱{Number(stall.monthly_rent).toLocaleString()}/mo</span>
                                </div>
                                {stall.tenant_name && (
                                    <div className="d-flex justify-content-between">
                                        <span className="text-muted">Assigned Tenant:</span>
                                        <span className="fw-semibold text-primary">{stall.tenant_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer bg-light p-3 border-0 d-flex justify-content-between">
                        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                            Close
                        </button>
                        <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handlePrint}>
                            <FaPrint /> Print Identification Card
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
