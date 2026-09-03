import React from 'react';

const StatsCard = ({ title, value, sub, icon, color, trend }) => {
    const colorMap = {
        primary: 'primary',
        success: 'success',
        warning: 'warning',
        info: 'info',
        danger: 'danger',
    };

    const bgColor = colorMap[color] || 'primary';

    return (
        <div className="card shadow-sm h-100 border-0">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                        <h6 className="text-muted text-uppercase small mb-2">{title}</h6>
                        <h3 className="fw-bold mb-1">{value}</h3>
                        <small className="text-muted d-block">{sub}</small>
                        {trend && (
                            <small className={`text-${bgColor} d-block mt-1`}>
                                {trend}
                            </small>
                        )}
                    </div>
                    <div className={`bg-${bgColor} bg-opacity-10 p-3 rounded-circle flex-shrink-0`}>
                        <span className={`text-${bgColor}`} style={{ fontSize: '24px' }}>
                            {icon}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsCard;