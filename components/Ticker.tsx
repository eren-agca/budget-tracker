import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TickerProps {
  data: string[];
  duration?: number;
}

export const Ticker: React.FC<TickerProps> = ({ data, duration = 20000 }) => {
  const textContainerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  // Verileri aralarında ayıraç olacak şekilde birleştiriyoruz.
  const text = data.join('   •   ');

  const animatedStyle = useAnimatedStyle(() => {
    // Animasyonun sadece içerik ekrandan daha genişse çalışmasını sağlıyoruz.
    const moveAmount = textContainerWidth.value > SCREEN_WIDTH ? textContainerWidth.value + 50 : 0;
    return {
      transform: [{ translateX: interpolate(translateX.value, [0, 1], [0, -moveAmount]) }],
    };
  });

  // Bu useEffect, data prop'u değiştiğinde animasyonu sıfırlar.
  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;
  }, [data]);

  // Bu hook, metin genişliğindeki değişikliklere tepki verir ve animasyonu yönetir.
  // Bu, UI thread üzerinde çalıştığı için uyarıları önler.
  useAnimatedReaction(
    () => textContainerWidth.value,
    (currentWidth, previousWidth) => {
      if (currentWidth === previousWidth) return;

      // Eğer içerik ekran genişliğinden fazlaysa animasyonu başlat.
      if (currentWidth > SCREEN_WIDTH) {
        translateX.value = 0; // Pozisyonu sıfırla
        translateX.value = withRepeat(
          withTiming(1, { duration: duration, easing: Easing.linear }),
          -1 // sonsuz döngü
        );
      } else {
        // Eğer içerik daha kısaysa, çalışan bir animasyon varsa durdur.
        cancelAnimation(translateX);
        translateX.value = 0;
      }
    }
  );

  if (!data || data.length === 0) {
    return <View style={styles.container}><Text style={styles.text}>Loading rates...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, animatedStyle]}>
        {/* onLayout, metnin genişliğini ölçer ve paylaşılan değeri günceller. */}
        <Text onLayout={(e) => { textContainerWidth.value = e.nativeEvent.layout.width; }} style={styles.text}>{text}</Text>
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