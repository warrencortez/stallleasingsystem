import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { navigationRef } from './src/navigation/navigationRef';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <NavigationContainer ref={navigationRef}>
                    <NotificationProvider>
                        <StatusBar style="dark" />
                        <AppNavigator />
                    </NotificationProvider>
                </NavigationContainer>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
