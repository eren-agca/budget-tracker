import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
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

interface TickerProps {
  data: string[];
  height?: number;
  speed?: number;
  badgeLabel?: string;
}

export const Ticker: React.FC<TickerProps> = ({
  data,
  height = 30,
  speed = 36,
  badgeLabel,
}) => {
  const textWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const handleOnLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
    if (measuredWidth > 20 && Math.abs(textWidth.value - measuredWidth) > 2) {
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

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <ThemedText style={styles.textLoading}>Loading market rates...</ThemedText>
      </View>
    );
  }

  const renderGroup = (prefix: string, onLayout?: (e: LayoutChangeEvent) => void) => (
    <View onLayout={onLayout} style={styles.tickerGroup}>
      {data.map((item, idx) => (
        <View key={`${prefix}-${idx}`} style={styles.tickerItem}>
          <ThemedText style={styles.text}>{item}</ThemedText>
          <ThemedText style={styles.separator}>◆</ThemedText>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { height }]}>
      {badgeLabel ? (
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.badgeText}>{badgeLabel}</ThemedText>
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
    includeFontPadding: false,
    textAlignVertical: 'center',
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
});