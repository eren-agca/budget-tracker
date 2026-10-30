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

  return (
    <View pointerEvents="box-none" style={[styles.tabBarContainer, { bottom: bottomOffset }]}>
      {/* 
        Semi-circular dome backing:
        Directly unified with the top edge of the bottom bar, located right above the Charts tab
      */}
      <View
        style={[
          styles.halfCircleArch,
          {
            backgroundColor: isDark ? '#18181C' : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
        pointerEvents="none"
      />

      {/* The Dome-Shaped Action Button */}
      <AnimatedPressable
        style={[
          styles.domeAddButton,
          {
            backgroundColor: colors.tint,
            shadowColor: isDark ? colors.tint : '#64748B',
          },
        ]}
        hitSlop={{ top: 10, bottom: 8, left: 10, right: 10 }}
        onPress={onAddPress}>
        <Ionicons name="add" size={24} color={isDark ? '#000000' : '#FFFFFF'} />
      </AnimatedPressable>

      {/* Main Tab Bar Body */}
      <View
        style={[
          styles.tabBarMain,
          {
            backgroundColor: isDark ? '#18181C' : '#FFFFFF',
            borderColor: colors.border,
            shadowColor: isDark ? '#000000' : '#64748B',
            shadowOpacity: isDark ? 0.45 : 0.12,
          },
        ]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = emitter?.emit?.({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            }) ?? navigation?.emit?.({
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
                router.navigate(route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}` as any);
              }
            }
          };

          let iconName: any = 'square';
          let label = options.title || route.name;

          if (route.name === 'index') {
            iconName = isFocused ? 'wallet' : 'wallet-outline';
            label = t('tabHome');
          } else if (route.name === 'explore') {
            iconName = isFocused ? 'pie-chart' : 'pie-chart-outline';
            label = t('tabCharts');
          } else if (route.name === 'recurring') {
            iconName = isFocused ? 'repeat' : 'repeat-outline';
            label = t('tabRecurring');
          }

          const isChartsTab = route.name === 'explore';

          return (
            <AnimatedPressable
              key={route.key}
              onPress={onPress}
              style={[styles.tabItem, isChartsTab && styles.chartsTabItem]}>
              <Ionicons
                size={isChartsTab ? 20 : 22}
                name={iconName}
                color={isFocused ? colors.tint : inactiveIconColor}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.tint : inactiveIconColor },
                ]}>
                {label}
              </ThemedText>
            </AnimatedPressable>
          );
        })}
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
          title: 'Home',
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
          title: 'Recurring',
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
    height: 122,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100,
  },
  halfCircleArch: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    width: 78,
    height: 40,
    borderTopLeftRadius: 39,
    borderTopRightRadius: 39,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#18181C',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  domeAddButton: {
    position: 'absolute',
    bottom: 67,
    alignSelf: 'center',
    width: 62,
    height: 33,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.tint,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  tabBarMain: {
    width: '100%',
    height: 66,
    backgroundColor: '#18181C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chartsTabItem: {
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});