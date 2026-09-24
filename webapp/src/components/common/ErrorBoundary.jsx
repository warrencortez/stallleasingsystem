import React from 'react';
import { FaExclamationTriangle, FaRedo, FaCopy } from 'react-icons/fa';
import toast from 'react-hot-toast';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.group('%c🚨 [REACT COMPONENT ERROR CAUGHT]', 'color: #ef4444; font-weight: bold;');
        console.error('Error Message:', error.message);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();
    }

    handleCopyReport = () => {
        const report = `=== DELA COSTA HOA STALL LEASING DIAGNOSTIC REPORT ===
Timestamp: ${new Date().toISOString()}
Error: ${this.state.error?.toString()}
Component Stack: ${this.state.errorInfo?.componentStack}
URL: ${window.location.href}`;
        navigator.clipboard.writeText(report);
        toast.success('Diagnostic report copied to clipboard.');
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="container py-5">
                    <div className="card border-danger shadow-lg rounded-4 overflow-hidden mx-auto" style={{ maxWidth: '720px' }}>
                        <div className="card-header bg-danger text-white p-3 d-flex align-items-center gap-2">
                            <FaExclamationTriangle size={20} />
                            <h5 className="mb-0 fw-bold">UI Component Diagnostic Alert</h5>
                        </div>
                        <div className="card-body p-4">
                            <h6 className="fw-bold text-dark mb-2">An unhandled UI exception was caught:</h6>
                            <div className="alert alert-danger font-monospace small mb-3 p-3">
                                {this.state.error?.toString()}
                            </div>

                            {this.state.errorInfo && (
                                <details className="mb-4">
                                    <summary className="text-muted small fw-semibold cursor-pointer mb-2">
                                        View Component Stack Trace
                                    </summary>
                                    <pre className="bg-light p-3 rounded-3 border small text-muted font-monospace" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}

                            <div className="d-flex flex-wrap gap-2">
                                <button className="btn btn-primary d-flex align-items-center gap-2" onClick={this.handleReset}>
                                    <FaRedo /> Reload Page
                                </button>
                                <button className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={this.handleCopyReport}>
                                    <FaCopy /> Copy Diagnostic Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
