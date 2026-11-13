import React, { useEffect, useCallback, useState, useRef, useId } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Platform, Animated, Easing, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { StockBrandBadge } from './BrandLogo';
import { Colors } from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';

export interface TickerItemData {
  text: string;
  logoSymbol?: string;
  direction?: 'up' | 'down' | 'flat';
}

interface TickerProps {
  data: (string | TickerItemData)[];
  height?: number;
  speed?: number;
  badgeLabel?: string;
  isError?: boolean;
  isMarketClosed?: boolean;
}

export const Ticker: React.FC<TickerProps> = ({
  data,
  height = 30,
  speed = 36,
  badgeLabel,
  isError,
  isMarketClosed = false,
}) => {
  const { colors, isDark } = useSettings();
  const rawId = useId();
  const uniqueAnimId = useRef(`tk_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}`).current;

  const [measuredWidth, setMeasuredWidth] = useState(0);
  const animatedTranslateX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const firstItemText = typeof data[0] === 'string' ? data[0] : data[0]?.text || '';
  const isUnavailable = isError || (data.length === 1 && firstItemText.includes('devre dışı'));
  const isClosed = Boolean(isMarketClosed && !isUnavailable);

  const handleOnLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.ceil(event.nativeEvent.layout.width);
    if (width <= 20) return;

    setMeasuredWidth((prev) => {
      // Only update if not measured yet, or if width changed significantly (> 30px, e.g. items added/removed)
      // so routine live price updates never restart or hitch the scrolling position.
      if (prev === 0 || Math.abs(prev - width) > 30) {
        return width;
      }
      return prev;
    });
  }, []);

  // Native (iOS & Android) animation loop using native driver with resetBeforeIteration
  useEffect(() => {
    if (Platform.OS === 'web' || measuredWidth <= 20) return;

    if (loopRef.current) {
      loopRef.current.stop();
    }

    animatedTranslateX.setValue(0);
    const duration = (measuredWidth / speed) * 1000;
    const loop = Animated.loop(
      Animated.timing(animatedTranslateX, {
        toValue: -measuredWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: -1, resetBeforeIteration: true }
    );

    loopRef.current = loop;
    loop.start();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        animatedTranslateX.setValue(0);
        loop.start();
      }
    });

    return () => {
      loop.stop();
      appStateSub.remove();
    };
  }, [measuredWidth, speed]);

  const containerStyle = [
    styles.container,
    {
      height,
      backgroundColor: colors.card,
      borderColor: isUnavailable ? colors.warning : colors.border,
    },
  ];

  if (!data || data.length === 0) {
    return (
      <View style={containerStyle}>
        <ThemedText style={[styles.textLoading, { color: colors.textMuted }]}>
          Loading market rates...
        </ThemedText>
      </View>
    );
  }

  const badgeBg = isUnavailable
    ? colors.warningSoft
    : isClosed
    ? colors.cardSecondary
    : colors.tintSoft;

  const badgeBorder = isUnavailable
    ? 'rgba(217, 119, 6, 0.25)'
    : isClosed
    ? colors.border
    : colors.tintSoft;

  const badgeColor = isUnavailable
    ? colors.warning
    : isClosed
    ? colors.textSecondary
    : colors.tint;

  const itemTextColor = isUnavailable
    ? isDark
      ? '#FFB340'
      : '#D97706'
    : colors.text;

  const separatorColor = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.2)';

  const renderGroup = (prefix: string, onLayout?: (e: LayoutChangeEvent) => void) => (
    <View onLayout={onLayout} style={styles.tickerGroup}>
      {data.map((item, idx) => {
        const text = typeof item === 'string' ? item : item.text;
        const logoSymbol = typeof item === 'string' ? undefined : item.logoSymbol;
        const direction = typeof item === 'string' ? undefined : item.direction;
        return (
          <View key={`${prefix}-${idx}`} style={styles.tickerItem}>
            {logoSymbol ? (
              <View style={{ marginRight: 5 }}>
                <StockBrandBadge symbol={logoSymbol} size={18} iconSize={11} />
              </View>
            ) : null}
            <ThemedText style={[styles.text, { color: itemTextColor }]}>{text}</ThemedText>
            {direction === 'up' && (
              <Ionicons
                name="arrow-up"
                size={12}
                color={colors.tint}
                style={styles.directionArrow}
              />
            )}
            {direction === 'down' && (
              <Ionicons
                name="arrow-down"
                size={12}
                color={colors.expense}
                style={styles.directionArrow}
              />
            )}
            {direction === 'flat' && (
              <Ionicons
                name="remove"
                size={13}
                color={isDark ? '#8E8E93' : '#64748B'}
                style={styles.directionArrow}
              />
            )}
            <ThemedText style={[styles.separator, { color: separatorColor }]}>◆</ThemedText>
          </View>
        );
      })}
    </View>
  );

  const durationSec = measuredWidth > 0 ? (measuredWidth / speed).toFixed(2) : '30';

  // Web CSS hardware-accelerated animation style
  const webScrollStyle =
    Platform.OS === 'web' && measuredWidth > 0
      ? ({
          animationName: `anim_${uniqueAnimId}`,
          animationDuration: `${durationSec}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          willChange: 'transform',
        } as any)
      : null;

  // Native transform style
  const nativeScrollStyle =
    Platform.OS !== 'web'
      ? {
          transform: [{ translateX: animatedTranslateX }],
        }
      : null;

  return (
    <View style={containerStyle}>
      {Platform.OS === 'web' && measuredWidth > 0 && (
        <style>{`
          @keyframes anim_${uniqueAnimId} {
            0% {
              transform: translate3d(0px, 0px, 0px);
            }
            100% {
              transform: translate3d(-${measuredWidth}px, 0px, 0px);
            }
          }
        `}</style>
      )}

      {badgeLabel ? (
        <View style={[styles.badge, { backgroundColor: badgeBg, borderRightColor: badgeBorder }]}>
          {isClosed ? (
            <Ionicons name="moon" size={9} color={badgeColor} style={{ marginRight: 1 }} />
          ) : (
            <View style={[styles.liveDot, { backgroundColor: badgeColor }]} />
          )}
          <ThemedText style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</ThemedText>
        </View>
      ) : null}
      <View style={styles.marqueeMask}>
        {Platform.OS === 'web' ? (
          <View style={[styles.row, webScrollStyle]}>
            {renderGroup('g1', handleOnLayout)}
            {renderGroup('g2')}
            {renderGroup('g3')}
          </View>
        ) : (
          <Animated.View style={[styles.row, nativeScrollStyle]}>
            {renderGroup('g1', handleOnLayout)}
            {renderGroup('g2')}
            {renderGroup('g3')}
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161618',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  badge: {
    width: 86,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(57, 255, 20, 0.12)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(57, 255, 20, 0.22)',
    gap: 6,
    zIndex: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.tint,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 0.8,
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginTop: Platform.OS === 'ios' ? 1 : 0,
  },
  marqueeMask: {
    flex: 1,
    overflow: 'hidden',
    height: '100%',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: '100%',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  tickerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    flexWrap: 'nowrap',
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    flexWrap: 'nowrap',
  },
  text: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
    color: '#D1D1D6',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  directionArrow: {
    marginHorizontal: 3,
  },
  separator: {
    fontSize: 6,
    marginHorizontal: 12,
  },
  textLoading: {
    fontSize: 12,
    marginLeft: 12,
  },
});
