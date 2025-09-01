// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors.tint,
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarBackground: TabBarBackground,
                tabBarStyle: Platform.select({
                    ios: {
                        // Use a transparent background on iOS to show the blur effect
                        position: 'absolute',
                    },
                    default: {},
                }),
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Ionicons size={28} name="wallet" color={color} />,
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: 'Charts',
                    tabBarIcon: ({ color }) => <Ionicons size={25} name="pie-chart" color={color} />,
                }}
            />
            <Tabs.Screen
                name="recurring"
                options={{
                    title: 'Recurring',
                    tabBarIcon: ({ color }) => <Ionicons size={28} name="repeat" color={color} />,
                }}
            />
        </Tabs>
    );
}