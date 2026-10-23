---
name: mobile-design
description: React Native mobile UI/UX engineering, styling best practices, touch ergonomics, and safe area handling for iOS and Android. Triggers on React Native screens, StyleSheet creation, Tailwind/NativeWind UI, and component layout requests.
---

# React Native Mobile Design System

Apply these design principles, architectural patterns, and ergonomic rules whenever generating mobile screens or UI components.

## 1. Ergonomics & Touch Targets
- **Hit Slop & Target Size:** Always ensure minimum touchable areas of 44x44pt on iOS and 48x48dp on Android. Use `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` on small icons.
- **Thumb Zone:** Keep primary actions (submit, continue, filter) within the lower 40% of the screen.
- **Component Feedback:** Use `Pressable` with opacity/scale feedback on press; avoid unstyled or feedback-less taps.

## 2. Safe Areas & Layout
- **Safe Area Context:** Never use hardcoded top/bottom padding for notches. Always utilize `react-native-safe-area-context` hooks (`useSafeAreaInsets()`).
- **Keyboard Handling:** Wrap forms in `KeyboardAvoidingView` (behavior `padding` on iOS, `height` or handled by windowSoftInputMode on Android) combined with `TouchableWithoutFeedback` to dismiss keyboard.
- **Edge-to-Edge:** Extend background colors/images into notch and home indicator areas while insetting interactive content.

## 3. Platform Consistency
- **Platform Branching:** Leverage `Platform.select()` for shadow styling (`elevation` on Android, `shadowOffset`/`shadowOpacity`/`shadowRadius` on iOS).
- **Haptics:** Recommend `expo-haptics` or `react-native-haptic-feedback` on key interactions (switch toggles, card swipes, success states).
- **Scroll Views:** Always set `showsVerticalScrollIndicator={false}` where clean aesthetics demand it, and configure `contentContainerStyle` with bottom inset padding so content isn't blocked by floating buttons.

## 4. UI Patterns & States
- **Skeletons over Spinners:** For loading states, implement skeleton placeholder blocks over plain full-screen activity indicators.
- **Lists:** Prefer `FlashList` or `FlatList` over mapping views inside a `ScrollView`. Provide `ListEmptyComponent` for zero-data states.
