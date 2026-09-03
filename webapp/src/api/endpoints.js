import api from './axiosConfig';

// ============================================
// AUTH ENDPOINTS
// ============================================
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.put('/auth/change-password', data),
};

// ============================================
// STALL ENDPOINTS
// ============================================
export const stallAPI = {
    getAll: (params) => api.get('/stalls', { params }),
    getById: (id) => api.get(`/stalls/${id}`),
    getDetails: (id) => api.get(`/stalls/${id}/details`),
    create: (data) => api.post('/stalls', data),
    update: (id, data) => api.put(`/stalls/${id}`, data),
    updateStatus: (id, status) => api.patch(`/stalls/${id}/status`, { status }),
    delete: (id) => api.delete(`/stalls/${id}`),
    getStats: () => api.get('/stalls/stats'),
    getQRCode: (id) => api.get(`/stalls/${id}/qrcode`),
};

// ============================================
// TENANT ENDPOINTS
// ============================================
export const tenantAPI = {
    getAll: (params) => api.get('/tenants', { params }),
    getById: (id) => api.get(`/tenants/${id}`),
    create: (data) => api.post('/tenants', data),
    update: (id, data) => api.put(`/tenants/${id}`, data),
    updateStatus: (id, status) => api.patch(`/tenants/${id}/status`, { status }),
    delete: (id) => api.delete(`/tenants/${id}`),
    getStats: () => api.get('/tenants/stats'),
    getExpiring: (days) => api.get('/tenants/expiring', { params: { days } }),
    assignStall: (id, stallId) => api.patch(`/tenants/${id}/assign-stall`, { stall_id: stallId }),
};

// ============================================
// APPLICATION ENDPOINTS
// ============================================
export const applicationAPI = {
    getAll: (params) => api.get('/applications', { params }),
    getById: (id) => api.get(`/applications/${id}`),
    create: (data) => api.post('/applications', data),
    review: (id, data) => api.patch(`/applications/${id}/review`, data),
    getStats: () => api.get('/applications/stats'),
    delete: (id) => api.delete(`/applications/${id}`),
};

// ============================================
// PAYMENT & PAYMONGO ENDPOINTS
// ============================================
export const paymentAPI = {
    getAll: (params) => api.get('/payments', { params }),
    getById: (id) => api.get(`/payments/${id}`),
    getByTenant: (tenantId) => api.get(`/payments/tenant/${tenantId}`),
    create: (data) => api.post('/payments', data),
    update: (id, data) => api.put(`/payments/${id}`, data),
    recordPayment: (id, formDataOrData) => {
        if (formDataOrData instanceof FormData) {
            return api.patch(`/payments/${id}/record`, formDataOrData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.patch(`/payments/${id}/record`, formDataOrData);
    },
    createPaymongoCheckout: (id) => api.post(`/payments/${id}/paymongo-checkout`),
    verifyPaymongo: (id, data) => api.post(`/payments/${id}/verify-paymongo`, data),
    getStats: () => api.get('/payments/stats'),
    getStallsOverview: (params) => api.get('/payments/stalls-overview', { params }),
    getOverdue: () => api.get('/payments/overdue'),
    getReport: (month, year) => api.get('/payments/report', { params: { month, year } }),
    getAnalytics: (params) => api.get('/payments/analytics', { params }),
    generateBills: (data) => api.post('/payments/generate-bills', data),
    applyLateFees: () => api.post('/payments/apply-late-fees'),
    getTenantSummary: (tenantId) => api.get(`/payments/tenant/${tenantId}/summary`),
    delete: (id) => api.delete(`/payments/${id}`),
};

// ============================================
// MAINTENANCE ENDPOINTS
// ============================================
export const maintenanceAPI = {
    getAll: (params) => api.get('/maintenance', { params }),
    getById: (id) => api.get(`/maintenance/${id}`),
    create: (data) => {
        if (data instanceof FormData) {
            return api.post('/maintenance', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.post('/maintenance', data);
    },
    updateStatus: (id, data) => api.patch(`/maintenance/${id}/status`, data),
    getStats: () => api.get('/maintenance/stats'),
    delete: (id) => api.delete(`/maintenance/${id}`),
};

// ============================================
// ANNOUNCEMENT ENDPOINTS
// ============================================
export const announcementAPI = {
    getAll: (params) => api.get('/announcements', { params }),
    getById: (id) => api.get(`/announcements/${id}`),
    create: (data) => api.post('/announcements', data),
    update: (id, data) => api.put(`/announcements/${id}`, data),
    delete: (id) => api.delete(`/announcements/${id}`),
};

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================
export const notificationAPI = {
    getAll: () => api.get('/notifications'),
    markRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.post('/notifications/mark-all-read'),
};

// ============================================
// MESSAGE / CHAT ENDPOINTS
// ============================================
export const messageAPI = {
    getConversations: () => api.get('/messages/conversations'),
    getThread: (contactId) => api.get(`/messages/thread/${contactId}`),
    send: (data) => api.post('/messages', data),
};

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================
export const userAPI = {
    getAll: (params) => api.get('/users', { params }),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
};