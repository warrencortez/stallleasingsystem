import React from 'react';
import { 
    FaStore, 
    FaUsers, 
    FaFileAlt, 
    FaCreditCard, 
    FaExclamationTriangle,
    FaCalendarCheck,
    FaMoneyBillWave
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
            <div className="card shadow-sm">
                <div className="card-body">
                    <h6 className="text-muted mb-3">📋 Recent Activity</h6>
                    <div className="text-center py-4 text-muted">
                        <p>No recent activity to show</p>
                        <small>Activity will appear here when things happen</small>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-body">
                <h6 className="text-muted mb-3">📋 Recent Activity</h6>
                <div className="list-group list-group-flush">
                    {activities.map((activity) => (
                        <div 
                            key={activity.id} 
                            className={`list-group-item d-flex align-items-center border-start border-4 ${getPriorityClass(activity.priority)}`}
                            style={{ borderLeftWidth: '4px' }}
                        >
                            <div className="me-3" style={{ fontSize: '18px' }}>
                                {getIcon(activity.type)}
                            </div>
                            <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-center">
                                    <span>{activity.message}</span>
                                    <small className="text-muted">
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