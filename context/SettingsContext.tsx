import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type AppTheme = 'dark' | 'light';
export type AppLanguage = 'tr' | 'en';

export const translations = {
  tr: {
    // Navigation & Tabs
    tabHome: 'Cüzdan',
    tabCharts: 'Grafikler',
    tabRecurring: 'Abonelik',
    tabCards: 'Kartlar',

    // Greetings & Top Bar
    greetingMorning: 'Günaydın',
    greetingAfternoon: 'Tünaydın',
    greetingEvening: 'İyi akşamlar',
    myPortfolio: 'Portföyüm',

    // Dashboard & Balance Card
    totalBalanceLabel: 'TOPLAM VARLIK',
    netPositive: 'Pozitif Net Varlık',
    deficit: 'Açık / Eksi Bakiye',
    income: 'Gelir',
    expenses: 'Giderler',
    expense: 'Gider',
    recentTransactions: 'Son İşlemler',
    noTransactionsFound: 'İşlem Bulunamadı',
    noTransactionsSubtitle: 'İlk gelir veya giderinizi eklemek için alttaki "+" butonuna dokunun.',
    allCategories: 'Tüm Kategoriler',
    selectTimeRange: 'Tarih Aralığı Seçin',
    filterByCategory: 'Kategoriye Göre Filtrele',
    deleteConfirmTitle: 'İşlemi Sil',
    deleteConfirmDesc: 'Bu işlem kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
    deleteAction: 'Sil',
    delete: 'Sil',
    cancel: 'Vazgeç',
    marketTicker: 'PİYASALAR',
    cryptoTicker: 'KRİPTO',
    marketDataFallback: 'Canlı piyasa verileri geçici olarak devre dışı',

    // Analytics / Charts Screen
    analyticsSubtitle: 'FİNANSAL ANALİTİK',
    analyticsTitle: 'İçgörüler',
    spendingBreakdown: 'Harcama Dağılımı',
    incomeBreakdown: 'Gelir Dağılımı',
    noChartDataExpense: 'Grafiği göstermek için henüz gider verisi bulunmuyor.',
    noChartDataIncome: 'Grafiği göstermek için henüz gelir verisi bulunmuyor.',
    topCategories: 'En Yüksek Kategoriler',
    aiAdvisorBadge: 'YAPAY ZEKA FİNANS ASİSTANI',
    aiAnalyzeBtn: 'Analiz Et',
    aiAdvisorDesc: 'Google Gemini destekli yapay zeka ile harcama analizi, tasarruf tavsiyeleri ve anormallik tespitleri alın.',
    analyzing: 'Analiz ediliyor...',

    // Loop / Recurring Screen
    loopTitle: 'Sabit Ödemeler',
    loopSubtitle: 'ABONELİK VE DÜZENLİ GELİR YÖNETİMİ',
    tabSubscriptions: 'Abonelikler',
    tabRecurringIncomes: 'Sabit Gelirler',
    monthlyTotalCommitment: 'Aylık Toplam Taahhüt',
    monthlyTotalIncome: 'Aylık Toplam Sabit Gelir',
    newSubscription: 'Yeni Abonelik Ekle',
    subName: 'Abonelik Adı',
    subAmount: 'Ödeme Tutarı',
    billingCycle: 'Fatura Periyodu',
    monthly: 'Aylık',
    yearly: 'Yıllık',
    dueDay: 'Son Ödeme Günü',
    paymentMethodBank: 'Ödeme Yöntemi / Banka',
    select: 'Seçiniz',
    saveSubscription: 'Aboneliği Kaydet',
    activeSubscriptions: 'Aktif Abonelikler',
    noSubscriptions: 'Henüz kayıtlı bir aboneliğiniz yok.',
    noSubscriptionsSub: 'Yukarıdaki formdan yeni bir abonelik ekleyebilirsiniz.',
    newRecurringIncome: 'Düzenli Gelir Ekle',
    incomeSource: 'Gelir Kaynağı (Maaş, Kira...)',
    dayOfMonth: 'Her Ayın Günü (1-31)',
    saveRecurringIncome: 'Düzenli Geliri Kaydet',
    registeredIncomes: 'Kayıtlı Sabit Gelirler',
    noIncomes: 'Henüz kayıtlı düzenli bir geliriniz yok.',
    deleteSubTitle: 'Aboneliği Sil',
    deleteSubDesc: 'Bu aboneliği silmek istediğinize emin misiniz?',
    deleteIncomeTitle: 'Geliri Sil',
    deleteIncomeDesc: 'Bu düzenli geliri silmek istediğinize emin misiniz?',
    searchBank: 'Banka ara...',
    chooseBank: 'Banka Seç',
    dueDayPrefix: 'Her ayın',
    dueDaySuffix: '. günü',
    yearlyDue: 'Yılda bir',
    payNow: 'Şimdi Öde',
    payConfirmTitle: 'Abonelik Ödemesi Yap',
    payConfirmDesc: 'Bu abonelik için bu aya ait ödemeyi harcamalarınıza kaydetmek istiyor musunuz?',
    subSavedSuccess: 'Abonelik başarıyla kaydedildi.',
    incomeSavedSuccess: 'Düzenli gelir başarıyla kaydedildi.',
    subPaidSuccess: 'Abonelik ödemesi harcamalara kaydedildi.',

    // Cards / Installments Screen
    cardsTitle: 'Kartlar & Taksitler',
    cardsSubtitle: 'KREDİ KARTI VE TAKSİT TAKİBİ',
    totalMonthlyInst: 'Aylık Taksit Yükü',
    totalRemainingDebt: 'Kalan Toplam Borç',
    newInstallment: 'Yeni Taksitli Harcama Ekle',
    instTitle: 'Harcama Başlığı',
    instTitlePlaceholder: 'Örn: iPhone 16, Dyson Süpürge',
    selectBank: 'Banka / Kart Seçiniz',
    totalExpenseAmount: 'Toplam Harcama Tutarı',
    totalInstallmentsCount: 'Toplam Taksit Sayısı',
    paidInstallmentsCount: 'Şu Ana Kadar Ödenen Taksit',
    saveInstallment: 'Taksiti Kaydet',
    filterAll: 'Tümü',
    filterActive: 'Devam Edenler',
    filterCompleted: 'Tamamlananlar',
    noInstallments: 'Henüz taksitli harcama kaydınız yok.',
    noInstallmentsSub: 'Yukarıdaki butona tıklayarak yeni bir taksitli harcama ekleyebilirsiniz.',
    deleteInstTitle: 'Taksiti Sil',
    deleteInstDesc: 'Bu taksit kaydını silmek istediğinize emin misiniz?',
    remainingInstallmentLabel: 'Kalan Taksit',
    monthlyPaymentLabel: 'Aylık Tutar',
    installmentOf: 'Taksit',
    completedBadge: 'Bitti',
    instPayConfirmTitle: 'Taksiti Öde',
    instPayConfirmDesc: 'Bu taksiti ödendi olarak işaretleyip harcamalarınıza eklemek istiyor musunuz?',
    instSavedSuccess: 'Taksit başarıyla kaydedildi.',
    instPaidSuccess: 'Taksit ödendi olarak kaydedildi.',

    // Add Transaction Screen
    newTransactionTitle: 'Yeni İşlem',
    expenseType: 'Gider',
    incomeType: 'Gelir',
    enterAmount: 'TUTAR GİRİN',
    descriptionPlaceholder: 'Açıklama (Örn: Market alışverişi)',
    assetNamePlaceholder: 'Varlık Adı (Örn: Gram Altın, Gümüş)',
    purchaseRatePlaceholder: 'Alış Kuru (Örn: 1 Adet = 4180',
    selectCategory: 'Kategori Seçin',
    incomeSourceSelect: 'Gelir Kaynağı',
    customIncomeSourcePlaceholder: 'Veya özel kaynak yazın (Örn: Temettü)',
    saveTransaction: 'İşlemi Kaydet',
    fillAllFields: 'Lütfen gerekli tüm alanları doldurun.',
    invalidAmount: 'Lütfen geçerli bir tutar girin.',
    invalidRate: 'Lütfen geçerli bir kur girin.',
    transactionSaved: 'İşlem Başarıyla Kaydedildi',
    transactionSavedDesc: 'İşleminiz cüzdanınıza eklendi.',

    // Settings Modal
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
    accountSection: 'Hesap & Güvenlik',
    loggedInAs: 'Giriş Yapılan Hesap',
    activeSession: 'Aktif Oturum',
    guestUser: 'Misafir Kullanıcı',
    logoutBtn: 'Hesaptan Çıkış Yap',
    logoutConfirmTitle: 'Çıkış Yapmak İstiyor Musunuz?',
    logoutConfirmDesc: 'Oturumunuz kapatılacak ve giriş ekranına yönlendirileceksiniz.',
    logoutAction: 'Çıkış Yap',

    // Auth Screens (Login & Signup)
    loginWelcomeTitle: 'Tekrar Hoş Geldiniz',
    loginWelcomeSubtitle: 'Varlıklarınızı ve bütçenizi yönetmek için giriş yapın.',
    emailPlaceholder: 'E-posta Adresi',
    passwordPlaceholder: 'Şifre',
    confirmPasswordPlaceholder: 'Şifreyi Onayla',
    loginBtn: 'Giriş Yap',
    signupBtn: 'Kayıt Ol',
    guestBtn: 'Giriş Yapmadan Devam Et (Misafir)',
    noAccountPrompt: 'Hesabınız yok mu?',
    hasAccountPrompt: 'Zaten hesabınız var mı?',
    createAccountTitle: 'Hesap Oluştur',
    createAccountSubtitle: 'Verilerinizi bulutta güvenle eşitlemek için kaydolun.',
    passwordsDoNotMatch: 'Girdiğiniz şifreler birbiriyle eşleşmiyor.',
    passwordMinLength: 'Şifre en az 6 karakter olmalıdır.',
    missingInfo: 'Lütfen tüm alanları doldurun.',
    loginFailed: 'Giriş Başarısız',
    signupFailed: 'Kayıt Başarısız',
    orDivider: 'VEYA',
    accountUpgraded: 'Hesap Yükseltildi',
    accountUpgradedDesc: 'Verileriniz artık kalıcı olarak hesabınıza bağlandı.',
    welcomeNewUser: 'Hoş Geldiniz',
    welcomeNewUserDesc: 'Hesabınız başarıyla oluşturuldu.',
  },

  en: {
    // Navigation & Tabs
    tabHome: 'Wallet',
    tabCharts: 'Charts',
    tabRecurring: 'Loop',
    tabCards: 'Cards',

    // Greetings & Top Bar
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    myPortfolio: 'My Portfolio',

    // Dashboard & Balance Card
    totalBalanceLabel: 'TOTAL BALANCE',
    netPositive: 'Net Positive',
    deficit: 'Deficit',
    income: 'Income',
    expenses: 'Expenses',
    expense: 'Expense',
    recentTransactions: 'Recent Transactions',
    noTransactionsFound: 'No Transactions Found',
    noTransactionsSubtitle: 'Tap the "+" button in the bottom bar to add your first income or expense.',
    allCategories: 'All Categories',
    selectTimeRange: 'Select Time Range',
    filterByCategory: 'Filter by Category',
    deleteConfirmTitle: 'Delete Transaction',
    deleteConfirmDesc: 'Are you sure you want to permanently delete this transaction? This cannot be undone.',
    deleteAction: 'Delete',
    delete: 'Delete',
    cancel: 'Cancel',
    marketTicker: 'MARKETS',
    cryptoTicker: 'CRYPTO',
    marketDataFallback: 'Live market data temporarily unavailable',

    // Analytics / Charts Screen
    analyticsSubtitle: 'FINANCIAL ANALYTICS',
    analyticsTitle: 'Insights',
    spendingBreakdown: 'Spending Breakdown',
    incomeBreakdown: 'Income Breakdown',
    noChartDataExpense: 'No expense data available to display chart.',
    noChartDataIncome: 'No income data available to display chart.',
    topCategories: 'Top Categories',
    aiAdvisorBadge: 'AI FINANCIAL ASSISTANT',
    aiAnalyzeBtn: 'Analyze',
    aiAdvisorDesc: 'Get intelligent insights, anomaly detection, and smart budget advice powered by Google Gemini.',
    analyzing: 'Analyzing...',

    // Loop / Recurring Screen
    loopTitle: 'Loop & Subscriptions',
    loopSubtitle: 'SUBSCRIPTION & RECURRING INCOME',
    tabSubscriptions: 'Subscriptions',
    tabRecurringIncomes: 'Recurring Incomes',
    monthlyTotalCommitment: 'Monthly Commitment',
    monthlyTotalIncome: 'Monthly Recurring Income',
    newSubscription: 'Add New Subscription',
    subName: 'Subscription Name',
    subAmount: 'Payment Amount',
    billingCycle: 'Billing Cycle',
    monthly: 'Monthly',
    yearly: 'Yearly',
    dueDay: 'Due Day',
    paymentMethodBank: 'Payment Method / Bank',
    select: 'Select',
    saveSubscription: 'Save Subscription',
    activeSubscriptions: 'Active Subscriptions',
    noSubscriptions: 'No subscriptions registered yet.',
    noSubscriptionsSub: 'You can add a new subscription from the form above.',
    newRecurringIncome: 'Add Recurring Income',
    incomeSource: 'Income Source (Salary, Rent...)',
    dayOfMonth: 'Day of Month (1-31)',
    saveRecurringIncome: 'Save Recurring Income',
    registeredIncomes: 'Registered Recurring Incomes',
    noIncomes: 'No recurring income registered yet.',
    deleteSubTitle: 'Delete Subscription',
    deleteSubDesc: 'Are you sure you want to delete this subscription?',
    deleteIncomeTitle: 'Delete Recurring Income',
    deleteIncomeDesc: 'Are you sure you want to delete this recurring income?',
    searchBank: 'Search bank...',
    chooseBank: 'Select Bank',
    dueDayPrefix: 'Every month on',
    dueDaySuffix: 'th',
    yearlyDue: 'Yearly',
    payNow: 'Pay Now',
    payConfirmTitle: 'Pay Subscription',
    payConfirmDesc: 'Do you want to record this month\'s payment for this subscription to your expenses?',
    subSavedSuccess: 'Subscription saved successfully.',
    incomeSavedSuccess: 'Recurring income saved successfully.',
    subPaidSuccess: 'Subscription payment recorded to expenses.',

    // Cards / Installments Screen
    cardsTitle: 'Cards & Installments',
    cardsSubtitle: 'CREDIT CARD & INSTALLMENT TRACKING',
    totalMonthlyInst: 'Monthly Installment Load',
    totalRemainingDebt: 'Total Remaining Debt',
    newInstallment: 'Add New Installment',
    instTitle: 'Expense Title',
    instTitlePlaceholder: 'e.g. iPhone 16, Laptop',
    selectBank: 'Select Bank / Card',
    totalExpenseAmount: 'Total Expense Amount',
    totalInstallmentsCount: 'Total Installments',
    paidInstallmentsCount: 'Already Paid Installments',
    saveInstallment: 'Save Installment',
    filterAll: 'All',
    filterActive: 'Active',
    filterCompleted: 'Completed',
    noInstallments: 'No installments recorded yet.',
    noInstallmentsSub: 'Click the button above to add a new installment purchase.',
    deleteInstTitle: 'Delete Installment',
    deleteInstDesc: 'Are you sure you want to delete this installment record?',
    remainingInstallmentLabel: 'Remaining Installments',
    monthlyPaymentLabel: 'Monthly Amount',
    installmentOf: 'Installment',
    completedBadge: 'Completed',
    instPayConfirmTitle: 'Pay Installment',
    instPayConfirmDesc: 'Do you want to mark this installment as paid and add it to your expenses?',
    instSavedSuccess: 'Installment saved successfully.',
    instPaidSuccess: 'Installment marked as paid.',

    // Add Transaction Screen
    newTransactionTitle: 'New Transaction',
    expenseType: 'Expense',
    incomeType: 'Income',
    enterAmount: 'ENTER AMOUNT',
    descriptionPlaceholder: 'Description (e.g. Groceries at Market)',
    assetNamePlaceholder: 'Asset Name (e.g. Gold Gram, Silver)',
    purchaseRatePlaceholder: 'Purchase Rate (e.g. 1 Unit = 4180',
    selectCategory: 'Select Category',
    incomeSourceSelect: 'Income Source',
    customIncomeSourcePlaceholder: 'Or type custom source (e.g. Dividend)',
    saveTransaction: 'Save Transaction',
    fillAllFields: 'Please fill in all required fields.',
    invalidAmount: 'Please enter a valid amount.',
    invalidRate: 'Please enter a valid rate.',
    transactionSaved: 'Transaction Recorded',
    transactionSavedDesc: 'Your transaction was added to your wallet.',

    // Settings Modal
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
    accountSection: 'Account & Security',
    loggedInAs: 'Signed in as',
    activeSession: 'Active Session',
    guestUser: 'Guest User',
    logoutBtn: 'Log Out of Account',
    logoutConfirmTitle: 'Are you sure you want to log out?',
    logoutConfirmDesc: 'Your session will be closed and you will be redirected to the login screen.',
    logoutAction: 'Log Out',

    // Auth Screens (Login & Signup)
    loginWelcomeTitle: 'Welcome Back',
    loginWelcomeSubtitle: 'Log in to access and manage your personal wealth.',
    emailPlaceholder: 'Email Address',
    passwordPlaceholder: 'Password',
    confirmPasswordPlaceholder: 'Confirm Password',
    loginBtn: 'Log In',
    signupBtn: 'Sign Up',
    guestBtn: 'Continue as Guest',
    noAccountPrompt: "Don't have an account?",
    hasAccountPrompt: 'Already have an account?',
    createAccountTitle: 'Create Account',
    createAccountSubtitle: 'Sign up to keep your data securely synced in the cloud.',
    passwordsDoNotMatch: 'The passwords you entered do not match.',
    passwordMinLength: 'Password must be at least 6 characters.',
    missingInfo: 'Please fill in all fields.',
    loginFailed: 'Login Failed',
    signupFailed: 'Sign Up Failed',
    orDivider: 'OR',
    accountUpgraded: 'Account Upgraded',
    accountUpgradedDesc: 'Your data is now permanently synced to your account.',
    welcomeNewUser: 'Welcome',
    welcomeNewUserDesc: 'Account created successfully.',
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
  tintSoft: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  warning: string;
  warningSoft: string;
  shadow: any;
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
  tintSoft: 'rgba(57, 255, 20, 0.12)',
  income: '#34C759',
  incomeSoft: 'rgba(52, 199, 89, 0.14)',
  expense: '#FF3B30',
  expenseSoft: 'rgba(255, 59, 48, 0.14)',
  warning: '#FF9F0A',
  warningSoft: 'rgba(255, 159, 10, 0.15)',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
};

const lightColors: ThemeColors = {
  background: '#F8F9FC',
  card: '#FFFFFF',
  cardSecondary: '#F1F3F9',
  cardElevated: '#E8ECF4',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.05)',
  tint: '#059669',
  tintSoft: 'rgba(5, 150, 105, 0.12)',
  income: '#10B981',
  incomeSoft: 'rgba(16, 185, 129, 0.12)',
  expense: '#EF4444',
  expenseSoft: 'rgba(239, 68, 68, 0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
  shadow: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
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
