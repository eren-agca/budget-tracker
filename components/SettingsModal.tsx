import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { auth } from '@/firebaseConfig';
import { currencies } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';
import { SwipeableModal } from '@/components/SwipeableModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, setTheme, language, setLanguage, t, isDark, colors } = useSettings();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowLogoutConfirm(false);
      setLoggingOut(false);
    }
  }, [visible]);

  const handleLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

      // 1. Close modal first so its dismiss animation runs smoothly
      onClose();

      // 2. Wait for modal animation to complete before signing out to prevent UIKit presentation freezing
      setTimeout(async () => {
        try {
          await signOut(auth);
          router.replace('/login');
        } catch (error) {
          console.error('Error signing out:', error);
        } finally {
          setLoggingOut(false);
          setShowLogoutConfirm(false);
        }
      }, 300);
    } catch (error) {
      console.error('Error in handleLogout:', error);
      setLoggingOut(false);
    }
  };

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userDisplayName = user?.email ? user.email.split('@')[0] : (user?.isAnonymous ? t('guestUser') : 'Budget Portfolio');

  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        },
      ]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('settingsSubtitle')}
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            {t('settings')}
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onClose();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name="close-circle"
            size={26}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border,
            },
          ]}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: colors.tintSoft },
            ]}>
            <ThemedText
              style={[styles.avatarText, { color: colors.tint }]}>
              {userInitial}
            </ThemedText>
          </View>

          <View style={styles.profileInfo}>
            <ThemedText style={[styles.profileName, { color: colors.text }]}>
              {userDisplayName}
            </ThemedText>
            <ThemedText style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || t('guestUser')}
            </ThemedText>
          </View>

          <View
            style={[
              styles.sessionBadge,
              { backgroundColor: colors.tintSoft },
            ]}>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: colors.tint },
              ]}
            />
            <ThemedText
              style={[
                styles.sessionBadgeText,
                { color: colors.tint },
              ]}
            >
              {t('activeSession')}
            </ThemedText>
          </View>
        </View>

        {/* Theme Section */}
        <View style={styles.sectionWrap}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('theme').toUpperCase()}
          </ThemedText>

          <View style={styles.optionsRow}>
            {/* Dark Mode Tile */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTheme('dark')}
              style={[
                styles.optionTile,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                theme === 'dark' && {
                  borderColor: isDark ? Colors.tint : '#059669',
                  backgroundColor: colors.tintSoft,
                },
              ]}>
              <View style={styles.optionTopRow}>
                <Ionicons
                  name="moon"
                  size={20}
                  color={theme === 'dark' ? (isDark ? Colors.tint : '#059669') : colors.textSecondary}
                />
                {theme === 'dark' && (
                  <Ionicons name="checkmark-circle" size={18} color={isDark ? Colors.tint : '#059669'} />
                )}
              </View>
              <ThemedText
                style={[
                  styles.optionLabel,
                  { color: colors.text },
                  theme === 'dark' && { color: isDark ? Colors.tint : '#059669', fontWeight: '800' },
                ]}>
                {t('themeDark')}
              </ThemedText>
            </TouchableOpacity>

            {/* Light Mode Tile */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTheme('light')}
              style={[
                styles.optionTile,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                theme === 'light' && {
                  borderColor: isDark ? '#10B981' : colors.tint,
                  backgroundColor: colors.tintSoft,
                },
              ]}>
              <View style={styles.optionTopRow}>
                <Ionicons
                  name="sunny"
                  size={20}
                  color={theme === 'light' ? colors.tint : colors.textSecondary}
                />
                {theme === 'light' && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.tint} />
                )}
              </View>
              <ThemedText
                style={[
                  styles.optionLabel,
                  { color: colors.text },
                  theme === 'light' && { color: colors.tint, fontWeight: '800' },
                ]}>
                {t('themeLight')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.sectionWrap}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('language').toUpperCase()}
          </ThemedText>

          <View style={styles.optionsRow}>
            {/* Turkish Option */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setLanguage('tr')}
              style={[
                styles.optionTile,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                language === 'tr' && {
                  borderColor: colors.tint,
                  backgroundColor: colors.tintSoft,
                },
              ]}>
              <View style={styles.optionTopRow}>
                <ThemedText style={{ fontSize: 18 }}>🇹🇷</ThemedText>
                {language === 'tr' && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.tint}
                  />
                )}
              </View>
              <ThemedText
                style={[
                  styles.optionLabel,
                  { color: colors.text },
                  language === 'tr' && {
                    color: colors.tint,
                    fontWeight: '800',
                  },
                ]}>
                Türkçe
              </ThemedText>
            </TouchableOpacity>

            {/* English Option */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setLanguage('en')}
              style={[
                styles.optionTile,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                language === 'en' && {
                  borderColor: colors.tint,
                  backgroundColor: colors.tintSoft,
                },
              ]}>
              <View style={styles.optionTopRow}>
                <ThemedText style={{ fontSize: 18 }}>🇬🇧</ThemedText>
                {language === 'en' && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.tint}
                  />
                )}
              </View>
              <ThemedText
                style={[
                  styles.optionLabel,
                  { color: colors.text },
                  language === 'en' && {
                    color: colors.tint,
                    fontWeight: '800',
                  },
                ]}>
                English
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Supported Currencies Badge Row */}
        <View style={styles.sectionWrap}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('currenciesTitle').toUpperCase()}
          </ThemedText>
          <View style={styles.currenciesRow}>
            {currencies.map((curr) => (
              <View
                key={curr.code}
                style={[
                  styles.currencyTag,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border,
                  },
                ]}>
                <ThemedText style={[styles.currencySymbol, { color: colors.tint }]}>
                  {curr.symbol}
                </ThemedText>
                <ThemedText style={[styles.currencyCode, { color: colors.text }]}>
                  {curr.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* App Info Box */}
        <View
          style={[
            styles.aboutBox,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border,
            },
          ]}>
          <View style={styles.aboutRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={colors.tint}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.aboutText, { color: colors.textSecondary }]}>
              {t('version')} • {t('cloudSync')}
            </ThemedText>
          </View>
        </View>

        {/* Logout Section: Clean button that opens the centered confirmation popup */}
        {user && (
          <View style={{ marginTop: 22 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowLogoutConfirm(true);
              }}
              style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={18} color="#FF453A" style={{ marginRight: 8 }} />
              <ThemedText style={styles.logoutButtonText}>{t('logoutBtn')}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Extra Popup Box for Logout Confirmation (Evet / Hayır) */}
      {showLogoutConfirm && (
        <View style={styles.popupOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowLogoutConfirm(false)}
          />
          <View
            style={[
              styles.popupCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}>
            <View style={styles.popupIconCircle}>
              <Ionicons name="log-out" size={26} color="#FF453A" />
            </View>

            <ThemedText style={[styles.popupTitle, { color: colors.text }]}>
              {t('logoutConfirmTitle')}
            </ThemedText>

            <ThemedText style={[styles.popupDesc, { color: colors.textSecondary }]}>
              {t('logoutConfirmDesc')}
            </ThemedText>

            <View style={styles.popupBtnRow}>
              {/* Hayır / Vazgeç */}
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={loggingOut}
                style={[
                  styles.popupCancelBtn,
                  { backgroundColor: colors.cardSecondary },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setShowLogoutConfirm(false);
                }}>
                <ThemedText style={[styles.popupCancelBtnText, { color: colors.text }]}>
                  {t('cancel')}
                </ThemedText>
              </TouchableOpacity>

              {/* Evet / Çıkış Yap */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={loggingOut}
                style={styles.popupConfirmBtn}
                onPress={handleLogout}>
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="log-out" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.popupConfirmBtnText}>{t('logoutAction')}</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionWrap: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  optionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  currenciesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  currencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '800',
  },
  currencyCode: {
    fontSize: 12,
    fontWeight: '600',
  },
  aboutBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 4,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutText: {
    fontSize: 11,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  logoutButtonText: {
    color: '#FF453A',
    fontSize: 15,
    fontWeight: '700',
  },
  popupOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  popupCard: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  popupIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  popupDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  popupBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  popupCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  popupConfirmBtn: {
    flex: 1.2,
    backgroundColor: '#FF453A',
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  popupConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
