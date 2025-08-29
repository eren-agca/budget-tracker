// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
    const colorScheme = useColorScheme();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
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
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    // Bu sekme artık grafikler içerdiği için başlığı "Charts" olarak güncelledik.
                    title: 'Charts',
                    // İkonu da içeriğe daha uygun bir pasta grafiği ikonuyla değiştirdik.
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.pie.fill" color={color} />,
                }}
            />
            {/* Sabit gelirleri yönetmek için yeni "Recurring" sekmesini ekledik. */}
            <Tabs.Screen
                name="recurring"
                options={{
                    title: 'Recurring',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="repeat" color={color} />,
                }}
            />
        </Tabs>
    );
}