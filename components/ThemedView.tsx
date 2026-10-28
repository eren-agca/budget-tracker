import { View, type ViewProps } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';

export type ThemedViewProps = ViewProps;

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  const { colors } = useSettings();
  const bgColor = colors?.background || Colors.background;

  return <View style={[{ backgroundColor: bgColor }, style]} {...otherProps} />;
}
