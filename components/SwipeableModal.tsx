import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  StyleProp,
  ViewStyle,
  Dimensions,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';

const INITIAL_HEIGHT = Dimensions.get('window').height;

export interface SwipeableModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  enableFullSheetDrag?: boolean;
  showHandle?: boolean;
  handleStyle?: StyleProp<ViewStyle>;
}

export function SwipeableModal({
  visible,
  onClose,
  children,
  sheetStyle,
  backdropStyle,
  enableFullSheetDrag = false,
  showHandle = true,
  handleStyle,
}: SwipeableModalProps) {
  const { isDark } = useSettings();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(INITIAL_HEIGHT)).current;
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const sheetTopRef = useRef(0);
  const enableFullSheetDragRef = useRef(enableFullSheetDrag);
  enableFullSheetDragRef.current = enableFullSheetDrag;

  // Backdrop opacity is 100% synchronized with sheet translateY position
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, screenHeight * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setRendered(true);
      translateY.setValue(screenHeight * 0.65);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 26,
        stiffness: 260,
        mass: 0.85,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
    } else if (rendered && !isClosingRef.current) {
      // Closed externally (e.g. via X button or form submit)
      isClosingRef.current = true;
      Animated.timing(translateY, {
        toValue: screenHeight * 0.7,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setRendered(false);
        isClosingRef.current = false;
      });
    }
  }, [visible, screenHeight]);

  const animateDismiss = useCallback(
    (withHaptic = true) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      if (withHaptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Animated.timing(translateY, {
        toValue: screenHeight * 0.7,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setRendered(false);
        isClosingRef.current = false;
        onCloseRef.current();
      });
    },
    [screenHeight, translateY]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isDownwardSwipe =
          gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2;
        if (!isDownwardSwipe) return false;
        if (enableFullSheetDragRef.current) return true;
        // Allow dragging from the handle and the entire top header zone (~96px)
        const touchOffsetFromTop = gestureState.y0 - sheetTopRef.current;
        return touchOffsetFromTop <= 96;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.65) {
          animateDismiss(true);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 280,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          overshootClamping: true,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!rendered) {
    return null;
  }

  const safeMaxHeight = Math.round(screenHeight - Math.max(insets.top, 24) - 10);

  return (
    <Modal
      transparent={true}
      visible={rendered}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={() => animateDismiss(false)}>
      <View style={styles.container}>
        {/* Synchronized Fading Backdrop (never slides!) */}
        <TouchableWithoutFeedback onPress={() => animateDismiss(false)}>
          <Animated.View
            style={[
              styles.backdrop,
              backdropStyle,
              { opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          onLayout={(e) => {
            sheetTopRef.current = e.nativeEvent.layout.y;
          }}
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              maxHeight: safeMaxHeight,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: isDark ? '#18181C' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            },
            sheetStyle,
            { transform: [{ translateY }] },
          ]}>
          {showHandle && (
            <View style={styles.handleContainer}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)' },
                  handleStyle,
                ]}
              />
            </View>
          )}
          <View style={styles.sheetBody}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#18181C',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  sheetBody: {
    flexShrink: 1,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
