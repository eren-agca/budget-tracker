import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';

export interface TickerItemData {
  text: string;
  direction?: 'up' | 'down' | 'flat';
}

interface TickerProps {
  data: (string | TickerItemData)[];
  height?: number;
  speed?: number;
  badgeLabel?: string;
  isError?: boolean;
}

export const Ticker: React.FC<TickerProps> = ({
  data,
  height = 30,
  speed = 36,
  badgeLabel,
  isError,
}) => {
  const { colors, isDark } = useSettings();
  const textWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const firstItemText = typeof data[0] === 'string' ? data[0] : data[0]?.text || '';
  const isUnavailable = isError || (data.length === 1 && firstItemText.includes('devre dışı'));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const handleOnLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
    if (measuredWidth <= 20) return;

    // Only start the animation on initial measurement (or major item-count layout change)
    // so live price updates never reset or teleport the scrolling position.
    if (textWidth.value === 0 || Math.abs(textWidth.value - measuredWidth) > 24) {
      textWidth.value = measuredWidth;
      cancelAnimation(translateX);
      translateX.value = 0;
      const duration = (measuredWidth / speed) * 1000;
      translateX.value = withRepeat(
        withTiming(-measuredWidth, { duration, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [speed]);

  useEffect(() => {
    return () => {
      cancelAnimation(translateX);
    };
  }, []);

  const containerStyle = [
    styles.container,
    { height, backgroundColor: colors.card, borderColor: colors.border },
  ];

  if (!data || data.length === 0) {
    return (
      <View style={containerStyle}>
        <ThemedText style={[styles.textLoading, { color: colors.textMuted }]}>
          Loading market rates...
        </ThemedText>
      </View>
    );
  }

  const badgeBg = isUnavailable ? colors.warningSoft : colors.tintSoft;
  const badgeBorder = isUnavailable ? 'rgba(217, 119, 6, 0.25)' : colors.tintSoft;
  const badgeColor = isUnavailable ? colors.warning : colors.tint;
  const itemTextColor = isUnavailable ? (isDark ? '#FFB340' : '#D97706') : colors.text;
  const separatorColor = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.2)';

  const renderGroup = (prefix: string, onLayout?: (e: LayoutChangeEvent) => void) => (
    <View onLayout={onLayout} style={styles.tickerGroup}>
      {data.map((item, idx) => {
        const text = typeof item === 'string' ? item : item.text;
        const direction = typeof item === 'string' ? undefined : item.direction;
        return (
          <View key={`${prefix}-${idx}`} style={styles.tickerItem}>
            <ThemedText style={[styles.text, { color: itemTextColor }]}>{text}</ThemedText>
            {direction === 'up' && (
              <Ionicons
                name="arrow-up"
                size={12}
                color={colors.tint}
                style={styles.directionArrow}
              />
            )}
            {direction === 'down' && (
              <Ionicons
                name="arrow-down"
                size={12}
                color={colors.expense}
                style={styles.directionArrow}
              />
            )}
            {direction === 'flat' && (
              <Ionicons
                name="remove"
                size={13}
                color={isDark ? '#8E8E93' : '#64748B'}
                style={styles.directionArrow}
              />
            )}
            <ThemedText style={[styles.separator, { color: separatorColor }]}>◆</ThemedText>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={containerStyle}>
      {badgeLabel ? (
        <View style={[styles.badge, { backgroundColor: badgeBg, borderRightColor: badgeBorder }]}>
          <View style={[styles.liveDot, { backgroundColor: badgeColor }]} />
          <ThemedText style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</ThemedText>
        </View>
      ) : null}
      <View style={styles.marqueeMask}>
        <Animated.View style={[styles.row, animatedStyle]}>
          {renderGroup('g1', handleOnLayout)}
          {renderGroup('g2')}
          {renderGroup('g3')}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161618',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  badge: {
    width: 86,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(57, 255, 20, 0.22)',
    gap: 6,
    zIndex: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.tint,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 0.8,
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: Platform.OS === 'ios' ? 1 : 0,
  },
  marqueeMask: {
    flex: 1,
    overflow: 'hidden',
    height: '100%',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: '100%',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  tickerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    flexWrap: 'nowrap',
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    flexWrap: 'nowrap',
  },
  text: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
    color: '#D1D1D6',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  directionArrow: {
    marginLeft: 4,
  },
  separator: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.35)',
    marginHorizontal: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  textLoading: {
    fontSize: 11.5,
    color: '#636366',
    paddingHorizontal: 12,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  badgeUnavailable: {
    backgroundColor: 'rgba(255, 159, 10, 0.12)',
    borderRightColor: 'rgba(255, 159, 10, 0.22)',
  },
  liveDotUnavailable: {
    backgroundColor: '#FF9F0A',
  },
  badgeTextUnavailable: {
    color: '#FF9F0A',
  },
  textUnavailable: {
    color: '#FFB340',
  },
  separatorUnavailable: {
    color: 'rgba(255, 159, 10, 0.4)',
  },
});