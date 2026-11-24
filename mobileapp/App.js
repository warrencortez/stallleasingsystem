
import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';

import { navigationRef } from './src/navigation/navigationRef';
import AppNavigator from './src/navigation/AppNavigator';
import SystemAssistant from './src/components/common/SystemAssistant';

const PAYMENT_RETURN_SCHEME = 'leasehub:';
const PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function PaymentReturnHandler({ navigationReady }) {
    const { isAuthenticated, loading } = useAuth();

    const [pendingReturn, setPendingReturn] = useState(null);
    const handledReturns = useRef(new Set());

    useEffect(() => {
        let mounted = true;

        const acceptUrl = (rawUrl) => {
            try {
                const url = new URL(rawUrl);

                if (
                    url.protocol !== PAYMENT_RETURN_SCHEME ||
                    url.hostname !== 'payment-return'
                ) return;

                const paymentId = url.searchParams.get('payment_id');

                if (!paymentId || !PAYMENT_ID_PATTERN.test(paymentId)) {
                    return;
                }

                const status = [
                    'success',
                    'cancelled',
                    'failed',
                    'pending'
                ].includes(url.searchParams.get('status'))
                    ? url.searchParams.get('status')
                    : 'unknown';

                const key = `${paymentId.toLowerCase()}:${status}`;

                if (handledReturns.current.has(key)) return;

                setPendingReturn({ paymentId, status });

            } catch (_) {
                // Ignore malformed or unrelated links.
            }
        };

        Linking.getInitialURL()
            .then(url => {
                if (mounted && url) acceptUrl(url);
            })
            .catch(() => {});

        const subscription = Linking.addEventListener(
            'url',
            ({ url }) => acceptUrl(url)
        );

        return () => {
            mounted = false;
            subscription.remove();
        };

    }, []);

    useEffect(() => {
        if (
            loading ||
            !isAuthenticated ||
            !navigationReady ||
            !pendingReturn
        ) return;

        const paymentReturn = pendingReturn;

        const key =
            `${paymentReturn.paymentId.toLowerCase()}:${paymentReturn.status}`;

        if (handledReturns.current.has(key)) {
            setPendingReturn(null);
            return;
        }

        navigationRef.navigate('Main', {
            screen: 'Billing',
            params: { paymentReturn }
        });

        handledReturns.current.add(key);
        setPendingReturn(null);

    }, [
        isAuthenticated,
        loading,
        navigationReady,
        pendingReturn
    ]);

    return null;
}

export default function App() {
    const [navigationReady, setNavigationReady] = useState(false);
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady(true)}>
                    <NotificationProvider>
                        <StatusBar style="dark" />
                        <AppNavigator />
                        <SystemAssistant />
                        <PaymentReturnHandler navigationReady={navigationReady} />
                    </NotificationProvider>
                </NavigationContainer>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
