import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type AppTheme = 'dark' | 'light';
export type AppLanguage = 'tr' | 'en';

export const translations = {
  tr: {
    // Settings & Navigation
    settings: 'Ayarlar',
    settingsSubtitle: 'UYGULAMA VE HESAP TERCİHLERİ',
    theme: 'Görünüm ve Tema',
    themeDark: 'Karanlık',
    themeLight: 'Aydınlık',
    language: 'Uygulama Dili',
    langTr: 'Türkçe',
    langEn: 'English',
    currenciesTitle: 'Kullanılabilir Kurlar',
    about: 'Uygulama Bilgisi',
    version: 'Sürüm 1.2.0 (Mobile Ready)',
    cloudSync: 'Firebase & Canlı Piyasa Entegrasyonu',
    
    // Auth & Account
    accountSection: 'Hesap & Güvenlik',
    loggedInAs: 'Giriş Yapılan Hesap',
    activeSession: 'Aktif Oturum',
    guestUser: 'Misafir Kullanıcı',
    logoutBtn: 'Hesaptan Çıkış Yap',
    logoutConfirmTitle: 'Çıkış Yapmak İstiyor Musunuz?',
    logoutConfirmDesc: 'Oturumunuz kapatılacak ve giriş ekranına yönlendirileceksiniz.',
    cancel: 'Vazgeç',
    logoutAction: 'Çıkış Yap',
    
    // Dashboard & Actions
    welcome: 'Hoş geldin',
    portfolio: 'Portföyüm',
    totalBalance: 'Toplam Varlık',
    recentTransactions: 'Son İşlemler',
    seeAll: 'Tümünü Gör',
    income: 'Gelir',
    expense: 'Gider',
    deleteConfirmTitle: 'İşlemi Sil',
    deleteConfirmDesc: 'Bu harcama kaydını kalıcı olarak silmek istediğinize emin misiniz?',
    deleteAction: 'Sil',
    
    // Tabs
    tabHome: 'Ana Sayfa',
    tabCharts: 'Grafikler',
    tabRecurring: 'Tekrarlayanlar',
  },
  en: {
    // Settings & Navigation
    settings: 'Settings',
    settingsSubtitle: 'APP & ACCOUNT PREFERENCES',
    theme: 'Appearance & Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'App Language',
    langTr: 'Türkçe',
    langEn: 'English',
    currenciesTitle: 'Supported Currencies',
    about: 'About Application',
    version: 'Version 1.2.0 (Mobile Ready)',
    cloudSync: 'Firebase & Live Markets Integration',
    
    // Auth & Account
    accountSection: 'Account & Security',
    loggedInAs: 'Signed in as',
    activeSession: 'Active Session',
    guestUser: 'Guest User',
    logoutBtn: 'Log Out of Account',
    logoutConfirmTitle: 'Are you sure you want to log out?',
    logoutConfirmDesc: 'Your session will be closed and you will be redirected to the login screen.',
    cancel: 'Cancel',
    logoutAction: 'Log Out',
    
    // Dashboard & Actions
    welcome: 'Welcome back',
    portfolio: 'My Portfolio',
    totalBalance: 'Total Balance',
    recentTransactions: 'Recent Transactions',
    seeAll: 'See All',
    income: 'Income',
    expense: 'Expense',
    deleteConfirmTitle: 'Delete Transaction',
    deleteConfirmDesc: 'Are you sure you want to permanently delete this transaction?',
    deleteAction: 'Delete',
    
    // Tabs
    tabHome: 'Home',
    tabCharts: 'Charts',
    tabRecurring: 'Recurring',
  },
};

export type TranslationKey = keyof typeof translations.tr;

export interface ThemeColors {
  background: string;
  card: string;
  cardSecondary: string;
  cardElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  tint: string;
}

const darkColors: ThemeColors = {
  background: '#0E0E10',
  card: '#191A20',
  cardSecondary: '#121215',
  cardElevated: '#24262E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#636366',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  tint: '#39FF14',
};

const lightColors: ThemeColors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  cardSecondary: '#F8F9FA',
  cardElevated: '#E9E9EB',
  text: '#11181C',
  textSecondary: '#6C6C70',
  textMuted: '#8E8E93',
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  tint: '#10B981',
};

interface SettingsContextType {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (t: AppTheme) => void;
  toggleTheme: () => void;
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  colors: ThemeColors;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@budget_tracker_theme';
const LANG_STORAGE_KEY = '@budget_tracker_lang';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>('dark');
  const [language, setLanguageState] = useState<AppLanguage>('tr');

  // Load persisted preferences
  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeState(savedTheme);
        }
        const savedLang = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        if (savedLang === 'tr' || savedLang === 'en') {
          setLanguageState(savedLang);
        }
      } catch (err) {
        console.warn('Could not load settings preferences:', err);
      }
    })();
  }, []);

  const setTheme = (newTheme: AppTheme) => {
    Haptics.selectionAsync().catch(() => {});
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const setLanguage = (newLang: AppLanguage) => {
    Haptics.selectionAsync().catch(() => {});
    setLanguageState(newLang);
    AsyncStorage.setItem(LANG_STORAGE_KEY, newLang).catch(() => {});
  };

  const isDark = theme === 'dark';
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.tr;
    return (dict as any)[key] || key;
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        isDark,
        setTheme,
        toggleTheme,
        language,
        setLanguage,
        t,
        colors,
      }}>
      {children}
    </SettingsContext.Provider>
  );
};

const defaultContextValue: SettingsContextType = {
  theme: 'dark',
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {},
  language: 'tr',
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.tr[key] || key,
  colors: darkColors,
};

export const useSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  return ctx || defaultContextValue;
};
