import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import StallsScreen from '../screens/stalls/StallsScreen';
import MaintenanceScreen from '../screens/maintenance/MaintenanceScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { theme } from '../styles/theme';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerStyle: {
                    backgroundColor: '#fff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    elevation: 2
                },
                headerTitleStyle: {
                    fontWeight: 'bold',
                    color: theme.colors.text,
                    fontSize: 17
                },
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 6
                },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600'
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Stalls') {
                        iconName = focused ? 'storefront' : 'storefront-outline';
                    } else if (route.name === 'Fix Hub') {
                        iconName = focused ? 'build' : 'build-outline';
                    } else if (route.name === 'Billing') {
                        iconName = focused ? 'card' : 'card-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }
                    return <Ionicons name={iconName} size={22} color={color} />;
                }
            })}
        >
            <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Tenant Home' }} />
            <Tab.Screen name="Stalls" component={StallsScreen} options={{ title: 'Commercial Stalls' }} />
            <Tab.Screen name="Fix Hub" component={MaintenanceScreen} options={{ title: 'Maintenance Hub' }} />
            <Tab.Screen name="Billing" component={BillingScreen} options={{ title: 'Billings & PayMongo' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Lease & Profile' }} />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator;
