// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/components/Ticker.tsx

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TickerProps {
  data: string[];
}

export const Ticker: React.FC<TickerProps> = ({ data }) => {
  const translateX = useSharedValue(SCREEN_WIDTH);
  const textWidth = useSharedValue(0);

  // Verileri aralarında ayıraç olacak şekilde birleştiriyoruz.
  const textContent = data.join('      •      ');

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const startAnimation = (width: number) => {
    // Metnin kat etmesi gereken toplam mesafe (kendi genişliği + ekran genişliği)
    const totalDistance = width + SCREEN_WIDTH;
    const speed = 40; // saniyedeki piksel hızı
    const duration = (totalDistance / speed) * 1000;

    // Animasyonu başlatmadan önce mevcut olanı durdur.
    cancelAnimation(translateX);

    // Animasyonu her zaman ekranın sağından başlat.
    translateX.value = SCREEN_WIDTH;

    // Animasyonu sonsuz döngüde çalıştır.
    // Metin tamamen soldan çıktığında (-width), tekrar sağdan başlar (SCREEN_WIDTH).
    translateX.value = withRepeat(
        withTiming(-width, { duration, easing: Easing.linear }),
        -1, // sonsuz döngü
        false // başa dön, tersine çevirme
    );
  };

  const handleOnLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    // Genişliği sadece bir kez, ilk ölçümde ayarla.
    if (measuredWidth > 0 && textWidth.value === 0) {
      textWidth.value = measuredWidth;
      // Reanimated UI thread'inden JS thread'ine güvenli geçiş.
      runOnJS(startAnimation)(measuredWidth);
    }
  };

  // Veri değiştiğinde (API'den yeni veri geldiğinde) animasyonu yeniden başlat.
  useEffect(() => {
    textWidth.value = 0;
    translateX.value = SCREEN_WIDTH;
    // onLayout yeniden tetiklenerek animasyonu doğru genişlikle başlatacak.
  }, [textContent]);

  if (!data || data.length === 0) {
    return (
        <View style={styles.container}>
          <ThemedText style={styles.text}>Loading rates...</ThemedText>
        </View>
    );
  }

  return (
      <View style={styles.container}>
        <Animated.View style={[styles.textContainer, animatedStyle]}>
          {/* Artık sadece tek bir ThemedText kullanıyoruz. */}
          {/* DÜZELTME: onLayout'u, genişliğini ölçmek istediğimiz asıl elemana, yani ThemedText'e taşıyoruz. */}
          <ThemedText onLayout={handleOnLayout} style={styles.text}>
            {textContent}
          </ThemedText>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 26, // Bantların yüksekliğini azalttık
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    overflow: 'hidden', // Bu, ekran dışına taşan metnin görünmemesini sağlar.
  },
  textContainer: {
    // Metnin serbestçe hareket edebilmesi için mutlak konumlandırma.
    position: 'absolute',
    // Bu, View'in içindeki Text'in genişlemesine ve tek satırda kalmasına yardımcı olur.
    flexDirection: 'row',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    // Metnin kendi doğal genişliğini almasına izin veriyoruz.
  },
});