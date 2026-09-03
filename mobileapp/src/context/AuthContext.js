import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

export let onUnauthorized = null;

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        onUnauthorized = logout;
    }, []);

    useEffect(() => {
        loadStoredSession();
    }, []);

    const loadStoredSession = async () => {
        try {
            setLoading(true);
            const savedToken = await AsyncStorage.getItem('user_token');
            const savedUser = await AsyncStorage.getItem('user_data');
            const savedIP = await AsyncStorage.getItem('custom_server_ip');

            if (savedIP) {
                api.defaults.baseURL = `http://${savedIP}:5000/api/v1`;
            }

            if (savedToken && savedUser) {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            if (res.data?.success) {
                const { token: jwtToken, user: userData } = res.data.data;
                setToken(jwtToken);
                setUser(userData);

                await AsyncStorage.setItem('user_token', jwtToken);
                await AsyncStorage.setItem('user_data', JSON.stringify(userData));
                return { success: true, user: userData };
            }
            return { success: false, message: res.data?.message || 'Login failed' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Network connection failed. Ensure server IP is reachable.'
            };
        }
    };

    const register = async (registerData) => {
        try {
            const res = await api.post('/auth/register', {
                ...registerData,
                role: 'tenant'
            });
            if (res.data?.success) {
                const { token: jwtToken, user: userData } = res.data.data;
                setToken(jwtToken);
                setUser(userData);

                await AsyncStorage.setItem('user_token', jwtToken);
                await AsyncStorage.setItem('user_data', JSON.stringify(userData));
                return { success: true, user: userData };
            }
            return { success: false, message: res.data?.message || 'Registration failed' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed'
            };
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('user_token');
            await AsyncStorage.removeItem('user_data');
            setToken(null);
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!token,
                loading,
                login,
                register,
                logout,
                isTenant: user?.role === 'tenant'
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
