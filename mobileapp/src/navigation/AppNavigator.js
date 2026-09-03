import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import BottomTabNavigator from './BottomTabNavigator';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '../styles/theme';

import NotificationsScreen from '../screens/notifications/NotificationsScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </>
            ) : (
                <>
                    <Stack.Screen name="Main" component={BottomTabNavigator} />
                    <Stack.Screen
                        name="Notifications"
                        component={NotificationsScreen}
                        options={{
                            headerShown: true,
                            title: 'Notifications & Alerts 🔔',
                            headerStyle: { backgroundColor: '#fff' },
                            headerTintColor: theme.colors.text,
                            headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
                            headerShadowVisible: false
                        }}
                    />
                </>
            )}
        </Stack.Navigator>
    );
};

export default AppNavigator;
