import { Text, type TextProps, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const flatStyle = StyleSheet.flatten(style);
  const hasCustomFontSize = flatStyle?.fontSize !== undefined && flatStyle.fontSize !== 16;
  const hasCustomLineHeight = flatStyle?.lineHeight !== undefined;

  const defaultStyle = (hasCustomFontSize || hasCustomLineHeight)
    ? undefined
    : styles.default;

  return (
    <Text
      style={[
        { color: Colors.text },
        type === 'default' ? defaultStyle : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    fontSize: 16,
    color: Colors.tint,
  },
});
