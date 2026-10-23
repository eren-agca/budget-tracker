import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {  
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

const AnimatedPressableComponent = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends PressableProps {
  enableHaptics?: boolean;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  enableHaptics = true,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = (e: any) => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 250 });
    if (enableHaptics) {
      Haptics.selectionAsync().catch(() => {});
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 250 });
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableComponent onPressIn={handlePressIn} onPressOut={handlePressOut} style={[style, animatedStyle]} {...props}>
      {children}
    </AnimatedPressableComponent>
  );
};