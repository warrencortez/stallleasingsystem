import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/endpoints';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        if (!token) {
            setUser(null);
            localStorage.removeItem('user');
            setLoading(false);
            return;
        }
        // Restore the session using the database-backed API, not cached role/name data.
        authAPI.getMe().then(response => {
            if (cancelled) return;
            const account = response.data?.data?.user;
            if (!account?.id || !['admin', 'tenant'].includes(account.role)) throw new Error('Invalid account');
            setUser(account);
            localStorage.setItem('user', JSON.stringify(account));
        }).catch(() => {
            if (cancelled) return;
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
            setToken(null);
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token]);

    const login = async (email, password) => {
        try {
            const response = await authAPI.login({ email, password });
            const { user, token } = response.data.data;
            
            // Store token and user
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setUser(user);
            setToken(token);
            
            toast.success('Login successful. Welcome back.');
            return { success: true, user };
        } catch (error) {
            const message = error.response?.data?.message || 'Login failed. Please try again.';
            toast.error(message);
            return { success: false, message };
        }
    };

    const loginWithGoogle = async (accessToken, existingPassword) => {
        try {
            const response = await authAPI.google({ accessToken, existingPassword });
            const { user, token } = response.data.data;
            if (user.role !== 'admin') return { success: false, message: 'An administrator account is required.' };
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
            setToken(token);
            return { success: true };
        } catch (error) {
            return { success: false, code: error.response?.data?.code, message: error.response?.data?.message || 'Unable to sign in with Google.' };
        }
    };

    const register = async (userData) => {
        try {
            const response = await authAPI.register(userData);
            const { user, token } = response.data.data;
            
            // Store token and user
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setUser(user);
            setToken(token);
            
            toast.success('Registration successful. Welcome to Dela Costa HOA Stall Leasing.');
            return { success: true, user };
        } catch (error) {
            const message = error.response?.data?.message || 'Registration failed. Please try again.';
            toast.error(message);
            return { success: false, message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
        toast.success('Logged out successfully.');
    };

    const updateUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const value = {
        user,
        token,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        updateUser,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'admin',
        isStaff: user?.role === 'staff' || user?.role === 'admin',
        isTenant: user?.role === 'tenant',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
