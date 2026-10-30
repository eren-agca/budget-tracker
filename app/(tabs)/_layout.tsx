import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';

function CustomTabBar({ state, descriptors, emitter, navigateToTab, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isDark, colors } = useSettings();

  const onAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/add-transaction');
  };

  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 16;
  const inactiveIconColor = isDark ? '#7C7C82' : '#94A3B8';

  const getTabConfig = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'index':
        return {
          label: t('tabHome') || 'Wallet',
          iconName: (isFocused ? 'wallet' : 'wallet-outline') as any,
        };
      case 'explore':
        return {
          label: t('tabCharts') || 'Charts',
          iconName: (isFocused ? 'pie-chart' : 'pie-chart-outline') as any,
        };
      case 'recurring':
        return {
          label: t('tabRecurring') || 'Loop',
          iconName: (isFocused ? 'sync' : 'sync-outline') as any,
        };
      case 'cards':
        return {
          label: t('tabCards') || 'Cards',
          iconName: (isFocused ? 'card' : 'card-outline') as any,
        };
      default:
        return {
          label: routeName,
          iconName: 'square-outline' as any,
        };
    }
  };

  const renderTabItem = (route: any, index: number) => {
    if (!route) return null;
    const isFocused = state.index === index;
    const config = getTabConfig(route.name, isFocused);

    const onPress = () => {
      const event =
        emitter?.emit?.({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        }) ??
        navigation?.emit?.({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

      if (!isFocused && !event?.defaultPrevented) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (typeof navigateToTab === 'function') {
          navigateToTab(route.key);
        } else if (navigation?.navigate) {
          navigation.navigate(route.name, route.params);
        } else {
          router.navigate(route.name === 'index' ? '/(tabs)' : (`/(tabs)/${route.name}` as any));
        }
      }
    };

    return (
      <AnimatedPressable
        key={route.key}
        onPress={onPress}
        style={styles.tabItem}>
        <Ionicons
          size={22}
          name={config.iconName}
          color={isFocused ? colors.tint : inactiveIconColor}
        />
        <ThemedText
          style={[
            styles.tabLabel,
            { color: isFocused ? colors.tint : inactiveIconColor },
          ]}>
          {config.label}
        </ThemedText>
      </AnimatedPressable>
    );
  };

  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2, 4);

  return (
    <View pointerEvents="box-none" style={[styles.tabBarContainer, { bottom: bottomOffset }]}>
      {/* Floating Center Action Button (+), partially raised above the pill dock */}
      <AnimatedPressable
        style={[
          styles.floatingAddButton,
          {
            backgroundColor: colors.tint,
            shadowColor: isDark ? colors.tint : '#64748B',
          },
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={onAddPress}>
        <Ionicons name="add" size={28} color={isDark ? '#000000' : '#FFFFFF'} />
      </AnimatedPressable>

      {/* Main Pill Dock Body */}
      <View
        style={[
          styles.tabBarMain,
          {
            backgroundColor: isDark ? '#141722' : '#FFFFFF',
            borderColor: colors.border,
            shadowColor: isDark ? '#000000' : '#64748B',
            shadowOpacity: isDark ? 0.45 : 0.12,
          },
        ]}>
        {/* Left Side: Wallet & Charts */}
        {leftRoutes.map((route: any, i: number) => renderTabItem(route, i))}

        {/* Center Space Reserved for the Floating + Button */}
        <View style={styles.centerGap} pointerEvents="none" />

        {/* Right Side: Loop & Cards */}
        {rightRoutes.map((route: any, i: number) => renderTabItem(route, i + 2))}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wallet',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Charts',
        }}
      />
      <Tabs.Screen
        name="recurring"
        options={{
          title: 'Loop',
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 90,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100,
  },
  floatingAddButton: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabBarMain: {
    width: '100%',
    height: 68,
    backgroundColor: '#141722',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  centerGap: {
    width: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
});