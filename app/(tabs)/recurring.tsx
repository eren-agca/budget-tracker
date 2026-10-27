import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
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

import { db } from '@/firebaseConfig';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';

export interface RecurringIncome {
  id: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
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
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
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

const QUICK_INSTALLMENTS = ['3', '6', '9', '12'];

export default function RecurringScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Active Segment Tab
  const [activeTab, setActiveTab] = useState<'income' | 'installment'>('installment');

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

  // --- Handlers: Recurring Income ---
  const handleAddRecurringIncome = async () => {
    const numericAmount = parseFloat(amount.replace(',', '.'));
    const numericDay = parseInt(dayOfMonth, 10);

    if (!category || isNaN(numericAmount) || isNaN(numericDay) || numericDay < 1 || numericDay > 31) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir gelir kaynağı, tutar ve gün (1-31) girin.');
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      await addDoc(collection(db, 'users', user.uid, 'recurringIncomes'), {
        amount: numericAmount,
        category,
        currency: incomeCurrency.code,
        dayOfMonth: numericDay,
        lastAdded: null,
      });

      setAmount('');
      setCategory('');
      setDayOfMonth('');
      setIncomeCurrency(defaultCurrency);
    } catch (error) {
      console.error('Error adding recurring income: ', error);
      Alert.alert('Hata', 'Düzenli gelir kaydedilemedi.');
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
            Alert.alert('Hata', 'Gelir silinemedi.');
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
      Alert.alert('Eksik Bilgi', 'Lütfen harcama veya ürün adını girin (örn. iPhone 15, Dyson).');
      return;
    }
    if (!instBank.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen kartın ait olduğu bankayı seçin veya girin.');
      return;
    }
    if (isNaN(numericTotal) || numericTotal <= 0) {
      Alert.alert('Geçersiz Tutar', 'Lütfen geçerli bir toplam taksit tutarı girin.');
      return;
    }
    if (isNaN(numericCount) || numericCount < 1) {
      Alert.alert('Geçersiz Taksit', 'Taksit sayısı en az 1 olmalıdır.');
      return;
    }
    if (numericPaid >= numericCount) {
      Alert.alert('Hata', 'Ödenmiş taksit sayısı toplam taksit sayısından küçük olmalıdır.');
      return;
    }
    if (isNaN(numericDueDay) || numericDueDay < 1 || numericDueDay > 31) {
      Alert.alert('Geçersiz Son Ödeme Günü', 'Lütfen 1 ile 31 arasında bir gün girin.');
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

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

      Alert.alert(
        'Taksit Kaydedildi 🎉',
        `Aylık ${instCurrency.symbol}${monthlyAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} tutarındaki taksitiniz kaydedildi. Her ayın ${numericDueDay}. gününde otomatik bakiyenizden düşülecektir.`
      );
    } catch (error) {
      console.error('Error adding installment:', error);
      Alert.alert('Hata', 'Taksit kaydedilirken bir hata oluştu.');
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
    const numericRegex = /^\d*([.,])?\d*$/;
    if (numericRegex.test(text) || text === '') {
      setter(text);
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
              size={16}
              color={activeTab === 'installment' ? Colors.tint : '#8E8E93'}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.segmentText, activeTab === 'installment' && styles.segmentTextActive]}>
              Taksitler & Kartlar
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
              setActiveTab('income');
            }}
            style={[styles.segmentButton, activeTab === 'income' && styles.segmentButtonActive]}>
            <Ionicons
              name="trending-up-outline"
              size={16}
              color={activeTab === 'income' ? Colors.income : '#8E8E93'}
              style={{ marginRight: 6 }}
            />
            <ThemedText style={[styles.segmentText, activeTab === 'income' && styles.segmentTextActive]}>
              Düzenli Gelirler
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
                    placeholderTextColor="#636366"
                  />
                </View>

                {/* Bank Selection */}
                <ThemedText style={styles.inputLabel}>BANKA / KREDİ KARTI</ThemedText>
                <View style={styles.inputWrap}>
                  <Ionicons name="card-outline" size={18} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Banka Adı (örn: Garanti BBVA, İş Bankası)"
                    value={instBank}
                    onChangeText={setInstBank}
                    style={styles.textInput}
                    placeholderTextColor="#636366"
                  />
                </View>

                {/* Quick Bank Chips */}
                <View style={styles.chipRow}>
                  {COMMON_BANKS.map((b) => {
                    const isSelected = instBank === b;
                    return (
                      <AnimatedPressable
                        key={b}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setInstBank(b);
                        }}
                        style={[styles.chip, isSelected && styles.chipActive]}>
                        <ThemedText style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {b}
                        </ThemedText>
                      </AnimatedPressable>
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
                          {c.code} ({c.symbol})
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
                        onChangeText={(t) => setInstTotalCount(t.replace(/[^0-9]/g, ''))}
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
                        onChangeText={(t) => setInstPaidCount(t.replace(/[^0-9]/g, ''))}
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
                        onChangeText={(t) => setInstDueDay(t.replace(/[^0-9]/g, ''))}
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
                        {c.code}
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
                      onChangeText={(t) => setDayOfMonth(t.replace(/[^0-9]/g, ''))}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0E10',
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
    color: '#8E8E93',
    letterSpacing: 1,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#16171B',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#24262E',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  segmentBadge: {
    marginLeft: 6,
    backgroundColor: '#1E1F24',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  segmentBadgeActive: {
    backgroundColor: 'rgba(57, 255, 20, 0.15)',
  },
  segmentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
  },
  segmentBadgeTextActive: {
    color: Colors.tint,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#16171B',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#636366',
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
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
  },
  toggleCollapseText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tint,
  },
  formCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
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
    color: '#F2F2F2',
    letterSpacing: 0.2,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: Colors.tint,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: '#F2F2F2',
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
    backgroundColor: '#131417',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  chipActive: {
    backgroundColor: '#26282E',
    borderColor: Colors.tint,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  chipTextActive: {
    color: Colors.tint,
  },
  currencyGroup: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  currencyPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  currencyPillActive: {
    backgroundColor: '#26282E',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.4)',
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
  },
  currencyPillTextActive: {
    color: Colors.tint,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroupCol: {
    flex: 1,
  },
  liveCalculationBox: {
    backgroundColor: '#121215',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
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
    color: '#8E8E93',
    fontWeight: '600',
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.tint,
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
    backgroundColor: Colors.tint,
    borderRadius: 14,
    height: 46,
    gap: 6,
    marginTop: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
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
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: '#26282E',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tint,
  },
  installmentCard: {
    backgroundColor: '#191A1F',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#121215',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  bankPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0E0E0',
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  dueDayPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
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
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  installmentSub: {
    fontSize: 11,
    color: '#8E8E93',
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
    color: '#8E8E93',
  },
  progressContainer: {
    backgroundColor: '#121215',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#26282E',
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
    color: '#8E8E93',
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
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  payNowButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191A1F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dayCalendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dayBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.income,
    letterSpacing: 0.5,
  },
  dayBadgeNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  recurringCenter: {
    flex: 1,
    marginRight: 8,
  },
  recurringTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F2F2F2',
  },
  recurringSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
  },
  recurringRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recurringAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.income,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#121215',
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
    backgroundColor: '#16171B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D1D1D6',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6E6E73',
    textAlign: 'center',
    lineHeight: 18,
  },
});