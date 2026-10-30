import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { auth } from '@/firebaseConfig';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';

export default function LoginScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, colors, t, language } = useSettings();
  const styles = createStyles(colors, isDark);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Eksik Bilgi' : 'Missing Information',
        text2: language === 'tr' ? 'Lütfen e-posta ve şifrenizi girin.' : 'Please enter both email and password.',
      });
      return;
    }
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      let errorMessage = language === 'tr' ? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' : 'An unexpected error occurred. Please try again.';
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        errorMessage = language === 'tr' ? 'Geçersiz e-posta veya şifre. Lütfen tekrar deneyin.' : 'Invalid email or password. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Giriş Başarısız' : 'Login Failed',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await signInAnonymously(auth);
      router.replace('/(tabs)');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Giriş Başarısız' : 'Sign-In Failed',
        text2: error.message || (language === 'tr' ? 'Misafir girişi yapılamadı.' : 'Could not sign in anonymously.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}>
          
          {/* Brand Icon Header */}
          <View style={styles.brandSection}>
            <View style={styles.brandIconGlow}>
              <Ionicons name="wallet" size={32} color={Colors.tint} />
            </View>
            <ThemedText style={styles.brandTitle}>{t('loginWelcomeTitle')}</ThemedText>
            <ThemedText style={styles.brandSubtitle}>
              {t('loginWelcomeSubtitle')}
            </ThemedText>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Email Field */}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={19} color={colors.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder={t('emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={19} color={colors.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.textMuted}
              />
              <AnimatedPressable
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={colors.textSecondary}
                />
              </AnimatedPressable>
            </View>

            {/* Primary Login Button */}
            <AnimatedPressable
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} />
              ) : (
                <ThemedText style={styles.primaryButtonText}>{t('loginBtn')}</ThemedText>
              )}
            </AnimatedPressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <ThemedText style={styles.dividerLabel}>{language === 'tr' ? 'VEYA' : 'OR'}</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            {/* Anonymous Guest Button */}
            {!user && (
              <AnimatedPressable
                style={styles.guestButton}
                onPress={handleAnonymousSignIn}
                disabled={loading}>
                <Ionicons name="finger-print-outline" size={18} color={colors.textSecondary} />
                <ThemedText style={styles.guestButtonText}>{t('guestBtn')}</ThemedText>
              </AnimatedPressable>
            )}
          </View>

          {/* Sign Up Footer Link */}
          <View style={styles.footerRow}>
            <ThemedText style={styles.footerPrompt}>{t('noAccountPrompt')} </ThemedText>
            <Link href="/signup" asChild>
              <AnimatedPressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <ThemedText style={styles.footerLink}>{t('signupBtn')}</ThemedText>
              </AnimatedPressable>
            </Link>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    brandSection: {
      alignItems: 'center',
      marginBottom: 28,
    },
    brandIconGlow: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: isDark ? 'rgba(57, 255, 20, 0.1)' : 'rgba(5, 150, 105, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(57, 255, 20, 0.3)' : 'rgba(5, 150, 105, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: colors.tint,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.35 : 0.2,
          shadowRadius: 10,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    brandTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.5,
    },
    brandSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
      maxWidth: 280,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 14,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 52,
      marginBottom: 14,
    },
    fieldIcon: {
      marginRight: 10,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    primaryButton: {
      backgroundColor: colors.tint,
      height: 52,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
      ...Platform.select({
        ios: {
          shadowColor: colors.tint,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#000000' : '#FFFFFF',
      letterSpacing: 0.2,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginHorizontal: 12,
    },
    guestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      height: 50,
      borderRadius: 14,
      gap: 8,
    },
    guestButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
    },
    footerPrompt: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.tint,
    },
  });