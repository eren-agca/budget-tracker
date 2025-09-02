import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

interface TickerProps {
  data: string[];
  height?: number;
  speed?: number;
}

export const Ticker: React.FC<TickerProps> = ({
                                                data,
                                                height = 26,
                                                speed = 40,
                                              }) => {
  const textWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const textContent = data.join('      •      ');

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

    translateX.value = 0;
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
          <ThemedText style={styles.text}>Loading...</ThemedText>
        </View>
    );
  }

  return (
      <View style={[styles.container, { height }]}>
        <Animated.View style={[styles.row, { height }, animatedStyle]}>          
          <ThemedText onLayout={handleOnLayout} style={styles.text}>
            {textContent}
          </ThemedText>
          <ThemedText style={styles.text}>
            {textContent}
          </ThemedText>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    position: 'absolute',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 10,
  },
});