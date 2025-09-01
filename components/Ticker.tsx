import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TickerProps {
  data: string[];
}

export const Ticker: React.FC<TickerProps> = ({ data }) => {
  const textContainerWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  // Verileri aralarında ayıraç olacak şekilde birleştiriyoruz.
  const text = data.join('      •      ');

  const animatedStyle = useAnimatedStyle(() => {
    const moveAmount = textContainerWidth.value;
    if (moveAmount === 0) {
      return {}; // Genişlik ölçülene kadar animasyon yapma
    }
    return {
      // translateX'i 0'dan 1'e anime ediyoruz ve bunu 0'dan -moveAmount'a çeviriyoruz.
      transform: [{ translateX: interpolate(translateX.value, [0, 1], [0, -moveAmount]) }],
    };
  });

  const startAnimation = (width: number) => {
    // Sabit bir kayma hızı için süreyi dinamik olarak hesapla.
    // Hız = 40 piksel/saniye
    const speed = 40;
    const duration = (width / speed) * 1000;

    // Animasyonu başlatmadan önce mevcut olanı durdur ve sıfırla.
    cancelAnimation(translateX);
    translateX.value = 0;
    // Animasyonu sonsuz döngüde başlat
    translateX.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1 // sonsuz döngü
    );
  };

  const handleOnLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    if (measuredWidth > 0 && textContainerWidth.value === 0) {
      textContainerWidth.value = measuredWidth;
      // Reanimated UI thread'inden JS thread'ine güvenli geçiş için runOnJS kullanıyoruz.
      runOnJS(startAnimation)(measuredWidth);
    }
  };

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.text}>Loading rates...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.row, animatedStyle]}>
        {/* Metni iki kez render ederek kesintisiz bir döngü sağlıyoruz. */}
        {/* onLayout sadece ilk metinde, çünkü ikisi de aynı genişlikte olacak. */}
        <ThemedText onLayout={handleOnLayout} style={styles.text} numberOfLines={1}>
          {text}
        </ThemedText>
        {/* İkinci metin, birincisi ekran dışına çıkarken boşluğu doldurur. */}
        <ThemedText style={styles.text} numberOfLines={1}>
          {text}
        </ThemedText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    overflow: 'hidden', // Bu, taşan metnin görünmemesini sağlar.
  },
  row: {
    // Metinlerin yan yana durmasını sağlar.
    flexDirection: 'row',
    // ANAHTAR DÜZELTME: Pozisyonunu serbestçe animate edebilmek için.
    position: 'absolute',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 25, // Metinler arası boşluğu artırıyoruz.
  },
});