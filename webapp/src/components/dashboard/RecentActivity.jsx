import React from 'react';
import { 
    FaStore, 
    FaUsers, 
    FaFileAlt, 
    FaCreditCard, 
    FaExclamationTriangle,
    FaCalendarCheck,
    FaMoneyBillWave,
    FaHistory
} from 'react-icons/fa';

const RecentActivity = ({ activities }) => {
    const getIcon = (type) => {
        switch (type) {
            case 'overdue':
                return <FaExclamationTriangle className="text-danger" />;
            case 'expiring':
                return <FaCalendarCheck className="text-warning" />;
            case 'payment':
                return <FaMoneyBillWave className="text-success" />;
            case 'tenant':
                return <FaUsers className="text-primary" />;
            case 'stall':
                return <FaStore className="text-info" />;
            case 'application':
                return <FaFileAlt className="text-warning" />;
            default:
                return <FaCreditCard className="text-secondary" />;
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'high':
                return 'border-danger';
            case 'medium':
                return 'border-warning';
            default:
                return 'border-light';
        }
    };

    if (!activities || activities.length === 0) {
        return (
            <div className="card shadow-sm border-0 bg-white">
                <div className="card-body p-3">
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <FaHistory className="text-muted" />
                        <h6 className="text-muted mb-0 fw-bold">Recent System Activity</h6>
                    </div>
                    <div className="text-center py-4 text-muted">
                        <p className="mb-0 small">No recent activity log recorded.</p>
                        <small className="text-muted">Operations and lease contract milestones will be logged here in real-time.</small>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card shadow-sm border-0 bg-white">
            <div className="card-body p-3">
                <div className="d-flex align-items-center gap-2 mb-3">
                    <FaHistory className="text-primary" />
                    <h6 className="text-dark mb-0 fw-bold">Recent Operations & Tenant Activity</h6>
                </div>
                <div className="list-group list-group-flush">
                    {activities.map((activity) => (
                        <div 
                            key={activity.id} 
                            className={`list-group-item d-flex align-items-center border-start border-4 ${getPriorityClass(activity.priority)} px-3 py-2 my-1 rounded bg-light bg-opacity-50`}
                            style={{ borderLeftWidth: '4px' }}
                        >
                            <div className="me-3" style={{ fontSize: '16px' }}>
                                {getIcon(activity.type)}
                            </div>
                            <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="small fw-semibold text-dark">{activity.message}</span>
                                    <small className="text-muted font-monospace">
                                        {new Date(activity.date).toLocaleDateString()}
                                    </small>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecentActivity;