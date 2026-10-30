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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  EmailAuthProvider,
  linkWithCredential,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, colors, t, language } = useSettings();
  const styles = createStyles(colors, isDark);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Eksik Bilgi' : 'Missing Information',
        text2: language === 'tr' ? 'Lütfen tüm alanları doldurun.' : 'Please fill in all fields.',
      });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Şifre Uyuşmazlığı' : 'Password Mismatch',
        text2: language === 'tr' ? 'Girdiğiniz şifreler eşleşmiyor.' : 'The passwords you entered do not match.',
      });
      return;
    }
    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Zayıf Şifre' : 'Weak Password',
        text2: language === 'tr' ? 'Şifre en az 6 karakter olmalıdır.' : 'Password must be at least 6 characters.',
      });
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const currentUser = auth.currentUser;

      if (currentUser && currentUser.isAnonymous) {
        const credential = EmailAuthProvider.credential(email.trim(), password);
        await linkWithCredential(currentUser, credential);

        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            email: email.trim(),
            createdAt: Timestamp.now(),
          },
          { merge: true }
        );

        Toast.show({
          type: 'success',
          text1: language === 'tr' ? 'Hesap Yükseltildi' : 'Account Upgraded',
          text2: language === 'tr' ? 'Verileriniz artık kalıcı olarak eşitleniyor.' : 'Your data is now permanently synced.',
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newUser = userCredential.user;

        await setDoc(doc(db, 'users', newUser.uid), {
          email: newUser.email,
          createdAt: Timestamp.now(),
        });

        Toast.show({
          type: 'success',
          text1: language === 'tr' ? 'Hoş Geldiniz' : 'Welcome',
          text2: language === 'tr' ? 'Hesabınız başarıyla oluşturuldu.' : 'Account created successfully.',
        });
      }

      if (router.canGoBack()) {
        router.back();
      }
    } catch (error: any) {
      let errorMessage = language === 'tr' ? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' : 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = language === 'tr' ? 'Bu e-posta adresi zaten kayıtlı.' : 'This email address is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = language === 'tr' ? 'Şifre en az 6 karakter olmalıdır.' : 'The password must be at least 6 characters.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Kayıt Başarısız' : 'Sign Up Failed',
        text2: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
        
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <AnimatedPressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => router.back()}
            style={styles.closeButton}>
            <Ionicons name="close" size={22} color={colors.text} />
          </AnimatedPressable>
          <ThemedText style={styles.navTitle}>{t('createAccountTitle')}</ThemedText>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}>
            
            {/* Header info */}
            <View style={styles.headerSection}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={30} color={colors.tint} />
              </View>
              <ThemedText style={styles.headerTitle}>{t('createAccountTitle')}</ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {t('createAccountSubtitle')}
              </ThemedText>
            </View>

            {/* Form Card */}
            <View style={styles.card}>
              {/* Email */}
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

              {/* Password */}
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.textSecondary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={`${t('passwordPlaceholder')} (min. 6)`}
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

              {/* Confirm Password */}
              <View style={styles.inputWrap}>
                <Ionicons name="checkmark-done-outline" size={19} color={colors.textSecondary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Submit CTA */}
              <AnimatedPressable
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleSignUp}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>{t('signupBtn')}</ThemedText>
                )}
              </AnimatedPressable>
            </View>

            {/* Back to Login Footer */}
            <View style={styles.footerRow}>
              <ThemedText style={styles.footerPrompt}>{t('hasAccountPrompt')} </ThemedText>
              <AnimatedPressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => router.back()}>
                <ThemedText style={styles.footerLink}>{t('loginBtn')}</ThemedText>
              </AnimatedPressable>
            </View>
          </ScrollView>
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
    flex: {
      flex: 1,
    },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 24,
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(57, 255, 20, 0.1)' : 'rgba(5, 150, 105, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(57, 255, 20, 0.25)' : 'rgba(5, 150, 105, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
      maxWidth: 290,
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
      marginTop: 8,
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