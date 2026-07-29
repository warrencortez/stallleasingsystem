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
    create: (data) => api.post('/stalls', data),
    update: (id, data) => api.put(`/stalls/${id}`, data),
    updateStatus: (id, status) => api.patch(`/stalls/${id}/status`, { status }),
    delete: (id) => api.delete(`/stalls/${id}`),
    getStats: () => api.get('/stalls/stats'),
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
// PAYMENT ENDPOINTS
// ============================================
export const paymentAPI = {
    getAll: (params) => api.get('/payments', { params }),
    getById: (id) => api.get(`/payments/${id}`),
    getByTenant: (tenantId) => api.get(`/payments/tenant/${tenantId}`),
    create: (data) => api.post('/payments', data),
    update: (id, data) => api.put(`/payments/${id}`, data),
    recordPayment: (id, data) => api.patch(`/payments/${id}/record`, data),
    getStats: () => api.get('/payments/stats'),
    getOverdue: () => api.get('/payments/overdue'),
    getReport: (month, year) => api.get('/payments/report', { params: { month, year } }),
    generateBills: (data) => api.post('/payments/generate-bills', data),
    applyLateFees: () => api.post('/payments/apply-late-fees'),
    getTenantSummary: (tenantId) => api.get(`/payments/tenant/${tenantId}/summary`),
};