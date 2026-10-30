import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
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

export default function CardsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark, t, language } = useSettings();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Installments State
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');
  const [isFormExpanded, setIsFormExpanded] = useState(false);

  // Form State
  const [instTitle, setInstTitle] = useState('');
  const [instBank, setInstBank] = useState('');
  const [instTotalAmount, setInstTotalAmount] = useState('');
  const [instTotalCount, setInstTotalCount] = useState('6');
  const [instPaidCount, setInstPaidCount] = useState('0');
  const [instDueDay, setInstDueDay] = useState('');
  const [instCurrency, setInstCurrency] = useState<Currency>(defaultCurrency);

  // Bank Search Modal
  const [isBankModalVisible, setBankModalVisible] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Delete & Pay confirmation
  const [itemToDelete, setItemToDelete] = useState<Installment | null>(null);

  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) return ALL_BANKS;
    const q = bankSearchQuery.toLowerCase().trim();
    return ALL_BANKS.filter((b) => b.toLowerCase().includes(q));
  }, [bankSearchQuery]);

  // Real-time Firestore sync
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'installments'), (snapshot) => {
      const list: Installment[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Installment);
      });
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

  // Calculations
  const activeInstallments = useMemo(() => {
    return installments.filter((item) => !item.completed && (item.remainingInstallments == null || item.remainingInstallments > 0));
  }, [installments]);

  const completedInstallments = useMemo(() => {
    return installments.filter((item) => item.completed || (item.remainingInstallments != null && item.remainingInstallments <= 0));
  }, [installments]);

  const displayedInstallments = useMemo(() => {
    if (filterMode === 'active') return activeInstallments;
    if (filterMode === 'completed') return completedInstallments;
    return installments;
  }, [installments, filterMode, activeInstallments, completedInstallments]);

  const totalMonthlyCommitment = useMemo(() => {
    return activeInstallments.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
  }, [activeInstallments]);

  const totalRemainingDebt = useMemo(() => {
    return activeInstallments.reduce((sum, item) => {
      const remaining = item.remainingInstallments ?? Math.max(0, item.totalInstallments - (item.paidInstallments || 0));
      return sum + (item.monthlyAmount || 0) * remaining;
    }, 0);
  }, [activeInstallments]);

  // Live form calculation
  const parsedTotal = parseFloat(instTotalAmount.replace(',', '.')) || 0;
  const parsedCount = parseInt(instTotalCount, 10) || 1;
  const parsedPaid = parseInt(instPaidCount, 10) || 0;
  const liveMonthly = parsedCount > 0 ? parsedTotal / parsedCount : 0;
  const liveRemainingCount = Math.max(0, parsedCount - parsedPaid);
  const liveRemainingDebt = liveMonthly * liveRemainingCount;

  // Handlers
  const formatNumberInput = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9.,]/g, '');
    setter(cleaned);
  };

  const handleTotalCountInput = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setInstTotalCount(cleaned);
  };

  const handlePaidCountInput = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setInstPaidCount(cleaned);
  };

  const handleDayInput = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setter(cleaned);
  };

  const handleDayBlur = (val: string, setter: (val: string) => void) => {
    if (!val) return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) setter('1');
    else if (num > 31) setter('31');
  };

  const handleAddInstallment = async () => {
    const numericTotal = parseFloat(instTotalAmount.replace(',', '.'));
    const numericCount = parseInt(instTotalCount, 10);
    const numericPaid = parseInt(instPaidCount, 10) || 0;
    const numericDueDay = parseInt(instDueDay, 10);

    if (!instTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Eksik Bilgi' : 'Missing Information',
        text2: language === 'tr' ? 'Lütfen harcama veya ürün adını girin (örn. iPhone 15, Dyson).' : 'Please enter the expense or product name (e.g. iPhone 15, Dyson).',
      });
      return;
    }
    if (!instBank.trim()) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Eksik Bilgi' : 'Missing Information',
        text2: language === 'tr' ? 'Lütfen kartın ait olduğu bankayı seçin.' : 'Please select the bank or card.',
      });
      return;
    }
    if (isNaN(numericTotal) || numericTotal <= 0) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Geçersiz Tutar' : 'Invalid Amount',
        text2: language === 'tr' ? 'Lütfen geçerli bir toplam taksit tutarı girin.' : 'Please enter a valid total installment amount.',
      });
      return;
    }
    if (isNaN(numericCount) || numericCount < 1) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Geçersiz Taksit' : 'Invalid Installment',
        text2: language === 'tr' ? 'Taksit sayısı en az 1 olmalıdır.' : 'Installment count must be at least 1.',
      });
      return;
    }
    if (numericPaid >= numericCount) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Hatalı Taksit Sayısı' : 'Invalid Installment Count',
        text2: language === 'tr' ? 'Ödenmiş taksit sayısı toplam taksit sayısından küçük olmalıdır.' : 'Paid installments count must be less than total installments.',
      });
      return;
    }
    if (isNaN(numericDueDay) || numericDueDay < 1 || numericDueDay > 31) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Geçersiz Son Ödeme Günü' : 'Invalid Due Day',
        text2: language === 'tr' ? 'Lütfen 1 ile 31 arasında bir gün girin.' : 'Please enter a day between 1 and 31.',
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
        text1: language === 'tr' ? 'Taksit Kaydedildi 🎉' : 'Installment Saved 🎉',
        text2: language === 'tr'
          ? `Aylık ${instCurrency.symbol}${monthlyAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki taksitiniz her ayın ${numericDueDay}. günü için tanımlandı.`
          : `Monthly ${instCurrency.symbol}${monthlyAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} installment scheduled for day ${numericDueDay} of each month.`,
      });
    } catch (error) {
      console.error('Error adding installment:', error);
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Hata' : 'Error',
        text2: language === 'tr' ? 'Taksit kaydedilirken bir hata oluştu.' : 'An error occurred while saving the installment.',
      });
    }
  };

  const handlePayInstallment = (item: Installment) => {
    const currencySymbol = currencies.find((c) => c.code === item.currency)?.symbol || '₺';
    const nextPaid = (item.paidInstallments || 0) + 1;
    const nextRemaining = (item.remainingInstallments ?? item.totalInstallments) - 1;
    const formattedAmount = item.monthlyAmount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 });

    Alert.alert(
      t('instPayConfirmTitle'),
      language === 'tr'
        ? `${item.bank} - ${item.title} için ${currencySymbol}${formattedAmount} tutarındaki ${nextPaid}/${item.totalInstallments}. taksit işlemini şimdi kaydedip bakiyeden düşmek istiyor musunuz?`
        : `Do you want to record the ${nextPaid}/${item.totalInstallments} installment of ${currencySymbol}${formattedAmount} for ${item.bank} - ${item.title} and deduct it from your balance?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('payNow'),
          style: 'default',
          onPress: async () => {
            try {
              if (!user) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

              await addDoc(collection(db, 'users', user.uid, 'transactions'), {
                amount: -Math.abs(item.monthlyAmount),
                category: 'Debt',
                currency: item.currency || 'TRY',
                description: `${item.bank || (language === 'tr' ? 'Banka' : 'Bank')} - ${item.title} (${nextPaid}/${item.totalInstallments}. ${t('installmentOf')})`,
                type: 'expense',
                date: Timestamp.now(),
              });

              await updateDoc(doc(db, 'users', user.uid, 'installments', item.id), {
                paidInstallments: nextPaid,
                remainingInstallments: nextRemaining,
                completed: nextRemaining <= 0,
                lastCharged: Timestamp.now(),
              });

              Toast.show({
                type: 'success',
                text1: language === 'tr' ? 'Taksit Ödendi 🎉' : 'Installment Paid 🎉',
                text2: language === 'tr'
                  ? `${nextPaid}/${item.totalInstallments}. taksit harcamalarınıza eklendi.`
                  : `${nextPaid}/${item.totalInstallments} installment added to expenses.`,
              });
            } catch (err) {
              console.error('Error paying installment:', err);
              Toast.show({
                type: 'error',
                text1: language === 'tr' ? 'Hata' : 'Error',
                text2: language === 'tr' ? 'Taksit ödemesi kaydedilemedi.' : 'Could not record installment payment.',
              });
            }
          },
        },
      ]
    );
  };

  const handleDeleteInstallment = (id: string, title: string) => {
    Alert.alert(
      t('deleteInstTitle'),
      language === 'tr'
        ? `"${title}" taksit planını kalıcı olarak silmek istiyor musunuz?`
        : `Do you want to permanently delete the installment plan "${title}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await deleteDoc(doc(db, 'users', user.uid, 'installments', id));
              Toast.show({
                type: 'success',
                text1: language === 'tr' ? 'Taksit Silindi' : 'Installment Deleted',
                text2: language === 'tr' ? `${title} kaydı kaldırıldı.` : `${title} was removed.`,
              });
            } catch (error) {
              console.error('Error deleting installment:', error);
              Toast.show({
                type: 'error',
                text1: language === 'tr' ? 'Hata' : 'Error',
                text2: language === 'tr' ? 'Taksit silinemedi.' : 'Could not delete installment.',
              });
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16) + 12,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        {/* Header Title */}
        <View style={styles.header}>
          <ThemedText style={styles.headerSubtitle}>{t('cardsSubtitle')}</ThemedText>
          <ThemedText style={styles.headerTitle}>{t('tabCards')}</ThemedText>
        </View>

        {/* KPI Dashboard Banner */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <Ionicons name="trending-down-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
              <ThemedText style={styles.kpiLabel}>{t('totalMonthlyInst').toUpperCase()}</ThemedText>
            </View>
            <ThemedText style={[styles.kpiValue, { color: '#EF4444' }]}>
              -₺{totalMonthlyCommitment.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
            <ThemedText style={styles.kpiSub}>{language === 'tr' ? 'Her ay otomatik yansır' : 'Reflects monthly'}</ThemedText>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeaderRow}>
              <Ionicons name="card-outline" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
              <ThemedText style={styles.kpiLabel}>{t('totalRemainingDebt').toUpperCase()}</ThemedText>
            </View>
            <ThemedText style={[styles.kpiValue, { color: '#F59E0B' }]}>
              ₺{totalRemainingDebt.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
            <ThemedText style={styles.kpiSub}>{activeInstallments.length} {language === 'tr' ? 'aktif taksit planı' : 'active installment plans'}</ThemedText>
          </View>
        </View>

        {/* Toggle Form Header / Button */}
        <View style={styles.formToggleRow}>
          <View style={styles.formCardTitleRow}>
            <Ionicons name="add-circle" size={18} color={colors.tint} />
            <ThemedText style={styles.formCardTitle}>{t('newInstallment')}</ThemedText>
          </View>
          <AnimatedPressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setIsFormExpanded(!isFormExpanded);
            }}
            style={styles.toggleCollapseBtn}>
            <ThemedText style={styles.toggleCollapseText}>
              {isFormExpanded ? (language === 'tr' ? 'Gizle' : 'Hide') : (language === 'tr' ? '+ Formu Aç' : '+ Open Form')}
            </ThemedText>
            <Ionicons
              name={isFormExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.tint}
            />
          </AnimatedPressable>
        </View>

        {/* Collapsible Installment Form */}
        {isFormExpanded && (
          <View style={styles.formCard}>
            {/* Product / Expense Title */}
            <ThemedText style={styles.inputLabel}>{t('instTitle').toUpperCase()}</ThemedText>
            <View style={styles.inputWrap}>
              <Ionicons name="cart-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder={t('instTitlePlaceholder')}
                value={instTitle}
                onChangeText={setInstTitle}
                style={styles.textInput}
                maxLength={50}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Bank Selection - Modal Selector */}
            <ThemedText style={styles.inputLabel}>{language === 'tr' ? 'BANKA / KREDİ KARTI' : 'BANK / CREDIT CARD'}</ThemedText>
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
                    color={instBank ? colors.tint : colors.textSecondary}
                  />
                </View>
                <ThemedText style={[styles.bankSelectorText, instBank ? styles.bankSelectorTextActive : null]}>
                  {instBank || t('selectBank')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-down" size={17} color={instBank ? colors.tint : colors.textSecondary} />
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
            <ThemedText style={styles.inputLabel}>{language === 'tr' ? 'PARA BİRİMİ' : 'CURRENCY'}</ThemedText>
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
                <ThemedText style={styles.inputLabel}>{t('totalExpenseAmount').toUpperCase()}</ThemedText>
                <View style={styles.inputWrap}>
                  <ThemedText style={styles.inputPrefix}>{instCurrency.symbol}</ThemedText>
                  <TextInput
                    placeholder="Örn: 36000"
                    value={instTotalAmount}
                    onChangeText={(t) => formatNumberInput(t, setInstTotalAmount)}
                    style={styles.textInput}
                    keyboardType="numeric"
                    maxLength={12}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={[styles.inputGroupCol, { flex: 1 }]}>
                <ThemedText style={styles.inputLabel}>{t('totalInstallmentsCount').toUpperCase()}</ThemedText>
                <View style={styles.inputWrap}>
                  <Ionicons name="repeat-outline" size={17} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Örn: 6"
                    value={instTotalCount}
                    onChangeText={handleTotalCountInput}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={colors.textMuted}
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
                      {count} {t('installmentOf')}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Paid so far & Due Day */}
            <View style={styles.inputsRow}>
              <View style={[styles.inputGroupCol, { flex: 1 }]}>
                <ThemedText style={styles.inputLabel}>{t('paidInstallmentsCount').toUpperCase()}</ThemedText>
                <View style={styles.inputWrap}>
                  <Ionicons name="checkmark-done-outline" size={17} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    placeholder="0"
                    value={instPaidCount}
                    onChangeText={handlePaidCountInput}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={[styles.inputGroupCol, { flex: 1.2 }]}>
                <ThemedText style={styles.inputLabel}>{t('dueDay').toUpperCase()}</ThemedText>
                <View style={styles.inputWrap}>
                  <Ionicons name="calendar-outline" size={17} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    placeholder={language === 'tr' ? 'Gün (1-31)' : 'Day (1-31)'}
                    value={instDueDay}
                    onChangeText={(t) => handleDayInput(t, setInstDueDay)}
                    onBlur={() => handleDayBlur(instDueDay, setInstDueDay)}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>

            {/* Live Preview Calculation */}
            {parsedTotal > 0 && (
              <View style={styles.liveCalculationBox}>
                <View style={styles.calcRow}>
                  <ThemedText style={styles.calcLabel}>{language === 'tr' ? 'Aylık Ödeme:' : 'Monthly Payment:'}</ThemedText>
                  <ThemedText style={styles.calcValue}>
                    {instCurrency.symbol}
                    {liveMonthly.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {language === 'tr' ? '/ ay' : '/ mo'}
                  </ThemedText>
                </View>
                <View style={styles.calcRow}>
                  <ThemedText style={styles.calcLabel}>{language === 'tr' ? 'Kalan Süre / Borç:' : 'Remaining / Debt:'}</ThemedText>
                  <ThemedText style={styles.calcValueSub}>
                    {liveRemainingCount} {language === 'tr' ? 'ay' : 'mo'} • {instCurrency.symbol}
                    {liveRemainingDebt.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Add Installment Button */}
            <AnimatedPressable style={styles.addButton} onPress={handleAddInstallment}>
              <Ionicons name="checkmark-circle-outline" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
              <ThemedText style={styles.addButtonText}>{t('saveInstallment')}</ThemedText>
            </AnimatedPressable>
          </View>
        )}

        {/* Section Filter Pills */}
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>{language === 'tr' ? 'Taksit Planlarım' : 'My Installment Plans'}</ThemedText>
          <View style={styles.filterRow}>
            {(['all', 'active', 'completed'] as const).map((mode) => {
              const active = filterMode === mode;
              const label =
                mode === 'all'
                  ? `${t('filterAll')} (${installments.length})`
                  : mode === 'active'
                  ? `${t('filterActive')} (${activeInstallments.length})`
                  : `${t('filterCompleted')} (${completedInstallments.length})`;
              return (
                <TouchableOpacity
                  key={mode}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setFilterMode(mode);
                  }}
                  style={[styles.filterChip, active && styles.filterChipActive]}>
                  <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Installments List */}
        {displayedInstallments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="card-outline" size={32} color={colors.textSecondary} />
            </View>
            <ThemedText style={styles.emptyTitle}>
              {filterMode === 'completed' ? (language === 'tr' ? 'Tamamlanan Taksit Yok' : 'No Completed Installments') : t('noInstallments')}
            </ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              {t('noInstallmentsSub')}
            </ThemedText>
          </View>
        ) : (
          displayedInstallments.map((item) => {
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
                    <Ionicons name="card-outline" size={13} color={colors.tint} style={{ marginRight: 5 }} />
                    <ThemedText style={styles.bankPillText}>{item.bank || (language === 'tr' ? 'Banka' : 'Bank')}</ThemedText>
                  </View>

                  <View style={styles.headerRightBadges}>
                    <View style={styles.dueDayPill}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                      <ThemedText style={styles.dueDayPillText}>{t('dueDayPrefix')} {item.dueDay}{t('dueDaySuffix')}</ThemedText>
                    </View>

                    {item.completed ? (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-done" size={12} color="#10B981" style={{ marginRight: 4 }} />
                        <ThemedText style={styles.completedBadgeText}>{t('completedBadge')}</ThemedText>
                      </View>
                    ) : (
                      <View style={styles.activeBadge}>
                        <ThemedText style={styles.activeBadgeText}>{remaining} {t('remainingInstallmentLabel')}</ThemedText>
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
                      {language === 'tr' ? 'Toplam:' : 'Total:'} {itemCurrency.symbol}
                      {item.totalAmount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}
                    </ThemedText>
                  </View>

                  <View style={styles.cardAmountCol}>
                    <ThemedText style={styles.installmentMonthlyAmount}>
                      -{itemCurrency.symbol}
                      {item.monthlyAmount.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </ThemedText>
                    <ThemedText style={styles.installmentPerMonth}>{language === 'tr' ? '/ her ay' : '/ monthly'}</ThemedText>
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
                          backgroundColor: item.completed ? '#10B981' : colors.tint,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressTextRow}>
                    <ThemedText style={styles.progressText}>
                      {paid} / {total} {t('installmentOf')} ({progressPercent}%)
                    </ThemedText>
                    <ThemedText style={styles.remainingDebtText}>
                      {language === 'tr' ? 'Kalan:' : 'Remaining:'} {itemCurrency.symbol}
                      {remainingDebt.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}
                    </ThemedText>
                  </View>
                </View>

                {/* Card Actions Footer */}
                <View style={styles.cardActionsRow}>
                  {!item.completed && (
                    <AnimatedPressable
                      onPress={() => handlePayInstallment(item)}
                      style={styles.payNowButton}>
                      <Ionicons name="checkmark-circle" size={15} color={isDark ? '#000000' : '#FFFFFF'} style={{ marginRight: 5 }} />
                      <ThemedText style={styles.payNowButtonText}>{t('payNow')}</ThemedText>
                    </AnimatedPressable>
                  )}

                  <AnimatedPressable
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => handleDeleteInstallment(item.id, item.title)}
                    style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={17} color={colors.textSecondary} />
                  </AnimatedPressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bank Picker Modal with Search */}
      <SwipeableModal
        visible={isBankModalVisible}
        onClose={() => setBankModalVisible(false)}
        sheetStyle={{ maxHeight: '80%', paddingBottom: Math.max(insets.bottom, 20) + 16 }}>
        <View style={styles.bankModalHeader}>
          <ThemedText style={styles.bankModalTitle}>{t('chooseBank')}</ThemedText>
          <TouchableOpacity
            onPress={() => setBankModalVisible(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={styles.bankSearchWrap}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder={t('searchBank')}
            value={bankSearchQuery}
            onChangeText={setBankSearchQuery}
            style={styles.bankSearchInput}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
          />
          {bankSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setBankSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Common Banks section */}
          {!bankSearchQuery && (
            <View style={{ marginBottom: 14 }}>
              <ThemedText style={styles.bankSectionTitle}>{language === 'tr' ? 'SIK KULLANILANLAR' : 'FREQUENTLY USED'}</ThemedText>
              <View style={styles.quickBankGrid}>
                {COMMON_BANKS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setInstBank(b);
                      setBankModalVisible(false);
                    }}
                    style={[styles.quickBankTile, instBank === b && styles.quickBankTileActive]}>
                    <Ionicons
                      name="card-outline"
                      size={16}
                      color={instBank === b ? colors.tint : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <ThemedText
                      style={[
                        styles.quickBankText,
                        instBank === b && { color: colors.tint, fontWeight: '800' },
                      ]}
                      numberOfLines={1}>
                      {b}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* All Banks List */}
          <ThemedText style={styles.bankSectionTitle}>{language === 'tr' ? 'TÜM BANKALAR & KURUMLAR' : 'ALL BANKS & INSTITUTIONS'}</ThemedText>
          {filteredBanks.map((bankName) => {
            const isSelected = instBank === bankName;
            return (
              <TouchableOpacity
                key={bankName}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setInstBank(bankName);
                  setBankModalVisible(false);
                }}
                style={[styles.bankListItem, isSelected && styles.bankListItemActive]}>
                <View style={styles.bankListLeft}>
                  <View style={[styles.bankListIconCircle, isSelected && styles.bankListIconCircleActive]}>
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={isSelected ? colors.tint : colors.textSecondary}
                    />
                  </View>
                  <ThemedText style={[styles.bankListName, isSelected && styles.bankListNameActive]}>
                    {bankName}
                  </ThemedText>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.tint} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SwipeableModal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    keyboardContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: 20,
    },
    header: {
      marginBottom: 20,
    },
    headerSubtitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.6,
    },
    kpiContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    kpiHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginBottom: 4,
    },
    kpiSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    formToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 4,
    },
    formCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    formCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    toggleCollapseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tintSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 4,
    },
    toggleCollapseText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.tint,
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 22,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 10,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 10,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    inputPrefix: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.tint,
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    bankSelectorButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 50,
      marginBottom: 8,
    },
    bankSelectorButtonActive: {
      borderColor: colors.tint,
    },
    bankSelectorLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bankIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bankIconCircleActive: {
      backgroundColor: colors.tintSoft,
    },
    bankSelectorText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    bankSelectorTextActive: {
      color: colors.text,
      fontWeight: '700',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
      marginBottom: 6,
    },
    chip: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.tintSoft,
      borderColor: colors.tint,
    },
    chipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    chipTextActive: {
      color: colors.tint,
      fontWeight: '800',
    },
    currencyGroup: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 4,
    },
    currencyPill: {
      flex: 1,
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    currencyPillActive: {
      backgroundColor: colors.tintSoft,
      borderColor: colors.tint,
    },
    currencyPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    currencyPillTextActive: {
      color: colors.tint,
      fontWeight: '800',
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
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    calcRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    calcLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    calcValue: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.tint,
    },
    calcValueSub: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    addButton: {
      backgroundColor: colors.tint,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderRadius: 14,
      gap: 8,
      marginTop: 16,
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
      marginBottom: 14,
      marginTop: 6,
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 6,
    },
    filterChip: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.tintSoft,
      borderColor: colors.tint,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: colors.tint,
      fontWeight: '800',
    },
    emptyContainer: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.cardSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
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
      maxWidth: 280,
    },
    installmentCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.06,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    installmentCardCompleted: {
      opacity: 0.75,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    bankPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tintSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    bankPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.tint,
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
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dueDayPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#E6F7F0',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    completedBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#10B981',
    },
    activeBadge: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    activeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    cardMainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
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
      marginBottom: 4,
      letterSpacing: -0.2,
    },
    installmentSub: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    cardAmountCol: {
      alignItems: 'flex-end',
    },
    installmentMonthlyAmount: {
      fontSize: 17,
      fontWeight: '900',
      color: '#EF4444',
      letterSpacing: -0.3,
    },
    installmentPerMonth: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
    },
    progressContainer: {
      marginBottom: 14,
    },
    progressBarBackground: {
      height: 7,
      backgroundColor: colors.cardSecondary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    remainingDebtText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    cardActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    payNowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tint,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
    },
    payNowButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: isDark ? '#000000' : '#FFFFFF',
    },
    deleteButton: {
      padding: 6,
    },
    bankModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
    },
    bankModalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    bankSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      paddingHorizontal: 12,
      height: 44,
      marginBottom: 14,
    },
    bankSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    bankSectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      marginBottom: 8,
      marginTop: 8,
    },
    quickBankGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 16,
    },
    quickBankTile: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickBankTileActive: {
      backgroundColor: colors.tintSoft,
      borderColor: colors.tint,
    },
    quickBankText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    bankListItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankListItemActive: {
      backgroundColor: colors.tintSoft,
    },
    bankListLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bankListIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.cardSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bankListIconCircleActive: {
      backgroundColor: colors.tint,
    },
    bankListName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    bankListNameActive: {
      fontWeight: '800',
      color: colors.tint,
    },
  });
