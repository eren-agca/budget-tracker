import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';

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
  const { isDark, colors } = useSettings();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(translateY, {
      toValue: 500,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 75 || gestureState.vy > 0.6) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={[styles.backdrop, backdropStyle]}>
        {/* Tapping anywhere outside the sheet closes the menu */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          {...(enableFullSheetDrag ? panResponder.panHandlers : {})}
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#18181C' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            },
            sheetStyle,
            { transform: [{ translateY }] },
          ]}>
          {showHandle && (
            <View
              style={styles.handleContainer}
              {...(!enableFullSheetDrag ? panResponder.panHandlers : {})}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)' },
                  handleStyle,
                ]}
              />
            </View>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
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
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
