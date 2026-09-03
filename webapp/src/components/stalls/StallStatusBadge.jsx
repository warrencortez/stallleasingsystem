import React from 'react';

const StallStatusBadge = ({ status }) => {
    const statusConfig = {
        available: { color: 'success', label: 'Available' },
        occupied: { color: 'danger', label: 'Occupied' },
        maintenance: { color: 'warning', label: 'Maintenance' },
        reserved: { color: 'info', label: 'Reserved' }
    };

    const config = statusConfig[status] || { color: 'secondary', label: status };

    return (
        <span className={`badge bg-${config.color} px-3 py-2`}>
            {config.label}
        </span>
    );
};

export default StallStatusBadge;