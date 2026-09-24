import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Fallback IP for development machine
const FALLBACK_IP = '192.168.1.187';

// Dynamically extract the host IP address Expo Go is connected to
const getExpoHost = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return window.location.hostname || 'localhost';
    }

    // Constants.expoConfig?.hostUri contains "192.168.x.x:8081"
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.manifest?.debuggerHost ||
        Constants.manifest2?.extra?.expoGo?.debuggerHost;

    if (hostUri) {
        return hostUri.split(':')[0];
    }

    return FALLBACK_IP;
};

const serverHost = getExpoHost();
console.log(`[API Config] Connecting to backend at: http://${serverHost}:5000/api/v1`);

const api = axios.create({
    baseURL: `http://${serverHost}:5000/api/v1`,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(
    async (config) => {
        try {
            // Check for custom server IP override if set
            const customIP = await AsyncStorage.getItem('custom_server_ip');
            if (customIP && !config.baseURL.includes(customIP)) {
                config.baseURL = `http://${customIP}:5000/api/v1`;
            }

            const token = await AsyncStorage.getItem('user_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error in request interceptor:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            console.warn('[API Auth] 401 Unauthorized - token expired or invalid. Clearing session.');
            try {
                await AsyncStorage.removeItem('user_token');
                await AsyncStorage.removeItem('user_data');
            } catch (e) {}
            // Dynamically trigger logout from AuthContext if available
            try {
                const { onUnauthorized } = require('../context/AuthContext');
                if (onUnauthorized) onUnauthorized();
            } catch (e) {}
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
            console.warn(`[API Network Alert] Unable to reach backend at ${api.defaults.baseURL}. Ensure the node server is running and on the same Wi-Fi.`);
        }
        return Promise.reject(error);
    }
);

export const setCustomServerIP = async (ip) => {
    if (ip) {
        api.defaults.baseURL = `http://${ip}:5000/api/v1`;
        await AsyncStorage.setItem('custom_server_ip', ip);
    }
};

export default api;
