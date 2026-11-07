import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Reference dimensions: iPhone 15 / 16 (393 x 852)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

const initialWindow = Dimensions.get('window');

export function hs(size: number, width = initialWindow.width): number {
  const scale = Math.min(Math.max(width / BASE_WIDTH, 0.82), 1.18);
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
}

export function vs(size: number, height = initialWindow.height): number {
  const scale = Math.min(Math.max(height / BASE_HEIGHT, 0.78), 1.16);
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
}

export function ms(size: number, factor = 0.45, width = initialWindow.width): number {
  const scaled = hs(size, width);
  return Math.round(PixelRatio.roundToNearestPixel(size + (scaled - size) * factor));
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallScreen = height < 740 || width < 365;
  const isCompactScreen = height < 830;
  const isLargeScreen = width >= 414 && height >= 890;

  const hScale = (size: number) => hs(size, width);
  const vScale = (size: number) => vs(size, height);
  const mScale = (size: number, factor = 0.45) => ms(size, factor, width);

  // Safe maximum height for bottom sheet modals and their inner ScrollViews
  const modalSheetMaxHeight = Math.round(height - Math.max(insets.top, 24) - 16);
  const modalScrollMaxHeight = Math.round(
    modalSheetMaxHeight - vScale(68) - Math.max(insets.bottom, 16)
  );

  return {
    width,
    height,
    insets,
    isSmallScreen,
    isCompactScreen,
    isLargeScreen,
    hs: hScale,
    vs: vScale,
    ms: mScale,
    modalSheetMaxHeight,
    modalScrollMaxHeight,
  };
}

