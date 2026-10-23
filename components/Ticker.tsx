import React from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  runOnJS,
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
  height = 28,
  speed = 36,
  badgeLabel,
}) => {
  const textWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const textContent = data.join('      ◆      ');

  const animatedStyle = useAnimatedStyle(() => {
    if (textWidth.value === 0) {
      return {};
    }
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const startAnimation = (width: number) => {
    const duration = (width / speed) * 1000;
    translateX.value = withRepeat(
      withTiming(-width, { duration, easing: Easing.linear }),
      -1
    );
  };

  const handleOnLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    if (measuredWidth > 0 && textWidth.value === 0) {
      textWidth.value = measuredWidth;
      runOnJS(startAnimation)(measuredWidth);
    }
  };

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <ThemedText style={styles.textLoading}>Loading market rates...</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {badgeLabel ? (
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.badgeText}>{badgeLabel}</ThemedText>
        </View>
      ) : null}
      <View style={styles.marqueeMask}>
        <Animated.View style={[styles.row, { height }, animatedStyle]}>
          <ThemedText onLayout={handleOnLayout} style={styles.text}>
            {textContent}
          </ThemedText>
          <ThemedText style={styles.text}>
            {textContent}
          </ThemedText>
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
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(57, 255, 20, 0.25)',
    gap: 5,
    zIndex: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tint,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 0.8,
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
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D1D6',
    paddingHorizontal: 12,
    letterSpacing: 0.3,
  },
  textLoading: {
    fontSize: 12,
    color: '#636366',
    paddingHorizontal: 12,
  },
});