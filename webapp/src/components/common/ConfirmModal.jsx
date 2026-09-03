import React from 'react';
import { FaExclamationTriangle, FaTrashAlt, FaInfoCircle, FaCheckCircle, FaTimes } from 'react-icons/fa';

const ConfirmModal = ({
    isOpen,
    title = 'Confirm Action',
    message = 'Are you sure you wish to proceed with this operation?',
    type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onClose,
    loading = false,
    details = []
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <FaTrashAlt className="text-danger" size={28} />;
            case 'warning':
                return <FaExclamationTriangle className="text-warning" size={28} />;
            case 'success':
                return <FaCheckCircle className="text-success" size={28} />;
            case 'info':
            default:
                return <FaInfoCircle className="text-primary" size={28} />;
        }
    };

    const getHeaderBg = () => {
        switch (type) {
            case 'danger':
                return 'bg-danger text-white';
            case 'warning':
                return 'bg-warning text-dark';
            case 'success':
                return 'bg-success text-white';
            case 'info':
            default:
                return 'bg-primary text-white';
        }
    };

    const getConfirmBtnClass = () => {
        switch (type) {
            case 'danger':
                return 'btn-danger';
            case 'warning':
                return 'btn-warning text-dark';
            case 'success':
                return 'btn-success';
            case 'info':
            default:
                return 'btn-primary';
        }
    };

    return (
        <div
            className="modal show d-block"
            tabIndex="-1"
            style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 1060
            }}
        >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden animate__animated animate__fadeInDown animate__faster">
                    <div className={`modal-header ${getHeaderBg()} p-3 border-0`}>
                        <div className="d-flex align-items-center gap-2">
                            <h6 className="modal-title fw-bold mb-0">{title}</h6>
                        </div>
                        <button
                            type="button"
                            className={`btn-close ${type !== 'warning' ? 'btn-close-white' : ''}`}
                            onClick={onClose}
                            disabled={loading}
                        />
                    </div>

                    <div className="modal-body p-4 bg-white">
                        <div className="d-flex gap-3 align-items-start">
                            <div className="p-3 bg-light rounded-circle d-flex align-items-center justify-content-center shadow-sm">
                                {getIcon()}
                            </div>
                            <div className="flex-grow-1">
                                <h6 className="fw-bold text-dark mb-1">{title}</h6>
                                <p className="text-muted small mb-2">{message}</p>

                                {details && details.length > 0 && (
                                    <div className="p-2.5 bg-light rounded-3 border small text-muted mt-2">
                                        <ul className="mb-0 ps-3">
                                            {details.map((item, index) => (
                                                <li key={index} className="py-0.5">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer bg-light p-3 border-0 d-flex justify-content-end gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-3 rounded-3"
                            onClick={onClose}
                            disabled={loading}
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${getConfirmBtnClass()} px-4 rounded-3 fw-semibold shadow-sm`}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-1" />
                                    Processing...
                                </>
                            ) : (
                                confirmText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
