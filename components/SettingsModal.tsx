import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { auth } from '@/firebaseConfig';
import { currencies } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, setTheme, language, setLanguage, t, isDark } = useSettings();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setShowLogoutConfirm(false);
      onClose();
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userDisplayName = user?.email ? user.email.split('@')[0] : (user?.isAnonymous ? t('guestUser') : 'Budget Portfolio');

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? '#191A20' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}>
            {/* Sheet Handle */}
            <View
              style={[
                styles.handle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' },
              ]}
            />

            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <ThemedText style={[styles.headerSubtitle, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
                  {t('settingsSubtitle')}
                </ThemedText>
                <ThemedText style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#11181C' }]}>
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
                  color={isDark ? '#8E8E93' : '#8E8E93'}
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
                    backgroundColor: isDark ? '#121215' : '#F4F5F7',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}>
                <View
                  style={[
                    styles.avatarCircle,
                    { backgroundColor: isDark ? 'rgba(57, 255, 20, 0.15)' : 'rgba(16, 185, 129, 0.15)' },
                  ]}>
                  <ThemedText
                    style={[styles.avatarText, { color: isDark ? Colors.tint : '#10B981' }]}>
                    {userInitial}
                  </ThemedText>
                </View>

                <View style={styles.profileInfo}>
                  <ThemedText style={[styles.profileName, { color: isDark ? '#FFFFFF' : '#11181C' }]}>
                    {userDisplayName}
                  </ThemedText>
                  <ThemedText style={[styles.profileEmail, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
                    {user?.email || t('guestUser')}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.sessionBadge,
                    { backgroundColor: isDark ? 'rgba(57, 255, 20, 0.1)' : 'rgba(16, 185, 129, 0.1)' },
                  ]}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: isDark ? Colors.tint : '#10B981' },
                    ]}
                  />
                  <ThemedText
                    style={[
                      styles.sessionBadgeText,
                      { color: isDark ? Colors.tint : '#10B981' },
                    ]}>
                    {t('activeSession')}
                  </ThemedText>
                </View>
              </View>

              {/* Theme Section */}
              <View style={styles.sectionWrap}>
                <ThemedText style={[styles.sectionTitle, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
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
                        backgroundColor: isDark ? '#121215' : '#F4F5F7',
                        borderColor: isDark ? 'rgba(57, 255, 20, 0.4)' : 'rgba(0, 0, 0, 0.08)',
                      },
                      theme === 'dark' && {
                        borderColor: Colors.tint,
                        backgroundColor: isDark ? 'rgba(57, 255, 20, 0.08)' : '#EAEBEE',
                      },
                    ]}>
                    <View style={styles.optionTopRow}>
                      <Ionicons
                        name="moon"
                        size={20}
                        color={theme === 'dark' ? Colors.tint : (isDark ? '#8E8E93' : '#6C6C70')}
                      />
                      {theme === 'dark' && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.tint} />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.optionLabel,
                        { color: isDark ? '#FFFFFF' : '#11181C' },
                        theme === 'dark' && { color: isDark ? Colors.tint : '#000000', fontWeight: '800' },
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
                        backgroundColor: isDark ? '#121215' : '#F4F5F7',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      },
                      theme === 'light' && {
                        borderColor: '#10B981',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                      },
                    ]}>
                    <View style={styles.optionTopRow}>
                      <Ionicons
                        name="sunny"
                        size={20}
                        color={theme === 'light' ? '#10B981' : (isDark ? '#8E8E93' : '#6C6C70')}
                      />
                      {theme === 'light' && (
                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.optionLabel,
                        { color: isDark ? '#FFFFFF' : '#11181C' },
                        theme === 'light' && { color: '#10B981', fontWeight: '800' },
                      ]}>
                      {t('themeLight')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Language Section */}
              <View style={styles.sectionWrap}>
                <ThemedText style={[styles.sectionTitle, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
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
                        backgroundColor: isDark ? '#121215' : '#F4F5F7',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      },
                      language === 'tr' && {
                        borderColor: isDark ? Colors.tint : '#10B981',
                        backgroundColor: isDark ? 'rgba(57, 255, 20, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      },
                    ]}>
                    <View style={styles.optionTopRow}>
                      <ThemedText style={{ fontSize: 18 }}>🇹🇷</ThemedText>
                      {language === 'tr' && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={isDark ? Colors.tint : '#10B981'}
                        />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.optionLabel,
                        { color: isDark ? '#FFFFFF' : '#11181C' },
                        language === 'tr' && {
                          color: isDark ? Colors.tint : '#10B981',
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
                        backgroundColor: isDark ? '#121215' : '#F4F5F7',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      },
                      language === 'en' && {
                        borderColor: isDark ? Colors.tint : '#10B981',
                        backgroundColor: isDark ? 'rgba(57, 255, 20, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      },
                    ]}>
                    <View style={styles.optionTopRow}>
                      <ThemedText style={{ fontSize: 18 }}>🇬🇧</ThemedText>
                      {language === 'en' && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={isDark ? Colors.tint : '#10B981'}
                        />
                      )}
                    </View>
                    <ThemedText
                      style={[
                        styles.optionLabel,
                        { color: isDark ? '#FFFFFF' : '#11181C' },
                        language === 'en' && {
                          color: isDark ? Colors.tint : '#10B981',
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
                <ThemedText style={[styles.sectionTitle, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
                  {t('currenciesTitle').toUpperCase()}
                </ThemedText>
                <View style={styles.currenciesRow}>
                  {currencies.map((curr) => (
                    <View
                      key={curr.code}
                      style={[
                        styles.currencyTag,
                        {
                          backgroundColor: isDark ? '#121215' : '#F4F5F7',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}>
                      <ThemedText style={[styles.currencySymbol, { color: isDark ? Colors.tint : '#10B981' }]}>
                        {curr.symbol}
                      </ThemedText>
                      <ThemedText style={[styles.currencyCode, { color: isDark ? '#FFFFFF' : '#11181C' }]}>
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
                    backgroundColor: isDark ? '#121215' : '#F4F5F7',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  },
                ]}>
                <View style={styles.aboutRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={isDark ? Colors.tint : '#10B981'}
                    style={{ marginRight: 6 }}
                  />
                  <ThemedText style={[styles.aboutText, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
                    {t('version')} • {t('cloudSync')}
                  </ThemedText>
                </View>
              </View>

              {/* Logout Button */}
              {user && (
                <View style={{ marginTop: 20 }}>
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
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Bottom Sheet */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowLogoutConfirm(false)}
          />
          <View
            style={[
              styles.confirmSheet,
              {
                backgroundColor: isDark ? '#191A20' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}>
            <View
              style={[
                styles.handle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' },
              ]}
            />

            <View style={styles.confirmHeader}>
              <View style={styles.logoutIconCircle}>
                <Ionicons name="log-out" size={26} color="#FF453A" />
              </View>
              <ThemedText style={[styles.confirmTitle, { color: isDark ? '#FFFFFF' : '#11181C' }]}>
                {t('logoutConfirmTitle')}
              </ThemedText>
              <ThemedText style={[styles.confirmDesc, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
                {t('logoutConfirmDesc')}
              </ThemedText>
            </View>

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.cancelBtn,
                  { backgroundColor: isDark ? '#24262E' : '#E5E5EA' },
                ]}
                onPress={() => setShowLogoutConfirm(false)}>
                <ThemedText style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  {t('cancel')}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.confirmLogoutBtn}
                onPress={handleLogout}>
                <Ionicons name="log-out" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <ThemedText style={styles.confirmLogoutBtnText}>{t('logoutAction')}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '85%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
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
  confirmSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmLogoutBtn: {
    flex: 1,
    backgroundColor: '#FF453A',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmLogoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
