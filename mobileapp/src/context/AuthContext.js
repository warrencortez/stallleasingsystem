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
        return () => { onUnauthorized = null; };
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

            if (__DEV__ && savedIP && !process.env.EXPO_PUBLIC_API_URL) {
                api.defaults.baseURL = `http://${savedIP}:5000/api/v1`;
            }

            if (savedToken && savedUser) {
                const parsed = JSON.parse(savedUser);
                if (!parsed?.id || parsed.role !== 'tenant') throw new Error('Invalid saved session');
                setToken(savedToken);
                setUser(parsed);
            } else {
                await AsyncStorage.multiRemove(['user_token', 'user_data']);
            }
        } catch (error) {
            await AsyncStorage.multiRemove(['user_token', 'user_data']);
            setToken(null); setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            if (res.data?.success) {
                const { token: jwtToken, user: userData } = res.data.data;
                if (userData.role !== 'tenant') return { success: false, message: 'Use the administrator portal for this account.' };
                await AsyncStorage.multiSet([['user_token', jwtToken], ['user_data', JSON.stringify(userData)]]);
                setToken(jwtToken);
                setUser(userData);
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
                if (userData.role !== 'tenant') return { success: false, message: 'Use the administrator portal for this account.' };
                await AsyncStorage.multiSet([['user_token', jwtToken], ['user_data', JSON.stringify(userData)]]);
                setToken(jwtToken);
                setUser(userData);
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
        } finally {
            setToken(null);
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!token && !!user,
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
