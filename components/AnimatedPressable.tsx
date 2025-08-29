// Bu dosya, basıldığında ölçeklenen, yeniden kullanılabilir bir animasyonlu buton bileşeni içerir.

import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {  
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Pressable bileşenini, Reanimated kütüphanesi tarafından animate edilebilir hale getiriyoruz.
const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export const AnimatedPressable: React.FC<PressableProps> = ({ children, style, ...props }) => {
  // Butonun ölçeğini (boyutunu) tutacak olan animasyon değeri.
  const scale = useSharedValue(1);

  // Ölçek değerine göre transform stilini oluşturan animasyonlu stil.
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Butona basıldığında ölçeği hafifçe küçült.
  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  // Buton bırakıldığında ölçeği eski haline getir.
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressableComponent onPressIn={handlePressIn} onPressOut={handlePressOut} style={[style, animatedStyle]} {...props}>
      {children}
    </AnimatedPressableComponent>
  );
};