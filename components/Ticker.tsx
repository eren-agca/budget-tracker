import React from 'react';
import { View, StyleSheet, Text, Dimensions, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TickerProps {
  data: string[];
  duration?: number;
}

export const Ticker: React.FC<TickerProps> = ({ data }) => {
  const textContainerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  // Verileri aralarında ayıraç olacak şekilde birleştiriyoruz.
  const text = data.join('   •   ');

  const animatedStyle = useAnimatedStyle(() => {
    // Metnin tam genişliği kadar sola kaydıracağız. 50, metinler arası boşluktur.
    const moveAmount = textContainerWidth.value + 50;
    return {
      transform: [{ translateX: interpolate(translateX.value, [0, 1], [0, -moveAmount]) }],
    };
  });

  const handleOnLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    // Eğer genişlik ölçülmemişse veya öncekiyle aynıysa bir şey yapma.
    if (measuredWidth === 0 || measuredWidth === textContainerWidth.value) {
      return;
    }
    textContainerWidth.value = measuredWidth;

    // Sabit bir kayma hızı için süreyi dinamik olarak hesapla.
    // Hız = 40 piksel/saniye
    const speed = 40;
    const duration = (measuredWidth / speed) * 1000;

    // Animasyonu başlatmadan önce mevcut olanı durdur ve sıfırla.
    cancelAnimation(translateX);
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1 // sonsuz döngü
    );
  };

  if (!data || data.length === 0) {
    return <View style={styles.container}><Text style={styles.text}>Loading rates...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, animatedStyle]}>
        {/* onLayout, metnin genişliğini ölçer ve animasyonu tetikler. */}
        <Text onLayout={handleOnLayout} style={styles.text}>{text}</Text>
        <Text style={[styles.text, { paddingLeft: 50 }]}>{text}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 30, backgroundColor: '#2c2c2e', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 14, fontWeight: '600', color: '#fff', paddingHorizontal: 10 },
});