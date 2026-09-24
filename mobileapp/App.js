import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { navigationRef } from './src/navigation/navigationRef';
import AppNavigator from './src/navigation/AppNavigator';
import SystemAssistant from './src/components/common/SystemAssistant';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <NavigationContainer ref={navigationRef}>
                    <NotificationProvider>
                        <StatusBar style="dark" />
                        <AppNavigator />
                        <SystemAssistant />
                    </NotificationProvider>
                </NavigationContainer>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
