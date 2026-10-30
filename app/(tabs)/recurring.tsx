import React, { ComponentProps, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';

import { db } from '@/firebaseConfig';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { useSettings, ThemeColors } from '@/context/SettingsContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SwipeableModal } from '@/components/SwipeableModal';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';

export interface RecurringIncome {
  id: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  dayOfMonth: number;
}

export interface Installment {
  id: string;
  title: string;
  bank: string;
  totalAmount: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  dueDay: number;
  lastCharged?: any;
  createdAt?: any;
  completed: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  billingCycle: 'monthly' | 'yearly';
  dueDay: number;
  bank?: string;
  category?: string;
  iconName?: string;
  color?: string;
  isActive: boolean;
  lastCharged?: any;
  createdAt?: any;
}

export interface PresetSubscription {
  name: string;
  category: string;
  defaultCurrency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
}

export const PRESET_SUBSCRIPTIONS: PresetSubscription[] = [
  { name: 'Netflix', category: 'Dizi / Film', defaultCurrency: 'TRY', icon: 'film-outline', color: '#E50914' },
  { name: 'Spotify', category: 'Müzik', defaultCurrency: 'TRY', icon: 'musical-notes-outline', color: '#1DB954' },
  { name: 'YouTube Premium', category: 'Video / Müzik', defaultCurrency: 'TRY', icon: 'play-outline', color: '#FF0000' },
  { name: 'ChatGPT Plus', category: 'Yapay Zeka', defaultCurrency: 'USD', icon: 'hardware-chip-outline', color: '#10A37F' },
  { name: 'iCloud+', category: 'Bulut Depolama', defaultCurrency: 'TRY', icon: 'cloud-outline', color: '#007AFF' },
  { name: 'Disney+', category: 'Dizi / Film', defaultCurrency: 'TRY', icon: 'tv-outline', color: '#113CCF' },
  { name: 'Amazon Prime', category: 'Alışveriş / Dizi', defaultCurrency: 'TRY', icon: 'cart-outline', color: '#00A8E1' },
  { name: 'BluTV', category: 'Dizi / Film', defaultCurrency: 'TRY', icon: 'videocam-outline', color: '#00D2D3' },
  { name: 'Gain', category: 'Dizi / Film', defaultCurrency: 'TRY', icon: 'film-outline', color: '#D92546' },
  { name: 'Apple Music', category: 'Müzik', defaultCurrency: 'TRY', icon: 'disc-outline', color: '#FA243C' },
  { name: 'Google One', category: 'Bulut Depolama', defaultCurrency: 'TRY', icon: 'cloud-upload-outline', color: '#4285F4' },
  { name: 'Claude Pro', category: 'Yapay Zeka', defaultCurrency: 'USD', icon: 'sparkles-outline', color: '#D97706' },
  { name: 'Midjourney', category: 'Yapay Zeka', defaultCurrency: 'USD', icon: 'color-palette-outline', color: '#6366F1' },
  { name: 'GitHub Copilot', category: 'Yazılım', defaultCurrency: 'USD', icon: 'code-slash-outline', color: '#8957E5' },
  { name: 'PlayStation Plus', category: 'Oyun', defaultCurrency: 'TRY', icon: 'game-controller-outline', color: '#00439C' },
  { name: 'Xbox Game Pass', category: 'Oyun', defaultCurrency: 'TRY', icon: 'game-controller-outline', color: '#107C10' },
  { name: 'Spor Salonu (Gym)', category: 'Sağlık & Spor', defaultCurrency: 'TRY', icon: 'fitness-outline', color: '#10B981' },
  { name: 'Özel / Diğer', category: 'Genel', defaultCurrency: 'TRY', icon: 'apps-outline', color: '#39FF14' },
];

const COMMON_BANKS = [
  'Garanti BBVA',
  'İş Bankası',
  'Yapı Kredi',
  'Akbank',
  'Enpara',
  'QNB',
  'Ziraat',
  'VakıfBank',
];

const ALL_BANKS = [
  'Akbank',
  'Albaraka Türk',
  'Alternatif Bank',
  'Anadolubank',
  'Burgan Bank',
  'CEPTETEB',
  'DenizBank',
  'Enpara.com',
  'Fibabanka',
  'Garanti BBVA',
  'Halkbank',
  'Hayat Finans',
  'HSBC',
  'ICBC Turkey',
  'ING',
  'İş Bankası',
  'Kuveyt Türk',
  'Odeabank',
  'Papara',
  'Paycell',
  'QNB',
  'Şekerbank',
  'TEB (Türk Ekonomi Bankası)',
  'TOM Bank / Hadi',
  'Türkiye Finans',
  'VakıfBank',
  'Vakıf Katılım',
  'Yapı Kredi',
  'Ziraat Bankası',
  'Ziraat Katılım',
  'Diğer',
];

const QUICK_INSTALLMENTS = ['3', '6', '9', '12'];

export default function RecurringScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useSettings();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Active Segment Tab
  const [activeTab, setActiveTab] = useState<'installment' | 'subscription' | 'income'>('installment');

  // --- Subscriptions State ---
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isSubFormExpanded, setIsSubFormExpanded] = useState(true);
  const [subName, setSubName] = useState('Netflix');
  const [subAmount, setSubAmount] = useState('');
  const [subCurrency, setSubCurrency] = useState<Currency>(defaultCurrency);
  const [subBillingCycle, setSubBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subDueDay, setSubDueDay] = useState('');
  const [subBank, setSubBank] = useState('');
  const [subCategory, setSubCategory] = useState('Dizi / Film');
  const [subIcon, setSubIcon] = useState<ComponentProps<typeof Ionicons>['name']>('film-outline');
  const [subColor, setSubColor] = useState('#E50914');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('Netflix');
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);
  const [subToPay, setSubToPay] = useState<Subscription | null>(null);

  // --- Recurring Incomes State ---
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [incomeCurrency, setIncomeCurrency] = useState<Currency>(defaultCurrency);

  // --- Installments State ---
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [instTitle, setInstTitle] = useState('');
  const [instBank, setInstBank] = useState('');
  const [instTotalAmount, setInstTotalAmount] = useState('');
  const [instTotalCount, setInstTotalCount] = useState('6');
  const [instPaidCount, setInstPaidCount] = useState('0');
  const [instDueDay, setInstDueDay] = useState('');
  const [instCurrency, setInstCurrency] = useState<Currency>(defaultCurrency);
  const [isBankModalVisible, setBankModalVisible] = useState(false);
  const [bankModalTarget, setBankModalTarget] = useState<'installment' | 'subscription'>('installment');
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) return ALL_BANKS;
    const q = bankSearchQuery.toLowerCase().trim();
    return ALL_BANKS.filter((b) => b.toLowerCase().includes(q));
  }, [bankSearchQuery]);

  // Subscribe to Recurring Incomes
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'recurringIncomes'), (snapshot) => {
      const incomes: RecurringIncome[] = [];
      snapshot.forEach((doc) => {
        incomes.push({ id: doc.id, ...doc.data() } as RecurringIncome);
      });
      setRecurringIncomes(incomes);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to Installments
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'installments'), (snapshot) => {
      const list: Installment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Installment);
      });
      // Sort: active first, then by dueDay
      list.sort((a, b) => {
        if (a.completed === b.completed) {
          return (a.dueDay || 0) - (b.dueDay || 0);
        }
        return a.completed ? 1 : -1;
      });
      setInstallments(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to Subscriptions
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'subscriptions'), (snapshot) => {
      const list: Subscription[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Subscription);
      });
      list.sort((a, b) => {
        if (a.isActive === b.isActive) {
          return (a.dueDay || 0) - (b.dueDay || 0);
        }
        return a.isActive ? -1 : 1;
      });
      setSubscriptions(list);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Calculations for Subscriptions ---
  const activeSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => s.isActive !== false);
  }, [subscriptions]);

  const subMonthlyTotalTRY = useMemo(() => {
    return activeSubscriptions.reduce((sum, item) => {
      const monthly = item.billingCycle === 'yearly' ? item.amount / 12 : item.amount;
      if (item.currency === 'TRY' || !item.currency) {
        return sum + monthly;
      }
      return sum;
    }, 0);
  }, [activeSubscriptions]);

  const foreignSubSummary = useMemo(() => {
    const map: Record<string, number> = {};
    activeSubscriptions.forEach((item) => {
      if (item.currency && item.currency !== 'TRY') {
        const monthly = item.billingCycle === 'yearly' ? item.amount / 12 : item.amount;
        map[item.currency] = (map[item.currency] || 0) + monthly;
      }
    });
    const entries = Object.entries(map);
    if (entries.length === 0) return '';
    return entries.map(([curr, amt]) => {
      const sym = currencies.find((c) => c.code === curr)?.symbol || curr;
      return `+ ${sym}${amt.toFixed(0)}/ay`;
    }).join(' ');
  }, [activeSubscriptions]);

  // --- Calculations for Installments ---
  const parsedTotal = parseFloat(instTotalAmount.replace(',', '.')) || 0;
  const parsedCount = parseInt(instTotalCount, 10) || 1;
  const parsedPaid = parseInt(instPaidCount, 10) || 0;
  const liveMonthly = parsedCount > 0 ? parsedTotal / parsedCount : 0;
  const liveRemainingCount = Math.max(0, parsedCount - parsedPaid);
  const liveRemainingDebt = liveMonthly * liveRemainingCount;

  const activeInstallments = useMemo(() => {
    return installments.filter((item) => !item.completed && (item.remainingInstallments == null || item.remainingInstallments > 0));
  }, [installments]);

  const totalMonthlyCommitment = useMemo(() => {
    return activeInstallments.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
  }, [activeInstallments]);

  const totalRemainingDebt = useMemo(() => {
    return activeInstallments.reduce((sum, item) => {
      const remaining = item.remainingInstallments ?? Math.max(0, item.totalInstallments - (item.paidInstallments || 0));
      return sum + (item.monthlyAmount || 0) * remaining;
    }, 0);
  }, [activeInstallments]);

  // --- Handlers: Subscriptions ---
  const handleSelectPreset = (preset: PresetSubscription) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedPreset(preset.name);
    setSubName(preset.name === 'Özel / Diğer' ? '' : preset.name);
    setSubCategory(preset.category);
    setSubIcon(preset.icon);
    setSubColor(preset.color);
    const matchingCurr = currencies.find((c) => c.code === preset.defaultCurrency) || defaultCurrency;
    setSubCurrency(matchingCurr);
  };

  const handleAddSubscription = async () => {
    const trimmedName = subName.trim();
    const numericAmount = parseFloat(subAmount.replace(',', '.'));
    const numericDueDay = parseInt(subDueDay, 10);

    if (!trimmedName) {
      Toast.show({
        type: 'error',
        text1: 'Eksik Bilgi',
        text2: 'Lütfen servis veya platform adını girin.',
      });
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Tutar',
        text2: 'Lütfen geçerli bir abonelik tutarı girin.',
      });
      return;
    }

    if (isNaN(numericDueDay) || numericDueDay < 1 || numericDueDay > 31) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Çekilme Günü',
        text2: 'Lütfen 1 ile 31 arasında bir ödeme günü girin.',
      });
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const today = new Date();
      const isDueToday = numericDueDay === today.getDate();

      await addDoc(collection(db, 'users', user.uid, 'subscriptions'), {
        name: trimmedName,
        amount: numericAmount,
        currency: subCurrency.code,
        billingCycle: subBillingCycle,
        dueDay: numericDueDay,
        bank: subBank || 'Belirtilmedi',
        category: subCategory || 'Abonelik',
        iconName: subIcon || 'play-circle-outline',
        color: subColor || Colors.tint,
        isActive: true,
        createdAt: Timestamp.now(),
        lastCharged: isDueToday ? Timestamp.now() : null,
      });

      if (isDueToday) {
        await addDoc(collection(db, 'users', user.uid, 'transactions'), {
          amount: -Math.abs(numericAmount),
          category: 'Subscriptions',
          currency: subCurrency.code,
          description: `${trimmedName} (Abonelik Ödemesi)`,
          type: 'expense',
          date: Timestamp.now(),
        });
      }

      Toast.show({
        type: 'success',
        text1: isDueToday ? 'Abonelik Kaydedildi & İşlendi 🎉' : 'Abonelik Kaydedildi',
        text2: isDueToday
          ? `${trimmedName} bugün ödeme günü (${today.getDate()}) olduğu için ana sayfadaki harcamalara da eklendi.`
          : `${trimmedName} (${subCurrency.symbol}${numericAmount}) başarıyla eklendi.`,
      });

      setSubName('');
      setSubAmount('');
      setSubDueDay('');
      setSubBank('');
      setSelectedPreset(null);
    } catch (err) {
      console.error('Error adding subscription:', err);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Abonelik kaydedilemedi.',
      });
    }
  };

  const handleToggleSubStatus = async (item: Subscription) => {
    try {
      if (!user) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const nextActive = !item.isActive;
      await updateDoc(doc(db, 'users', user.uid, 'subscriptions', item.id), {
        isActive: nextActive,
      });
      Toast.show({
        type: 'info',
        text1: nextActive ? 'Abonelik Aktif Edildi' : 'Abonelik Duraklatıldı',
        text2: `${item.name} ${nextActive ? 'aktif giderlerinize eklendi.' : 'duraklatıldı, toplamlara katılmayacak.'}`,
      });
    } catch (err) {
      console.error('Error toggling subscription:', err);
    }
  };

  const handleConfirmPaySub = async () => {
    if (!subToPay || !user) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const currSymbol = currencies.find((c) => c.code === subToPay.currency)?.symbol || subToPay.currency;

      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount: -Math.abs(subToPay.amount),
        category: 'Subscriptions',
        currency: subToPay.currency || 'TRY',
        description: `${subToPay.name} (Abonelik Ödemesi)`,
        type: 'expense',
        date: Timestamp.now(),
      });

      await updateDoc(doc(db, 'users', user.uid, 'subscriptions', subToPay.id), {
        lastCharged: Timestamp.now(),
      });

      const name = subToPay.name;
      const amt = subToPay.amount;
      setSubToPay(null);

      Toast.show({
        type: 'success',
        text1: 'Ödeme Harcamalara Eklendi',
        text2: `${name} (${currSymbol}${amt}) bakiyenizden düşüldü.`,
      });
    } catch (err) {
      console.error('Error paying subscription:', err);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Abonelik ödemesi işlenemedi.',
      });
    }
  };

  const handleConfirmDeleteSub = async () => {
    if (!subToDelete || !user) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      const name = subToDelete.name;
      await deleteDoc(doc(db, 'users', user.uid, 'subscriptions', subToDelete.id));
      setSubToDelete(null);
      Toast.show({
        type: 'success',
        text1: 'Abonelik Silindi',
        text2: `${name} aboneliğiniz kaldırıldı.`,
      });
    } catch (err) {
      console.error('Error deleting subscription:', err);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Abonelik silinemedi.',
      });
    }
  };

  // --- Handlers: Recurring Income ---
  const handleAddRecurringIncome = async () => {
    const numericAmount = parseFloat(amount.replace(',', '.'));
    const numericDay = parseInt(dayOfMonth, 10);

    if (!category.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Eksik Bilgi',
        text2: 'Lütfen düzenli gelir kaynağını girin (örn. Maaş, Kira).',
      });
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Tutar',
        text2: 'Lütfen geçerli bir gelir tutarı girin.',
      });
      return;
    }

    if (isNaN(numericDay) || numericDay < 1 || numericDay > 31) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Yatış Günü',
        text2: 'Lütfen 1 ile 31 arasında bir ödeme günü girin.',
      });
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      await addDoc(collection(db, 'users', user.uid, 'recurringIncomes'), {
        amount: numericAmount,
        category: category.trim(),
        currency: incomeCurrency.code,
        dayOfMonth: numericDay,
        lastAdded: null,
      });

      setAmount('');
      setCategory('');
      setDayOfMonth('');
      setIncomeCurrency(defaultCurrency);

      Toast.show({
        type: 'success',
        text1: 'Düzenli Gelir Kaydedildi 🎉',
        text2: `${category.trim()} geliri her ayın ${numericDay}. günü için tanımlandı.`,
      });
    } catch (error) {
      console.error('Error adding recurring income: ', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Düzenli gelir kaydedilemedi.',
      });
    }
  };

  const handleDeleteIncome = async (id: string) => {
    Alert.alert('Gelir Akışını Sil', 'Bu düzenli geliri kaldırmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!user) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await deleteDoc(doc(db, 'users', user.uid, 'recurringIncomes', id));
          } catch (error) {
            console.error('Error deleting recurring income: ', error);
            Toast.show({
              type: 'error',
              text1: 'Hata',
              text2: 'Gelir silinemedi.',
            });
          }
        },
      },
    ]);
  };

  // --- Handlers: Installments ---
  const handleAddInstallment = async () => {
    const numericTotal = parseFloat(instTotalAmount.replace(',', '.'));
    const numericCount = parseInt(instTotalCount, 10);
    const numericPaid = parseInt(instPaidCount, 10) || 0;
    const numericDueDay = parseInt(instDueDay, 10);

    if (!instTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Eksik Bilgi',
        text2: 'Lütfen harcama veya ürün adını girin (örn. iPhone 15, Dyson).',
      });
      return;
    }
    if (!instBank.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Eksik Bilgi',
        text2: 'Lütfen kartın ait olduğu bankayı seçin veya girin.',
      });
      return;
    }
    if (isNaN(numericTotal) || numericTotal <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Tutar',
        text2: 'Lütfen geçerli bir toplam taksit tutarı girin.',
      });
      return;
    }
    if (isNaN(numericCount) || numericCount < 1) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Taksit',
        text2: 'Taksit sayısı en az 1 olmalıdır.',
      });
      return;
    }
    if (numericPaid >= numericCount) {
      Toast.show({
        type: 'error',
        text1: 'Hatalı Taksit Sayısı',
        text2: 'Ödenmiş taksit sayısı toplam taksit sayısından küçük olmalıdır.',
      });
      return;
    }
    if (isNaN(numericDueDay) || numericDueDay < 1 || numericDueDay > 31) {
      Toast.show({
        type: 'error',
        text1: 'Geçersiz Son Ödeme Günü',
        text2: 'Lütfen 1 ile 31 arasında bir gün girin.',
      });
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const monthlyAmount = Number((numericTotal / numericCount).toFixed(2));
      const remainingInstallments = numericCount - numericPaid;

      await addDoc(collection(db, 'users', user.uid, 'installments'), {
        title: instTitle.trim(),
        bank: instBank.trim(),
        totalAmount: numericTotal,
        monthlyAmount,
        totalInstallments: numericCount,
        paidInstallments: numericPaid,
        remainingInstallments,
        currency: instCurrency.code,
        dueDay: numericDueDay,
        lastCharged: null,
        createdAt: Timestamp.now(),
        completed: remainingInstallments <= 0,
      });

      setInstTitle('');
      setInstBank('');
      setInstTotalAmount('');
      setInstTotalCount('6');
      setInstPaidCount('0');
      setInstDueDay('');
      setInstCurrency(defaultCurrency);
      setIsFormExpanded(false);

      Toast.show({
        type: 'success',
        text1: 'Taksit Kaydedildi 🎉',
        text2: `Aylık ${instCurrency.symbol}${monthlyAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki taksitiniz her ayın ${numericDueDay}. günü için tanımlandı.`,
      });
    } catch (error) {
      console.error('Error adding installment:', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Taksit kaydedilirken bir hata oluştu.',
      });
    }
  };

  const handlePayInstallment = (item: Installment) => {
    const currencySymbol = currencies.find((c) => c.code === item.currency)?.symbol || '₺';
    const nextPaid = (item.paidInstallments || 0) + 1;
    const nextRemaining = (item.remainingInstallments ?? item.totalInstallments) - 1;

    Alert.alert(
      'Taksit Ödemesi Yap',
      `${item.bank} - ${item.title} için ${currencySymbol}${item.monthlyAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki ${nextPaid}/${item.totalInstallments}. taksit işlemini şimdi kaydedip bakiyeden düşmek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Öde ve Düş',
          style: 'default',
          onPress: async () => {
            try {
              if (!user) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

              await addDoc(collection(db, 'users', user.uid, 'transactions'), {
                amount: -Math.abs(item.monthlyAmount),
                category: 'Debt',
                currency: item.currency || 'TRY',
                description: `${item.bank || 'Banka'} - ${item.title} (${nextPaid}/${item.totalInstallments}. Taksit)`,
                type: 'expense',
                date: Timestamp.now(),
              });

              await updateDoc(doc(db, 'users', user.uid, 'installments', item.id), {
                paidInstallments: nextPaid,
                remainingInstallments: Math.max(0, nextRemaining),
                completed: nextRemaining <= 0,
                lastCharged: Timestamp.now(),
              });
            } catch (err) {
              console.error('Error paying installment:', err);
              Alert.alert('Hata', 'Taksit ödemesi kaydedilemedi.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteInstallment = (id: string, title: string) => {
    Alert.alert(
      'Taksiti Kaldır',
      `"${title}" taksit planını kaldırmak istediğinize emin misiniz? (Daha önce yapılmış harcama kayıtlarınız silinmez.)`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await deleteDoc(doc(db, 'users', user.uid, 'installments', id));
            } catch (error) {
              console.error('Error deleting installment:', error);
              Alert.alert('Hata', 'Taksit silinemedi.');
            }
          },
        },
      ]
    );
  };

  const formatNumberInput = (text: string, setter: (val: string) => void) => {
    if (text.length > 12) return;
    const numericRegex = /^\d*([.,]\d{0,2})?$/;
    if (numericRegex.test(text) || text === '') {
      setter(text);
    }
  };

  const handleDayInput = (text: string, setter: (val: string) => void) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) {
      setter('');
      return;
    }
    const num = parseInt(digits, 10);
    if (num > 31) {
      setter('31');
    } else if (digits === '0') {
      setter('');
    } else {
      setter(num.toString());
    }
  };

  const handleDayBlur = (val: string, setter: (val: string) => void) => {
    if (!val) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      setter('1');
    } else if (num > 31) {
      setter('31');
    } else {
      setter(num.toString());
    }
  };

  const handleTotalCountInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) {
      setInstTotalCount('');
      return;
    }
    const num = parseInt(digits, 10);
    if (num > 60) {
      setInstTotalCount('60');
    } else if (digits === '0') {
      setInstTotalCount('');
    } else {
      setInstTotalCount(num.toString());
    }
  };

  const handlePaidCountInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) {
      setInstPaidCount('');
      return;
    }
    const num = parseInt(digits, 10);
    const total = parseInt(instTotalCount, 10);
    if (!isNaN(total) && total > 1 && num >= total) {
      setInstPaidCount((total - 1).toString());
    } else if (num > 60) {
      setInstPaidCount('59');
    } else {
      setInstPaidCount(num.toString());
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}>
        
        {/* Screen Header */}
        <View style={styles.screenHeader}>
          <ThemedText style={styles.screenSubtitle}>OTOMATİK VE DÜZENLİ İŞLEMLER</ThemedText>
          <ThemedText style={styles.screenTitle}>Düzenli & Taksitler</ThemedText>
        </View>

        {/* Segment Switcher */}
        <View style={styles.segmentContainer}>
          <AnimatedPressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('installment');
            }}
            style={[styles.segmentButton, activeTab === 'installment' && styles.segmentButtonActive]}>
            <Ionicons
              name="card-outline"
              size={15}
              color={activeTab === 'installment' ? Colors.tint : '#8E8E93'}
              style={{ marginRight: 5 }}
            />
            <ThemedText style={[styles.segmentText, activeTab === 'installment' && styles.segmentTextActive]}>
              Taksitler
            </ThemedText>
            <View style={[styles.segmentBadge, activeTab === 'installment' && styles.segmentBadgeActive]}>
              <ThemedText style={[styles.segmentBadgeText, activeTab === 'installment' && styles.segmentBadgeTextActive]}>
                {activeInstallments.length}
              </ThemedText>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('subscription');
            }}
            style={[styles.segmentButton, activeTab === 'subscription' && styles.segmentButtonActive]}>
            <Ionicons
              name="play-circle-outline"
              size={15}
              color={activeTab === 'subscription' ? Colors.tint : '#8E8E93'}
              style={{ marginRight: 5 }}
            />
            <ThemedText style={[styles.segmentText, activeTab === 'subscription' && styles.segmentTextActive]}>
              Abonelikler
            </ThemedText>
            <View style={[styles.segmentBadge, activeTab === 'subscription' && styles.segmentBadgeActive]}>
              <ThemedText style={[styles.segmentBadgeText, activeTab === 'subscription' && styles.segmentBadgeTextActive]}>
                {activeSubscriptions.length}
              </ThemedText>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('income');
            }}
            style={[styles.segmentButton, activeTab === 'income' && styles.segmentButtonActive]}>
            <Ionicons
              name="trending-up-outline"
              size={15}
              color={activeTab === 'income' ? Colors.income : '#8E8E93'}
              style={{ marginRight: 5 }}
            />
            <ThemedText style={[styles.segmentText, activeTab === 'income' && styles.segmentTextActive]}>
              Gelirler
            </ThemedText>
            <View style={[styles.segmentBadge, activeTab === 'income' && styles.segmentBadgeActive]}>
              <ThemedText style={[styles.segmentBadgeText, activeTab === 'income' && styles.segmentBadgeTextActive]}>
                {recurringIncomes.length}
              </ThemedText>
            </View>
          </AnimatedPressable>
        </View>

        {/* ================= INSTALLMENTS TAB ================= */}
        {activeTab === 'installment' && (
          <>
            {/* KPI Dashboard Banner */}
            <View style={styles.kpiContainer}>
              <View style={styles.kpiCard}>
                <ThemedText style={styles.kpiLabel}>AYLIK TAKSİT YÜKÜ</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: '#FF453A' }]}>
                  -₺{totalMonthlyCommitment.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <ThemedText style={styles.kpiSub}>Her ay otomatik düşer</ThemedText>
              </View>

              <View style={styles.kpiCard}>
                <ThemedText style={styles.kpiLabel}>KALAN TOPLAM BORÇ</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: '#FF9F0A' }]}>
                  ₺{totalRemainingDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <ThemedText style={styles.kpiSub}>{activeInstallments.length} aktif kart harcaması</ThemedText>
              </View>
            </View>

            {/* Toggle Form Header / Button */}
            <View style={styles.formToggleRow}>
              <View style={styles.formCardTitleRow}>
                <Ionicons name="add-circle" size={18} color={Colors.tint} />
                <ThemedText style={styles.formCardTitle}>Yeni Taksit Tanımla</ThemedText>
              </View>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsFormExpanded(!isFormExpanded);
                }}
                style={styles.toggleCollapseBtn}>
                <ThemedText style={styles.toggleCollapseText}>
                  {isFormExpanded ? 'Gizle' : '+ Formu Aç'}
                </ThemedText>
                <Ionicons
                  name={isFormExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.tint}
                />
              </AnimatedPressable>
            </View>

            {/* Collapsible Installment Form */}
            {isFormExpanded && (
              <View style={styles.formCard}>
                {/* Product / Expense Title */}
                <ThemedText style={styles.inputLabel}>HARCAMA / ÜRÜN ADI</ThemedText>
                <View style={styles.inputWrap}>
                  <Ionicons name="cart-outline" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Örn: iPhone 15 Pro, Dyson, Uçak Bileti"
                    value={instTitle}
                    onChangeText={setInstTitle}
                    style={styles.textInput}
                    maxLength={50}
                    placeholderTextColor="#636366"
                  />
                </View>

                {/* Bank Selection - Modal Selector */}
                <ThemedText style={styles.inputLabel}>BANKA / KREDİ KARTI</ThemedText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.bankSelectorButton, instBank ? styles.bankSelectorButtonActive : null]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setBankSearchQuery('');
                    setBankModalVisible(true);
                  }}>
                  <View style={styles.bankSelectorLeft}>
                    <View style={[styles.bankIconCircle, instBank ? styles.bankIconCircleActive : null]}>
                      <Ionicons
                        name="card-outline"
                        size={18}
                        color={instBank ? Colors.tint : '#8E8E93'}
                      />
                    </View>
                    <ThemedText style={[styles.bankSelectorText, instBank ? styles.bankSelectorTextActive : null]}>
                      {instBank || 'Banka veya Kredi Kartı Seçin'}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-down" size={17} color={instBank ? Colors.tint : '#8E8E93'} />
                </TouchableOpacity>

                {/* Quick Bank Chips */}
                <View style={styles.chipRow}>
                  {COMMON_BANKS.map((b) => {
                    const isSelected = instBank === b;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        key={b}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setInstBank(b);
                        }}
                        style={[styles.chip, isSelected && styles.chipActive]}>
                        <ThemedText style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {b}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Currency Selector */}
                <ThemedText style={styles.inputLabel}>PARA BİRİMİ</ThemedText>
                <View style={styles.currencyGroup}>
                  {currencies.map((c) => {
                    const isActive = instCurrency.code === c.code;
                    return (
                      <AnimatedPressable
                        key={c.code}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setInstCurrency(c);
                        }}
                        style={[styles.currencyPill, isActive && styles.currencyPillActive]}>
                        <ThemedText style={[styles.currencyPillText, isActive && styles.currencyPillTextActive]}>
                          {c.label} ({c.symbol})
                        </ThemedText>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Total Amount & Total Installments */}
                <View style={styles.inputsRow}>
                  <View style={[styles.inputGroupCol, { flex: 1.3 }]}>
                    <ThemedText style={styles.inputLabel}>TOPLAM TUTAR</ThemedText>
                    <View style={styles.inputWrap}>
                      <ThemedText style={styles.inputPrefix}>{instCurrency.symbol}</ThemedText>
                      <TextInput
                        placeholder="Örn: 36000"
                        value={instTotalAmount}
                        onChangeText={(t) => formatNumberInput(t, setInstTotalAmount)}
                        style={styles.textInput}
                        keyboardType="numeric"
                        maxLength={12}
                        placeholderTextColor="#636366"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroupCol, { flex: 1 }]}>
                    <ThemedText style={styles.inputLabel}>TAKSİT SAYISI</ThemedText>
                    <View style={styles.inputWrap}>
                      <Ionicons name="repeat-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Örn: 6"
                        value={instTotalCount}
                        onChangeText={handleTotalCountInput}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholderTextColor="#636366"
                      />
                    </View>
                  </View>
                </View>

                {/* Quick Installment Chips */}
                <View style={styles.chipRow}>
                  {QUICK_INSTALLMENTS.map((count) => {
                    const isSelected = instTotalCount === count;
                    return (
                      <AnimatedPressable
                        key={count}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setInstTotalCount(count);
                        }}
                        style={[styles.chip, isSelected && styles.chipActive]}>
                        <ThemedText style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {count} Taksit
                        </ThemedText>
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Paid so far & Due Day */}
                <View style={styles.inputsRow}>
                  <View style={[styles.inputGroupCol, { flex: 1 }]}>
                    <ThemedText style={styles.inputLabel}>ÖDENEN TAKSİT</ThemedText>
                    <View style={styles.inputWrap}>
                      <Ionicons name="checkmark-done-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        placeholder="0"
                        value={instPaidCount}
                        onChangeText={handlePaidCountInput}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholderTextColor="#636366"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroupCol, { flex: 1.2 }]}>
                    <ThemedText style={styles.inputLabel}>SON ÖDEME GÜNÜ</ThemedText>
                    <View style={styles.inputWrap}>
                      <Ionicons name="calendar-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
                      <TextInput
                        placeholder="Gün (1-31)"
                        value={instDueDay}
                        onChangeText={(t) => handleDayInput(t, setInstDueDay)}
                        onBlur={() => handleDayBlur(instDueDay, setInstDueDay)}
                        style={styles.textInput}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholderTextColor="#636366"
                      />
                    </View>
                  </View>
                </View>

                {/* Live Preview Calculation */}
                {parsedTotal > 0 && (
                  <View style={styles.liveCalculationBox}>
                    <View style={styles.calcRow}>
                      <ThemedText style={styles.calcLabel}>Aylık Ödeme:</ThemedText>
                      <ThemedText style={styles.calcValue}>
                        {instCurrency.symbol}
                        {liveMonthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ay
                      </ThemedText>
                    </View>
                    <View style={styles.calcRow}>
                      <ThemedText style={styles.calcLabel}>Kalan Süre / Borç:</ThemedText>
                      <ThemedText style={styles.calcValueSub}>
                        {liveRemainingCount} ay • {instCurrency.symbol}
                        {liveRemainingDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {/* Add Installment Button */}
                <AnimatedPressable style={styles.addButton} onPress={handleAddInstallment}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                  <ThemedText style={styles.addButtonText}>Taksit Planını Başlat</ThemedText>
                </AnimatedPressable>
              </View>
            )}

            {/* Section Title */}
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Mevcut Taksitler & Kartlar</ThemedText>
              <View style={styles.countBadge}>
                <ThemedText style={styles.countBadgeText}>{installments.length}</ThemedText>
              </View>
            </View>

            {/* Installments List */}
            {installments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="card-outline" size={32} color="#555" />
                </View>
                <ThemedText style={styles.emptyTitle}>Henüz Taksit Kaydı Yok</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Kredi kartı taksitlerinizi ekleyin; her ay son ödeme gününde taksit tutarı otomatik olarak bakiyenizden düşülsün.
                </ThemedText>
              </View>
            ) : (
              installments.map((item) => {
                const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency || '₺' };
                const paid = item.paidInstallments || 0;
                const total = item.totalInstallments || 1;
                const remaining = item.remainingInstallments ?? Math.max(0, total - paid);
                const remainingDebt = item.monthlyAmount * remaining;
                const progress = Math.min(1, Math.max(0, paid / total));
                const progressPercent = Math.round(progress * 100);

                return (
                  <View key={item.id} style={[styles.installmentCard, item.completed && styles.installmentCardCompleted]}>
                    {/* Header row: Bank & Status */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.bankPill}>
                        <Ionicons name="card-outline" size={13} color={Colors.tint} style={{ marginRight: 5 }} />
                        <ThemedText style={styles.bankPillText}>{item.bank || 'Banka'}</ThemedText>
                      </View>

                      <View style={styles.headerRightBadges}>
                        <View style={styles.dueDayPill}>
                          <Ionicons name="calendar-outline" size={12} color="#8E8E93" style={{ marginRight: 4 }} />
                          <ThemedText style={styles.dueDayPillText}>Ayın {item.dueDay}. günü</ThemedText>
                        </View>

                        {item.completed ? (
                          <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-done" size={12} color="#4CAF50" style={{ marginRight: 4 }} />
                            <ThemedText style={styles.completedBadgeText}>Bitti</ThemedText>
                          </View>
                        ) : (
                          <View style={styles.activeBadge}>
                            <ThemedText style={styles.activeBadgeText}>{remaining} Taksit Kaldı</ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Title & Monthly Amount Row */}
                    <View style={styles.cardMainRow}>
                      <View style={styles.cardTitleCol}>
                        <ThemedText style={styles.installmentTitle} numberOfLines={2}>
                          {item.title}
                        </ThemedText>
                        <ThemedText style={styles.installmentSub}>
                          Toplam: {itemCurrency.symbol}
                          {item.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </ThemedText>
                      </View>

                      <View style={styles.cardAmountCol}>
                        <ThemedText style={styles.installmentMonthlyAmount}>
                          -{itemCurrency.symbol}
                          {item.monthlyAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </ThemedText>
                        <ThemedText style={styles.installmentPerMonth}>/ her ay</ThemedText>
                      </View>
                    </View>

                    {/* Progress Bar Container */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${progressPercent}%`,
                              backgroundColor: item.completed ? '#4CAF50' : Colors.tint,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.progressTextRow}>
                        <ThemedText style={styles.progressText}>
                          {paid} / {total} Taksit Ödendi (%{progressPercent})
                        </ThemedText>
                        <ThemedText style={styles.remainingDebtText}>
                          Kalan: {itemCurrency.symbol}
                          {remainingDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Card Actions Footer */}
                    <View style={styles.cardActionsRow}>
                      {!item.completed && (
                        <AnimatedPressable
                          onPress={() => handlePayInstallment(item)}
                          style={styles.payNowButton}>
                          <Ionicons name="checkmark-circle" size={15} color="#000" style={{ marginRight: 5 }} />
                          <ThemedText style={styles.payNowButtonText}>Bu Ayı Öde</ThemedText>
                        </AnimatedPressable>
                      )}

                      <AnimatedPressable
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleDeleteInstallment(item.id, item.title)}
                        style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={17} color="#6E6E73" />
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ================= SUBSCRIPTIONS TAB ================= */}
        {activeTab === 'subscription' && (
          <>
            {/* KPI Dashboard Banner */}
            <View style={styles.kpiContainer}>
              <View style={styles.kpiCard}>
                <ThemedText style={styles.kpiLabel}>AYLIK ABONELİK YÜKÜ</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: '#FF375F' }]}>
                  -₺{subMonthlyTotalTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <ThemedText style={styles.kpiSub}>
                  {foreignSubSummary ? `${activeSubscriptions.length} aktif • ${foreignSubSummary}` : `${activeSubscriptions.length} aktif servis`}
                </ThemedText>
              </View>

              <View style={styles.kpiCard}>
                <ThemedText style={styles.kpiLabel}>YILLIK TAHMİNİ MALİYET</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: '#BF5AF2' }]}>
                  ₺{(subMonthlyTotalTRY * 12).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <ThemedText style={styles.kpiSub}>Yıllık projeksiyon</ThemedText>
              </View>
            </View>

            {/* Collapsible New Subscription Form */}
            <View style={styles.formCard}>
              <View style={styles.formToggleRow}>
                <View style={styles.formCardTitleRow}>
                  <Ionicons name="sparkles" size={18} color={Colors.tint} />
                  <ThemedText style={styles.formCardTitle}>Yeni Abonelik Tanımla</ThemedText>
                </View>
                <AnimatedPressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setIsSubFormExpanded(!isSubFormExpanded);
                  }}
                  style={styles.toggleCollapseBtn}>
                  <ThemedText style={styles.toggleCollapseText}>
                    {isSubFormExpanded ? 'Gizle' : '+ Formu Aç'}
                  </ThemedText>
                  <Ionicons
                    name={isSubFormExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.tint}
                    style={{ marginLeft: 4 }}
                  />
                </AnimatedPressable>
              </View>

              {isSubFormExpanded && (
                <View style={{ marginTop: 14 }}>
                  {/* Quick Preset Selector */}
                  <ThemedText style={styles.inputLabel}>HIZLI SERVİS SEÇİN</ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetScrollContent}
                    style={{ marginBottom: 14 }}>
                    {PRESET_SUBSCRIPTIONS.map((preset) => {
                      const isSelected = selectedPreset === preset.name;
                      return (
                        <TouchableOpacity
                          key={preset.name}
                          activeOpacity={0.7}
                          onPress={() => handleSelectPreset(preset)}
                          style={[
                            styles.presetChip,
                            isSelected && {
                              borderColor: preset.color,
                              backgroundColor: `${preset.color}22`,
                            },
                          ]}>
                          <View
                            style={[
                              styles.presetDot,
                              { backgroundColor: preset.color },
                              isSelected && { transform: [{ scale: 1.25 }] },
                            ]}
                          />
                          <ThemedText
                            style={[
                              styles.presetChipText,
                              isSelected && { color: '#FFFFFF', fontWeight: '700' },
                            ]}>
                            {preset.name}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Service Name Input */}
                  <ThemedText style={styles.inputLabel}>PLATFORM / SERVİS ADI</ThemedText>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name={(subIcon as any) || 'play-circle-outline'}
                      size={18}
                      color={subColor || Colors.tint}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      placeholder="Örn: Netflix, Spotify, ChatGPT Plus..."
                      value={subName}
                      onChangeText={(t) => {
                        setSubName(t);
                        setSelectedPreset(null);
                      }}
                      style={styles.textInput}
                      maxLength={40}
                      placeholderTextColor="#636366"
                    />
                  </View>

                  {/* Category & Billing Cycle Row */}
                  <View style={styles.inputsRow}>
                    <View style={[styles.inputGroupCol, { flex: 1.2 }]}>
                      <ThemedText style={styles.inputLabel}>KATEGORİ</ThemedText>
                      <View style={styles.inputWrap}>
                        <Ionicons name="pricetag-outline" size={16} color="#8E8E93" style={styles.inputIcon} />
                        <TextInput
                          placeholder="Örn: Dizi / Film, Müzik"
                          value={subCategory}
                          onChangeText={setSubCategory}
                          style={styles.textInput}
                          maxLength={30}
                          placeholderTextColor="#636366"
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroupCol, { flex: 1 }]}>
                      <ThemedText style={styles.inputLabel}>ÖDEME DÖNGÜSÜ</ThemedText>
                      <View style={styles.cycleToggleRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSubBillingCycle('monthly');
                          }}
                          style={[
                            styles.cyclePill,
                            subBillingCycle === 'monthly' && styles.cyclePillActive,
                          ]}>
                          <ThemedText
                            style={[
                              styles.cyclePillText,
                              subBillingCycle === 'monthly' && styles.cyclePillTextActive,
                            ]}>
                            Aylık
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSubBillingCycle('yearly');
                          }}
                          style={[
                            styles.cyclePill,
                            subBillingCycle === 'yearly' && styles.cyclePillActive,
                          ]}>
                          <ThemedText
                            style={[
                              styles.cyclePillText,
                              subBillingCycle === 'yearly' && styles.cyclePillTextActive,
                            ]}>
                            Yıllık
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Currency Switcher */}
                  <ThemedText style={styles.inputLabel}>PARA BİRİMİ</ThemedText>
                  <View style={styles.currencyGroup}>
                    {currencies.map((c) => {
                      const isActive = subCurrency.code === c.code;
                      return (
                        <AnimatedPressable
                          key={c.code}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSubCurrency(c);
                          }}
                          style={[styles.currencyPill, isActive && styles.currencyPillActive]}>
                          <ThemedText style={[styles.currencyPillText, isActive && styles.currencyPillTextActive]}>
                            {c.label}
                          </ThemedText>
                        </AnimatedPressable>
                      );
                    })}
                  </View>

                  {/* Amount & Due Day Row */}
                  <View style={styles.inputsRow}>
                    <View style={[styles.inputGroupCol, { flex: 1.2 }]}>
                      <ThemedText style={styles.inputLabel}>
                        {subBillingCycle === 'yearly' ? 'YILLIK TUTAR' : 'AYLIK TUTAR'}
                      </ThemedText>
                      <View style={styles.inputWrap}>
                        <ThemedText style={styles.inputPrefix}>{subCurrency.symbol}</ThemedText>
                        <TextInput
                          placeholder="Örn: 229,99"
                          value={subAmount}
                          onChangeText={(t) => formatNumberInput(t, setSubAmount)}
                          style={styles.textInput}
                          keyboardType="numeric"
                          maxLength={12}
                          placeholderTextColor="#636366"
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroupCol, { flex: 1 }]}>
                      <ThemedText style={styles.inputLabel}>ÇEKİLME GÜNÜ</ThemedText>
                      <View style={styles.inputWrap}>
                        <Ionicons name="today-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
                        <TextInput
                          placeholder="Gün (1-31)"
                          value={subDueDay}
                          onChangeText={(t) => handleDayInput(t, setSubDueDay)}
                          onBlur={() => handleDayBlur(subDueDay, setSubDueDay)}
                          style={styles.textInput}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholderTextColor="#636366"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Optional Bank / Card Selector */}
                  <ThemedText style={styles.inputLabel}>ÖDENEN KART / BANKA (OPSİYONEL)</ThemedText>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.bankSelectorButton, subBank ? styles.bankSelectorButtonActive : null]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setBankModalTarget('subscription');
                      setBankSearchQuery('');
                      setBankModalVisible(true);
                    }}>
                    <View style={styles.bankSelectorLeft}>
                      <View style={[styles.bankIconCircle, subBank ? styles.bankIconCircleActive : null]}>
                        <Ionicons
                          name="card-outline"
                          size={18}
                          color={subBank ? Colors.tint : '#8E8E93'}
                        />
                      </View>
                      <ThemedText style={[styles.bankSelectorText, subBank ? styles.bankSelectorTextActive : null]}>
                        {subBank || 'Banka veya Kredi Kartı Seçin'}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-down" size={17} color={subBank ? Colors.tint : '#8E8E93'} />
                  </TouchableOpacity>

                  {/* Quick Bank Chips */}
                  <View style={styles.chipRow}>
                    {COMMON_BANKS.map((b) => {
                      const isSelected = subBank === b;
                      return (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={b}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSubBank(isSelected ? '' : b);
                          }}
                          style={[styles.chip, isSelected && styles.chipActive]}>
                          <ThemedText style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {b}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Add Subscription Button */}
                  <AnimatedPressable
                    style={[styles.addButton, { backgroundColor: Colors.tint, marginTop: 6 }]}
                    onPress={handleAddSubscription}>
                    <Ionicons name="add" size={20} color="#000" />
                    <ThemedText style={[styles.addButtonText, { color: '#000' }]}>
                      Aboneliği Kaydet
                    </ThemedText>
                  </AnimatedPressable>
                </View>
              )}
            </View>

            {/* Subscriptions List Section Header */}
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Kayıtlı Abonelikler</ThemedText>
              <View style={styles.countBadge}>
                <ThemedText style={styles.countBadgeText}>{subscriptions.length}</ThemedText>
              </View>
            </View>

            {/* Subscriptions List */}
            {subscriptions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="play-circle-outline" size={34} color="#555" />
                </View>
                <ThemedText style={styles.emptyTitle}>Kayıtlı Abonelik Yok</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Netflix, Spotify, iCloud gibi düzenli servislerinizi ekleyin, aylık sabit gider yükünüzü ve yaklaşan ödemelerinizi tek bakışta görün.
                </ThemedText>
              </View>
            ) : (
              subscriptions.map((item) => {
                const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency || '₺' };
                const brandColor = item.color || Colors.tint;

                return (
                  <View
                    key={item.id}
                    style={[styles.subCard, !item.isActive && styles.subCardPaused]}>
                    <View style={styles.subCardTop}>
                      <View
                        style={[
                          styles.subBrandIcon,
                          {
                            backgroundColor: `${brandColor}20`,
                            borderColor: `${brandColor}40`,
                          },
                        ]}>
                        <Ionicons
                          name={(item.iconName as any) || 'play-circle-outline'}
                          size={22}
                          color={brandColor}
                        />
                      </View>

                      <View style={styles.subCenter}>
                        <View style={styles.subTitleRow}>
                          <ThemedText style={styles.subTitle}>{item.name}</ThemedText>
                          {!item.isActive && (
                            <View style={styles.pausedBadge}>
                              <ThemedText style={styles.pausedBadgeText}>Duraklatıldı</ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText style={styles.subMeta}>
                          {item.bank && item.bank !== 'Belirtilmedi' ? `${item.bank} • ` : ''}
                          {item.category || 'Abonelik'} • {item.billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}
                        </ThemedText>
                        <View style={styles.dueDayPill}>
                          <Ionicons name="calendar-outline" size={12} color="#8E8E93" style={{ marginRight: 4 }} />
                          <ThemedText style={styles.dueDayPillText}>
                            Her ayın {item.dueDay}. günü
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.subRight}>
                        <ThemedText style={styles.subAmount}>
                          -{itemCurrency.symbol}
                          {item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </ThemedText>
                        <ThemedText style={styles.subBillingPeriod}>
                          {item.billingCycle === 'yearly' ? '/ yıl' : '/ ay'}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Action Row */}
                    <View style={styles.subActionRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.subPayBtn}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSubToPay(item);
                        }}>
                        <Ionicons name="flash" size={13} color="#000" style={{ marginRight: 5 }} />
                        <ThemedText style={styles.subPayBtnText}>Şimdi İşle</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.subPauseBtn, !item.isActive && styles.subResumeBtn]}
                        onPress={() => handleToggleSubStatus(item)}>
                        <Ionicons
                          name={item.isActive ? 'pause-outline' : 'play-outline'}
                          size={13}
                          color={item.isActive ? '#8E8E93' : Colors.tint}
                          style={{ marginRight: 4 }}
                        />
                        <ThemedText style={[styles.subPauseBtnText, !item.isActive && { color: Colors.tint }]}>
                          {item.isActive ? 'Duraklat' : 'Aktif Et'}
                        </ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.subDeleteBtn}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSubToDelete(item);
                        }}>
                        <Ionicons name="trash-outline" size={16} color="#8E8E93" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ================= RECURRING INCOMES TAB ================= */}
        {activeTab === 'income' && (
          <>
            <View style={styles.formCard}>
              <View style={styles.formCardTitleRow}>
                <Ionicons name="calendar" size={16} color={Colors.income} />
                <ThemedText style={styles.formCardTitle}>Yeni Düzenli Gelir Ekle</ThemedText>
              </View>

              {/* Source Input */}
              <ThemedText style={styles.inputLabel}>GELİR KAYNAĞI / AÇIKLAMA</ThemedText>
              <View style={styles.inputWrap}>
                <Ionicons name="briefcase-outline" size={18} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  placeholder="Örn: Maaş, Kira Geliri, Temettü"
                  value={category}
                  onChangeText={setCategory}
                  style={styles.textInput}
                  maxLength={40}
                  placeholderTextColor="#636366"
                />
              </View>

              {/* Currency Switcher */}
              <ThemedText style={styles.inputLabel}>PARA BİRİMİ</ThemedText>
              <View style={styles.currencyGroup}>
                {currencies.map((c) => {
                  const isActive = incomeCurrency.code === c.code;
                  return (
                    <AnimatedPressable
                      key={c.code}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setIncomeCurrency(c);
                      }}
                      style={[styles.currencyPill, isActive && styles.currencyPillActive]}>
                      <ThemedText style={[styles.currencyPillText, isActive && styles.currencyPillTextActive]}>
                        {c.label}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* Amount & Day Inputs Row */}
              <View style={styles.inputsRow}>
                <View style={[styles.inputGroupCol, { flex: 1.2 }]}>
                  <ThemedText style={styles.inputLabel}>AYLIK TUTAR</ThemedText>
                  <View style={styles.inputWrap}>
                    <ThemedText style={styles.inputPrefix}>{incomeCurrency.symbol}</ThemedText>
                    <TextInput
                      placeholder="Örn: 45000"
                      value={amount}
                      onChangeText={(t) => formatNumberInput(t, setAmount)}
                      style={styles.textInput}
                      keyboardType="numeric"
                      maxLength={12}
                      placeholderTextColor="#636366"
                    />
                  </View>
                </View>

                <View style={[styles.inputGroupCol, { flex: 1 }]}>
                  <ThemedText style={styles.inputLabel}>YATIŞ GÜNÜ</ThemedText>
                  <View style={styles.inputWrap}>
                    <Ionicons name="today-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
                    <TextInput
                      placeholder="Gün (1-31)"
                      value={dayOfMonth}
                      onChangeText={(t) => handleDayInput(t, setDayOfMonth)}
                      onBlur={() => handleDayBlur(dayOfMonth, setDayOfMonth)}
                      style={styles.textInput}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholderTextColor="#636366"
                    />
                  </View>
                </View>
              </View>

              {/* Add Button */}
              <AnimatedPressable
                style={[styles.addButton, { backgroundColor: Colors.income }]}
                onPress={handleAddRecurringIncome}>
                <Ionicons name="add" size={20} color="#000" />
                <ThemedText style={styles.addButtonText}>Aylık Geliri Planla</ThemedText>
              </AnimatedPressable>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Aktif Gelir Akışları</ThemedText>
              <View style={styles.countBadge}>
                <ThemedText style={styles.countBadgeText}>{recurringIncomes.length}</ThemedText>
              </View>
            </View>

            {/* Incomes List */}
            {recurringIncomes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="repeat-outline" size={32} color="#555" />
                </View>
                <ThemedText style={styles.emptyTitle}>Düzenli Gelir Kaydı Yok</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Maaş veya pasif gelir akışlarınızı ekleyin, her ay belirlediğiniz günde otomatik bakiyenize işlensin.
                </ThemedText>
              </View>
            ) : (
              recurringIncomes.map((item) => {
                const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };
                return (
                  <View key={item.id} style={styles.recurringCard}>
                    <View style={styles.dayCalendarBadge}>
                      <ThemedText style={styles.dayBadgeLabel}>GÜN</ThemedText>
                      <ThemedText style={styles.dayBadgeNumber}>{item.dayOfMonth}</ThemedText>
                    </View>

                    <View style={styles.recurringCenter}>
                      <ThemedText style={styles.recurringTitle}>{item.category}</ThemedText>
                      <ThemedText style={styles.recurringSub}>
                        Her ayın {item.dayOfMonth}. gününde otomatik bakiyeye eklenir
                      </ThemedText>
                    </View>

                    <View style={styles.recurringRight}>
                      <ThemedText style={styles.recurringAmount}>
                        +{itemCurrency.symbol}
                        {item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </ThemedText>
                      <AnimatedPressable
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleDeleteIncome(item.id)}
                        style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={17} color="#6E6E73" />
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Bank Selection Bottom Sheet Modal */}
      <SwipeableModal
        visible={isBankModalVisible}
        onClose={() => setBankModalVisible(false)}
        sheetStyle={[styles.modalSheet, { maxHeight: '78%', paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <View style={styles.modalHeaderRow}>
          <ThemedText style={styles.modalSheetTitle}>Banka / Kart Seçin</ThemedText>
          <TouchableOpacity
            onPress={() => setBankModalVisible(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Bank Search Input */}
        <View style={styles.modalSearchWrap}>
          <Ionicons name="search-outline" size={17} color="#8E8E93" style={styles.modalSearchIcon} />
          <TextInput
            placeholder="Banka ara (örn: Ziraat, Garanti)..."
            value={bankSearchQuery}
            onChangeText={setBankSearchQuery}
            style={styles.modalSearchInput}
            maxLength={30}
            placeholderTextColor="#636366"
            autoCorrect={false}
          />
          {bankSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setBankSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle-sharp" size={17} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginTop: 8 }}>
          {filteredBanks.map((bankName) => {
            const isSelected = bankModalTarget === 'installment' ? instBank === bankName : subBank === bankName;
            return (
              <TouchableOpacity
                key={bankName}
                activeOpacity={0.7}
                style={[styles.modalItemRow, isSelected && styles.modalItemRowActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  if (bankModalTarget === 'installment') {
                    setInstBank(bankName);
                  } else {
                    setSubBank(bankName);
                  }
                  setBankModalVisible(false);
                }}>
                <View style={styles.modalItemLeft}>
                  <View style={[styles.modalBankIcon, isSelected && styles.modalBankIconActive]}>
                    <Ionicons
                      name={bankName === 'Diğer' ? 'ellipsis-horizontal' : 'business-outline'}
                      size={18}
                      color={isSelected ? Colors.tint : '#8E8E93'}
                    />
                  </View>
                  <ThemedText style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                    {bankName}
                  </ThemedText>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.tint} />}
              </TouchableOpacity>
            );
          })}
          {filteredBanks.length === 0 && (
            <View style={styles.modalEmptyWrap}>
              <ThemedText style={styles.modalEmptyText}>Eşleşen banka bulunamadı</ThemedText>
            </View>
          )}
        </ScrollView>
      </SwipeableModal>

      {/* Subscription Pay Confirm Modal */}
      <SwipeableModal
        visible={!!subToPay}
        onClose={() => setSubToPay(null)}
        enableFullSheetDrag={true}
        sheetStyle={[styles.actionModalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <View style={styles.actionModalHeader}>
          <View style={[styles.actionModalIconBadge, { backgroundColor: 'rgba(57, 255, 20, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.tint} />
          </View>
          <ThemedText style={styles.actionModalTitle}>Abonelik Ödemesini Kaydet</ThemedText>
          <ThemedText style={styles.actionModalDesc}>
            Bu ödemeyi Harcamalar (Subscriptions) listenize hemen ekleyip bakiyenizden düşmek istiyor musunuz?
          </ThemedText>
        </View>

        {subToPay && (
          <View style={styles.actionModalPreviewCard}>
            <View style={styles.previewLeft}>
              <ThemedText style={styles.previewTitle}>{subToPay.name}</ThemedText>
              <ThemedText style={styles.previewSub}>
                {subToPay.category} • Her ayın {subToPay.dueDay}. günü
              </ThemedText>
            </View>
            <ThemedText style={[styles.previewAmount, { color: '#FF453A' }]}>
              -{currencies.find((c) => c.code === subToPay.currency)?.symbol || subToPay.currency}
              {subToPay.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
          </View>
        )}

        <View style={styles.actionModalBtnRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.actionModalCancelBtn}
            onPress={() => setSubToPay(null)}>
            <ThemedText style={styles.actionModalCancelBtnText}>Vazgeç</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.actionModalConfirmBtn}
            onPress={handleConfirmPaySub}>
            <Ionicons name="card" size={17} color="#000" style={{ marginRight: 6 }} />
            <ThemedText style={styles.actionModalConfirmBtnText}>Öde ve Kaydet</ThemedText>
          </TouchableOpacity>
        </View>
      </SwipeableModal>

      {/* Subscription Delete Confirm Modal */}
      <SwipeableModal
        visible={!!subToDelete}
        onClose={() => setSubToDelete(null)}
        enableFullSheetDrag={true}
        sheetStyle={[styles.actionModalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <View style={styles.actionModalHeader}>
          <View style={[styles.actionModalIconBadge, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
            <Ionicons name="trash" size={26} color="#FF453A" />
          </View>
          <ThemedText style={styles.actionModalTitle}>Aboneliği Kaldır</ThemedText>
          <ThemedText style={styles.actionModalDesc}>
            {`"${subToDelete?.name}" abonelik kaydını silmek istediğinize emin misiniz? Daha önce kaydedilen harcama geçmişiniz korunur.`}
          </ThemedText>
        </View>

        <View style={styles.actionModalBtnRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.actionModalCancelBtn}
            onPress={() => setSubToDelete(null)}>
            <ThemedText style={styles.actionModalCancelBtnText}>Vazgeç</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionModalConfirmBtn, { backgroundColor: '#FF453A' }]}
            onPress={handleConfirmDeleteSub}>
            <Ionicons name="trash" size={17} color="#FFF" style={{ marginRight: 6 }} />
            <ThemedText style={[styles.actionModalConfirmBtnText, { color: '#FFF' }]}>Sil</ThemedText>
          </TouchableOpacity>
        </View>
      </SwipeableModal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    screenHeader: {
      marginBottom: 14,
    },
    screenSubtitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    screenTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.5,
      marginTop: 2,
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 16,
    },
    segmentButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: 11,
    },
    segmentButtonActive: {
      backgroundColor: isDark ? '#24262E' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(57, 255, 20, 0.3)' : 'rgba(5, 150, 105, 0.3)',
    },
    segmentText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.text,
    },
    segmentBadge: {
      marginLeft: 4,
      backgroundColor: isDark ? '#1E1F24' : '#E2E8F0',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
    },
    segmentBadgeActive: {
      backgroundColor: colors.tintSoft,
    },
    segmentBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    segmentBadgeTextActive: {
      color: colors.tint,
    },
    kpiContainer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    kpiValue: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.3,
      marginTop: 4,
    },
    kpiSub: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    formToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    toggleCollapseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.tintSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.tintSoft,
    },
    toggleCollapseText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.tint,
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: colors.shadow.shadowOpacity,
          shadowRadius: 10,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    formCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    formCardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.2,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 6,
      marginTop: 4,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 10,
      height: 46,
    },
    inputIcon: {
      marginRight: 8,
    },
    inputPrefix: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.tint,
      marginRight: 6,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    chip: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
      borderColor: colors.tint,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.tint,
    },
    currencyGroup: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 12,
    },
    currencyPill: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 9,
      alignItems: 'center',
    },
    currencyPillActive: {
      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.tint,
    },
    currencyPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    currencyPillTextActive: {
      color: colors.tint,
    },
    inputsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inputGroupCol: {
      flex: 1,
    },
    liveCalculationBox: {
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(57, 255, 20, 0.25)' : 'rgba(5, 150, 105, 0.25)',
      marginBottom: 14,
      gap: 4,
    },
    calcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    calcLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    calcValue: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.tint,
    },
    calcValueSub: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FF9F0A',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
      borderRadius: 14,
      height: 46,
      gap: 6,
      marginTop: 4,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: isDark ? '#000000' : '#FFFFFF',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    countBadge: {
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.tint,
    },
    installmentCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    installmentCardCompleted: {
      opacity: 0.65,
      borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    bankPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    bankPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    headerRightBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dueDayPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 7,
    },
    dueDayPillText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(76, 175, 80, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
    },
    completedBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#4CAF50',
    },
    activeBadge: {
      backgroundColor: 'rgba(255, 159, 10, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
    },
    activeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FF9F0A',
    },
    cardMainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardTitleCol: {
      flex: 1,
      marginRight: 10,
    },
    installmentTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    installmentSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 3,
    },
    cardAmountCol: {
      alignItems: 'flex-end',
    },
    installmentMonthlyAmount: {
      fontSize: 17,
      fontWeight: '900',
      color: '#FF453A',
      letterSpacing: -0.3,
    },
    installmentPerMonth: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    progressContainer: {
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      padding: 9,
      marginBottom: 10,
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    remainingDebtText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FF9F0A',
    },
    cardActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
    },
    payNowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tint,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 9,
    },
    payNowButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#000000' : '#FFFFFF',
    },
    recurringCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayCalendarBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.incomeSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(52, 199, 89, 0.25)' : 'rgba(16, 185, 129, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    dayBadgeLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.income,
      letterSpacing: 0.5,
    },
    dayBadgeNumber: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
    },
    recurringCenter: {
      flex: 1,
      marginRight: 8,
    },
    recurringTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    recurringSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 3,
    },
    recurringRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    recurringAmount: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.income,
    },
    deleteButton: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.cardSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 44,
      paddingHorizontal: 24,
    },
    emptyIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.cardSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    bankSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    bankSelectorButtonActive: {
      borderColor: colors.tint,
      backgroundColor: colors.tintSoft,
    },
    bankSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    bankIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bankIconCircleActive: {
      backgroundColor: colors.tintSoft,
    },
    bankSelectorText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    bankSelectorTextActive: {
      color: colors.text,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? '#3C3C40' : '#CBD5E1',
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalSheetTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    modalSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    modalSearchIcon: {
      marginRight: 8,
    },
    modalSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      padding: 0,
    },
    modalItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 4,
    },
    modalItemRowActive: {
      backgroundColor: colors.tintSoft,
    },
    modalItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    modalBankIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBankIconActive: {
      backgroundColor: colors.tintSoft,
    },
    modalItemText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    modalItemTextActive: {
      color: colors.tint,
      fontWeight: '700',
    },
    modalEmptyWrap: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    modalEmptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },

    // Subscriptions & Action Modals Styles
    presetScrollContent: {
      gap: 8,
      paddingVertical: 2,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 7,
    },
    presetDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cycleToggleRow: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: 3,
      height: 46,
      alignItems: 'center',
    },
    cyclePill: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    cyclePillActive: {
      backgroundColor: isDark ? '#24262E' : '#FFFFFF',
    },
    cyclePillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cyclePillTextActive: {
      color: colors.text,
      fontWeight: '700',
    },
    subCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subCardPaused: {
      opacity: 0.55,
    },
    subCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    subBrandIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
    },
    subCenter: {
      flex: 1,
      marginRight: 8,
    },
    subTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 3,
    },
    subTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    pausedBadge: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    pausedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    subMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    subRight: {
      alignItems: 'flex-end',
    },
    subAmount: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FF453A',
    },
    subBillingPeriod: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    subActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 12,
    },
    subPayBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
      paddingVertical: 9,
      borderRadius: 10,
    },
    subPayBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#000000' : '#FFFFFF',
    },
    subPauseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subResumeBtn: {
      borderColor: isDark ? 'rgba(57, 255, 20, 0.3)' : 'rgba(5, 150, 105, 0.3)',
    },
    subPauseBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subDeleteBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.cardSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    actionModalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionModalHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    actionModalIconBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    actionModalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    actionModalDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 10,
    },
    actionModalPreviewCard: {
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewLeft: {
      flex: 1,
    },
    previewTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    previewSub: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    previewAmount: {
      fontSize: 16,
      fontWeight: '800',
    },
    actionModalBtnRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionModalCancelBtn: {
      flex: 1,
      backgroundColor: colors.cardSecondary,
      paddingVertical: 14,
      borderRadius: 13,
      alignItems: 'center',
    },
    actionModalCancelBtnText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    actionModalConfirmBtn: {
      flex: 1,
      backgroundColor: colors.tint,
      paddingVertical: 14,
      borderRadius: 13,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    actionModalConfirmBtnText: {
      color: isDark ? '#000000' : '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
  });