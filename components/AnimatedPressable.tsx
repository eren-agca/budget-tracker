import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {  
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export const AnimatedPressable: React.FC<PressableProps> = ({ children, style, ...props }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressableComponent onPressIn={handlePressIn} onPressOut={handlePressOut} style={[style, animatedStyle]} {...props}>
      {children}
    </AnimatedPressableComponent>
  );
};