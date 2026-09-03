import axios from 'axios';
import toast from 'react-hot-toast';

// Create Axios client instance
const api = axios.create({
    baseURL: 'http://localhost:5000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000,
});

// ==========================================================
// 1. REQUEST INTERCEPTOR
// ==========================================================
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        config.metadata = { startTime: new Date() };

        console.groupCollapsed(
            `%c[API REQ] %c${config.method?.toUpperCase()} %c${config.baseURL}${config.url}`,
            'color: #3b82f6; font-weight: bold;',
            'color: #8b5cf6; font-weight: bold;',
            'color: #64748b;'
        );
        console.log('Endpoint:', `${config.baseURL}${config.url}`);
        console.log('Headers:', config.headers);
        if (config.params) console.log('Query Params:', config.params);
        if (config.data) console.log('Request Payload:', config.data);
        console.groupEnd();

        return config;
    },
    (error) => {
        console.error('[API REQUEST SETUP ERROR]:', error);
        return Promise.reject(error);
    }
);

// ==========================================================
// 2. RESPONSE INTERCEPTOR
// ==========================================================
api.interceptors.response.use(
    (response) => {
        const duration = response.config?.metadata?.startTime
            ? `${new Date() - response.config.metadata.startTime}ms`
            : '';

        console.log(
            `%c[API RES ${response.status}] %c${response.config.method?.toUpperCase()} %c${response.config.url} %c(${duration})`,
            'color: #10b981; font-weight: bold;',
            'color: #8b5cf6; font-weight: bold;',
            'color: #1e293b;',
            'color: #94a3b8; font-style: italic;'
        );

        return response;
    },
    (error) => {
        const duration = error.config?.metadata?.startTime
            ? `${new Date() - error.config.metadata.startTime}ms`
            : '';

        const status = error.response?.status;
        const serverMessage = error.response?.data?.message || error.message;
        const errorDetails = error.response?.data?.details || error.response?.data?.error || null;
        const endpoint = `${error.config?.method?.toUpperCase()} ${error.config?.url}`;

        console.group(
            `%c[API ERROR ${status || 'NETWORK'}] %c${endpoint} %c(${duration})`,
            'color: #ef4444; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;',
            'color: #8b5cf6; font-weight: bold;',
            'color: #94a3b8; font-style: italic;'
        );
        console.error('Error Message:', serverMessage);
        if (errorDetails) console.error('Diagnostic Details:', errorDetails);
        if (error.response?.data) console.log('Server Response Body:', error.response.data);
        console.log('Request Config:', error.config);
        console.groupEnd();

        if (!error.response) {
            toast.error('Network Error: Cannot connect to API backend server (http://localhost:5000). Ensure the backend is running.', {
                id: 'net-err',
                duration: 6000
            });
        } else if (status === 401) {
            const isLoginRoute = error.config?.url?.includes('/auth/login');
            if (!isLoginRoute) {
                toast.error('Session Expired: Please log in again to continue.', { id: 'session-err' });
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1000);
            }
        } else if (status === 403) {
            toast.error(`Access Denied: ${serverMessage || 'You do not have permission to perform this action.'}`);
        } else if (status === 404) {
            toast.error(`Not Found (404): ${serverMessage || 'Requested resource could not be found.'}`);
        } else if (status === 422 || status === 400) {
            toast.error(`Validation Error: ${serverMessage}`);
        } else if (status >= 500) {
            toast.error(`Server Error (${status}): ${serverMessage || 'Internal system error. Check backend console.'}`);
        }

        return Promise.reject(error);
    }
);

export default api;