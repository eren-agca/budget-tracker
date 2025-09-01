// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/components/Ticker.tsx

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TickerProps {
  data: string[];
}

export const Ticker: React.FC<TickerProps> = ({ data }) => {
  // Animasyon için Reanimated'ın paylaşılan değerini kullanıyoruz.
  const translateX = useSharedValue(SCREEN_WIDTH);
  // Metnin ölçülen genişliğini tutmak için bir React state'i kullanıyoruz.
  // Bu, animasyon mantığını daha sağlam ve öngörülebilir hale getirir.
  const [textWidth, setTextWidth] = useState(0);

  // Verileri aralarında ayıraç olacak şekilde birleştiriyoruz.
  const textContent = data.join('  •  ');

  // Animasyonlu stili oluşturuyoruz.
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Metnin genişliği ölçüldüğünde (onLayout) bu fonksiyon çalışır.
  const handleOnLayout = (event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  };

  // Bu useEffect, metnin genişliği (textWidth) değiştiğinde animasyonu başlatır veya durdurur.
  useEffect(() => {
    if (textWidth > 0) {
      const totalDistance = textWidth + SCREEN_WIDTH;
      const speed = 40; // saniyedeki piksel hızı
      const duration = (totalDistance / speed) * 1000;

      // Animasyonu her zaman ekranın sağından başlat.
      translateX.value = SCREEN_WIDTH;
      // Animasyonu sonsuz döngüde çalıştır.
      translateX.value = withRepeat(
        withTiming(-textWidth, { duration, easing: Easing.linear }),
        -1, // sonsuz döngü
        false // başa dön, tersine çevirme
      );
    }
    return () => cancelAnimation(translateX);
  }, [textWidth, translateX]); // textWidth değiştiğinde bu effect yeniden çalışır.

  if (!data || data.length === 0) {
    return (
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <ThemedText style={styles.text}>Loading rates...</ThemedText>
        </View>
    );
  }

  return (
      <View style={styles.container}>
        <Animated.View style={[styles.textContainer, animatedStyle]}>
          {/* DÜZELTME: numberOfLines={1} ekleyerek metnin alt satıra kaymasını kesin olarak engelliyoruz. */}
          <ThemedText onLayout={handleOnLayout} style={styles.text} numberOfLines={2}>
            {textContent}
          </ThemedText>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 25, // Bantların yüksekliğini azalttık
    backgroundColor: Colors.surface,
    overflow: 'hidden', // Bu, ekran dışına taşan metnin görünmemesini sağlar.
  },
  textContainer: {
    // Metnin serbestçe hareket edebilmesi için mutlak konumlandırma.
    position: 'absolute',
    // `numberOfLines={1}` kullandığımız için, bu konteynerin genişliği artık
    // otomatik olarak içindeki tek satırlık metnin genişliğine eşit olacaktır.
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    // Metnin kendi doğal genişliğini almasına izin veriyoruz.
  },
});