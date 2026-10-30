import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsModal } from '@/components/SettingsModal';
import { SwipeableModal } from '@/components/SwipeableModal';
import { ThemedText } from '@/components/ThemedText';
import { Ticker } from '@/components/Ticker';
import { expenseCategories } from '@/constants/Categories';
import { Colors } from '@/constants/Colors';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { dateFilters } from '@/constants/DateFilters';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { db } from '@/firebaseConfig';
import { ExchangeRates, getExchangeRates } from '@/services/currencyService';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  purchaseRate?: number;
  assetQuantity?: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  type: 'income' | 'expense';
  date: Date;
}

// Helper to resolve an icon for any category
const getCategoryIcon = (category: string, type: 'income' | 'expense'): any => {
  if (type === 'income') {
    if (category.toLowerCase().includes('salary')) return 'cash-outline';
    if (category.toLowerCase().includes('freelance')) return 'laptop-outline';
    if (category.toLowerCase().includes('investment')) return 'trending-up-outline';
    return 'arrow-down-circle-outline';
  }
  const match = expenseCategories.find(
    (c) => c.label.toLowerCase() === category.toLowerCase() || c.key.toLowerCase() === category.toLowerCase()
  );
  return match?.icon || 'pricetag-outline';
};

const TransactionListItem = React.memo(
  ({
    item,
    onDelete,
    displayCurrency,
    rate,
  }: {
    item: Transaction;
    onDelete: (item: Transaction) => void;
    displayCurrency: Currency;
    rate: number;
  }) => {
    const { colors, isDark } = useSettings();
    const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };
    const isIncome = item.amount > 0;
    const iconName = getCategoryIcon(item.category, item.type);

    const formatDate = (timestamp: Date) => {
      if (!(timestamp instanceof Date)) return '';
      const day = String(timestamp.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[timestamp.getMonth()] || '';
      const hours = String(timestamp.getHours()).padStart(2, '0');
      const minutes = String(timestamp.getMinutes()).padStart(2, '0');
      return `${day} ${month} • ${hours}:${minutes}`;
    };

    return (
      <View style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View
          style={[
            styles.categoryIconCircle,
            {
              backgroundColor: isIncome
                ? colors.incomeSoft
                : isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.04)',
            },
          ]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isIncome ? colors.income : colors.tint}
          />
        </View>

        <View style={styles.transactionMainInfo}>
          <ThemedText style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={1}>
            {item.description || item.category}
          </ThemedText>
          <View style={styles.transactionMetaRow}>
            <ThemedText style={[styles.transactionCategoryTag, { color: colors.textSecondary }]}>
              {item.category}
            </ThemedText>
            <ThemedText style={[styles.metaDot, { color: colors.textMuted }]}>•</ThemedText>
            <ThemedText style={[styles.transactionDate, { color: colors.textMuted }]}>
              {formatDate(item.date)}
            </ThemedText>
          </View>

          {item.category === 'Savings' && item.purchaseRate != null && item.assetQuantity != null && (
            <View style={[styles.assetBadge, { backgroundColor: colors.tintSoft }]}>
              <Ionicons name="sparkles" size={11} color={colors.tint} />
              <ThemedText style={[styles.assetBadgeText, { color: colors.tint }]}>
                {`${item.assetQuantity} @ ${item.purchaseRate.toFixed(2)} ${itemCurrency.symbol}`}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.transactionRightBlock}>
          <ThemedText
            style={
              isIncome
                ? [styles.incomeAmount, { color: colors.income }]
                : [styles.expenseAmount, { color: colors.text }]
            }>
            {isIncome ? '+' : '-'}{itemCurrency.symbol}{Math.abs(item.amount).toFixed(2)}
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onDelete(item);
            }}
            style={[
              styles.deleteIconButton,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.04)',
              },
            ]}>
            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);
TransactionListItem.displayName = 'TransactionListItem';

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDark, colors, t } = useSettings();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [fiatMetalTickerData, setFiatMetalTickerData] = useState<string[]>([]);
  const [cryptoTickerData, setCryptoTickerData] = useState<string[]>([]);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  const dateFilteredTransactions = useMemo(() => {
    const now = new Date();
    if (selectedDateFilter === 'all') {
      return transactions;
    }
    let startDate: Date;
    switch (selectedDateFilter) {
      case 'thisWeek':
        startDate = new Date();
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'thisMonth':
        startDate = new Date();
        startDate.setDate(1);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return transactions;
    }
    startDate.setHours(0, 0, 0, 0);
    return transactions.filter((t) => t.date && t.date >= startDate);
  }, [transactions, selectedDateFilter]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    if (!rates) return { totalIncome: 0, totalExpense: 0, balance: 0 };
    return transactions.reduce(
      (acc, curr) => {
        const rate = rates[curr.currency] || 1;
        const amountInTRY = curr.amount * rate;
        if (curr.type === 'income') {
          acc.totalIncome += amountInTRY;
        } else {
          acc.totalExpense += amountInTRY;
        }
        acc.balance = acc.totalIncome + acc.totalExpense;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [transactions, rates]);

  useEffect(() => {
    const fetchRates = async () => {
      const FALLBACK_MESSAGE = 'Canlı piyasa verileri geçici olarak devre dışı';
      try {
        const fetchedRates = await getExchangeRates();
        if (!fetchedRates || Object.keys(fetchedRates).length <= 1) {
          setRates({});
          setFiatMetalTickerData([FALLBACK_MESSAGE]);
          setCryptoTickerData([FALLBACK_MESSAGE]);
          return;
        }

        setRates(fetchedRates);

        const fiatMetalItems = [
          { code: 'USD', name: 'USD' },
          { code: 'EUR', name: 'EUR' },
          { code: 'GBP', name: 'POUND' },
          { code: 'XAU_GRAM', name: 'GOLD' },
          { code: 'XAG_GRAM', name: 'SILVER' },
        ];

        const cryptoItems = [
          { code: 'BTC', name: 'BTC' },
          { code: 'ETH', name: 'ETH' },
          { code: 'XRP', name: 'XRP' },
        ];

        const formatData = (items: { code: string; name: string }[]) =>
          items
            .filter((item) => fetchedRates[item.code] && fetchedRates[item.code] > 0)
            .map((item) => {
              const rate = fetchedRates[item.code];
              const isCrypto = ['BTC', 'ETH', 'XRP'].includes(item.code);
              let formattedRate = '';
              if (isCrypto) {
                formattedRate = `₺${Math.round(rate).toLocaleString('tr-TR')}`;
              } else {
                const parts = rate.toFixed(2).split('.');
                const integerFormatted = Number(parts[0]).toLocaleString('tr-TR');
                formattedRate = `₺${integerFormatted},${parts[1]}`;
              }
              return `${item.name} ${formattedRate}`;
            });

        const formattedFiat = formatData(fiatMetalItems);
        const formattedCrypto = formatData(cryptoItems);

        setFiatMetalTickerData(
          formattedFiat.length > 0 ? formattedFiat : [FALLBACK_MESSAGE]
        );
        setCryptoTickerData(
          formattedCrypto.length > 0 ? formattedCrypto : [FALLBACK_MESSAGE]
        );
      } catch (error) {
        console.error('Error fetching rates:', error);
        setRates({});
        setFiatMetalTickerData([FALLBACK_MESSAGE]);
        setCryptoTickerData([FALLBACK_MESSAGE]);
      }
    };

    fetchRates();
    const intervalId = setInterval(fetchRates, 300000); // 5 minutes polling to respect API limits
    return () => clearInterval(intervalId);
  }, []);

  const runChecks = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // 1. Check Recurring Incomes
    try {
      const recurringQuery = query(collection(db, 'users', user.uid, 'recurringIncomes'));
      const querySnapshot = await getDocs(recurringQuery);
      for (const docSnap of querySnapshot.docs) {
        const recurring = docSnap.data();
        const lastAdded = recurring.lastAdded ? recurring.lastAdded.toDate() : null;
        const isDayDue = currentDay >= recurring.dayOfMonth;
        const notAddedThisMonth =
          !lastAdded || lastAdded.getMonth() !== currentMonth || lastAdded.getFullYear() !== currentYear;

        if (isDayDue && notAddedThisMonth) {
          const transactionDate = new Date(currentYear, currentMonth, recurring.dayOfMonth);
          await addDoc(collection(db, 'users', user.uid, 'transactions'), {
            amount: recurring.amount,
            category: recurring.category,
            currency: recurring.currency,
            description: `Recurring: ${recurring.category}`,
            type: 'income',
            date: Timestamp.fromDate(transactionDate),
          });
          await updateDoc(doc(db, 'users', user.uid, 'recurringIncomes', docSnap.id), {
            lastAdded: Timestamp.now(),
          });
        }
      }
    } catch (err) {
      console.error('Error auto-checking recurring incomes:', err);
    }

    // 2. Check Installments
    try {
      const installmentsQuery = query(collection(db, 'users', user.uid, 'installments'));
      const querySnapshot = await getDocs(installmentsQuery);
      for (const docSnap of querySnapshot.docs) {
        const inst = docSnap.data();
        if (inst.completed || (inst.remainingInstallments != null && inst.remainingInstallments <= 0)) {
          continue;
        }

        const lastCharged = inst.lastCharged ? inst.lastCharged.toDate() : null;
        const isDayDue = currentDay >= (inst.dueDay || 1);
        const notChargedThisMonth =
          !lastCharged || lastCharged.getMonth() !== currentMonth || lastCharged.getFullYear() !== currentYear;

        if (isDayDue && notChargedThisMonth) {
          const transactionDate = new Date(currentYear, currentMonth, inst.dueDay || currentDay);
          const nextPaid = (inst.paidInstallments || 0) + 1;
          const nextRemaining = (inst.remainingInstallments ?? inst.totalInstallments) - 1;

          await addDoc(collection(db, 'users', user.uid, 'transactions'), {
            amount: -Math.abs(inst.monthlyAmount),
            category: 'Debt',
            currency: inst.currency || 'TRY',
            description: `${inst.bank || 'Bank'} - ${inst.title} (${nextPaid}/${inst.totalInstallments}. Taksit)`,
            type: 'expense',
            date: Timestamp.fromDate(transactionDate),
          });

          await updateDoc(doc(db, 'users', user.uid, 'installments', docSnap.id), {
            paidInstallments: nextPaid,
            remainingInstallments: Math.max(0, nextRemaining),
            completed: nextRemaining <= 0,
            lastCharged: Timestamp.now(),
          });
        }
      }
    } catch (err) {
      console.error('Error auto-checking installments:', err);
    }

    // 3. Check Subscriptions
    try {
      const subsQuery = query(collection(db, 'users', user.uid, 'subscriptions'));
      const querySnapshot = await getDocs(subsQuery);
      for (const docSnap of querySnapshot.docs) {
        const sub = docSnap.data();
        if (sub.isActive === false) continue;

        const lastCharged = sub.lastCharged ? sub.lastCharged.toDate() : null;
        const dueDay = sub.dueDay || 1;
        const isDayDue = currentDay >= dueDay;

        let notChargedYet = false;
        if (sub.billingCycle === 'yearly') {
          notChargedYet = !lastCharged || lastCharged.getFullYear() !== currentYear;
        } else {
          notChargedYet =
            !lastCharged ||
            lastCharged.getMonth() !== currentMonth ||
            lastCharged.getFullYear() !== currentYear;
        }

        // Check if subscription was created in the current month AFTER the due day
        const createdDate = sub.createdAt ? sub.createdAt.toDate() : null;
        const createdThisMonthAfterDue =
          createdDate &&
          createdDate.getFullYear() === currentYear &&
          createdDate.getMonth() === currentMonth &&
          createdDate.getDate() > dueDay;

        // If today is due date (or past due date) and wasn't added after the due day this month
        if (isDayDue && notChargedYet && !createdThisMonthAfterDue) {
          const transactionDate = new Date(currentYear, currentMonth, dueDay);
          await addDoc(collection(db, 'users', user.uid, 'transactions'), {
            amount: -Math.abs(sub.amount),
            category: 'Subscriptions',
            currency: sub.currency || 'TRY',
            description: `${sub.name} (Abonelik Ödemesi)`,
            type: 'expense',
            date: Timestamp.fromDate(transactionDate),
          });

          await updateDoc(doc(db, 'users', user.uid, 'subscriptions', docSnap.id), {
            lastCharged: Timestamp.now(),
          });
        }
      }
    } catch (err) {
      console.error('Error auto-checking subscriptions:', err);
    }
  }, [user]);

  // Run auto checks whenever Home tab gains focus
  useFocusEffect(
    useCallback(() => {
      runChecks();
    }, [runChecks])
  );

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({
          ...data,
          id: doc.id,
          date: data.date.toDate(),
        } as Transaction);
      });
      setTransactions(transactionsData);
    });
    return () => unsubscribe();
  }, [user]);

  const handleDeleteTransaction = useCallback((item: Transaction) => {
    setTransactionToDelete(item);
  }, []);

  const handleConfirmDelete = async () => {
    if (!transactionToDelete || !user) return;
    const targetId = transactionToDelete.id;
    setTransactionToDelete(null);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', targetId));
      Toast.show({
        type: 'success',
        text1: 'İşlem Silindi',
        text2: 'Kayıt başarıyla kaldırıldı.',
        visibilityTime: 2500,
      });
    } catch (error) {
      console.error('Error deleting document: ', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'İşlem silinirken bir sorun oluştu.',
      });
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) {
      return dateFilteredTransactions;
    }
    return dateFilteredTransactions.filter(
      (transaction) => transaction.type === 'income' || transaction.category === selectedCategory
    );
  }, [dateFilteredTransactions, selectedCategory]);

  const selectedDateFilterLabel = dateFilters.find((f) => f.key === selectedDateFilter)?.label || 'All';

  const userGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const renderTransaction: ListRenderItem<Transaction> = useCallback(
    ({ item }) => (
      <TransactionListItem
        item={item}
        onDelete={handleDeleteTransaction}
        displayCurrency={displayCurrency}
        rate={rates ? rates[displayCurrency.code] || 1 : 1}
      />
    ),
    [handleDeleteTransaction, displayCurrency, rates]
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  // Format currency value based on current exchange rate
  const formatAmount = (amountInTRY: number) => {
    if (!rates) return '0.00';
    const rate = rates[displayCurrency.code] || 1;
    return (amountInTRY / rate).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Top Header Row */}
      <View style={styles.topHeader}>
        <View style={styles.userInfoBlock}>
          <ThemedText style={[styles.greetingText, { color: colors.textSecondary }]}>{userGreeting}</ThemedText>
          <ThemedText style={[styles.userNameText, { color: colors.text }]}>
            {user?.email ? user.email.split('@')[0] : 'My Portfolio'}
          </ThemedText>
        </View>

        {user && (
          <AnimatedPressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setIsSettingsModalVisible(true);
            }}
            style={[styles.authBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons
              name="settings-outline"
              size={19}
              color={colors.tint}
            />
          </AnimatedPressable>
        )}
      </View>

      {/* Live Market Tickers */}
      <View style={styles.tickerStack}>
        {fiatMetalTickerData.length > 0 && (
          <Ticker key={`fiat-${fiatMetalTickerData.join()}`} data={fiatMetalTickerData} badgeLabel="MARKETS" />
        )}
        {cryptoTickerData.length > 0 && (
          <Ticker key={`crypto-${cryptoTickerData.join()}`} data={cryptoTickerData} badgeLabel="CRYPTO" />
        )}
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <>
            {/* Hero Net Worth Balance Card */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.shadow.shadowColor,
                  shadowOpacity: colors.shadow.shadowOpacity,
                },
              ]}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTitleWithDot}>
                  <View style={[styles.neonDot, { backgroundColor: colors.tint }]} />
                  <ThemedText style={[styles.heroCardLabel, { color: colors.textSecondary }]}>
                    TOTAL BALANCE
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.trendBadge,
                    { backgroundColor: balance >= 0 ? colors.incomeSoft : colors.expenseSoft },
                  ]}>
                  <Ionicons
                    name={balance >= 0 ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={balance >= 0 ? colors.income : colors.expense}
                  />
                  <ThemedText
                    style={[styles.trendText, { color: balance >= 0 ? colors.income : colors.expense }]}>
                    {balance >= 0 ? 'Net Positive' : 'Deficit'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroAmountRow}>
                <ThemedText style={[styles.heroCurrencySymbol, { color: colors.tint }]}>
                  {balance < 0 ? `-${displayCurrency.symbol}` : displayCurrency.symbol}
                </ThemedText>
                <ThemedText
                  style={[styles.heroAmountText, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}>
                  {formatAmount(Math.abs(balance))}
                </ThemedText>
              </View>

              {/* Integrated Currency Switcher */}
              <View
                style={[
                  styles.currencyPillGroup,
                  { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight },
                ]}>
                {currencies.map((c) => {
                  const isActive = displayCurrency.code === c.code;
                  return (
                    <AnimatedPressable
                      key={c.code}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => { });
                        setDisplayCurrency(c);
                      }}
                      style={[
                        styles.currencyPill,
                        isActive && [
                          styles.currencyPillActive,
                          {
                            backgroundColor: isDark ? '#26282E' : '#FFFFFF',
                            borderColor: colors.tint,
                          },
                        ],
                      ]}>
                      <ThemedText
                        style={[
                          styles.currencyPillText,
                          { color: colors.textSecondary },
                          isActive && { color: colors.tint, fontWeight: '800' },
                        ]}>
                        {c.label}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Income & Expense Split Cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIconBadgeGreen, { backgroundColor: colors.incomeSoft }]}>
                  <Ionicons name="arrow-down" size={16} color={colors.income} />
                </View>
                <View style={styles.statTextGroup}>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Income</ThemedText>
                  <ThemedText style={[styles.statAmountIncome, { color: colors.income }]}>
                    +{displayCurrency.symbol}{formatAmount(totalIncome)}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIconBadgeRed, { backgroundColor: colors.expenseSoft }]}>
                  <Ionicons name="arrow-up" size={16} color={colors.expense} />
                </View>
                <View style={styles.statTextGroup}>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Expenses</ThemedText>
                  <ThemedText style={[styles.statAmountExpense, { color: colors.expense }]}>
                    -{displayCurrency.symbol}{formatAmount(Math.abs(totalExpense))}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Filter Section */}
            <View style={styles.filtersRow}>
              <AnimatedPressable
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedDateFilter !== 'all' && {
                    borderColor: colors.tint,
                    backgroundColor: colors.tintSoft,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => { });
                  setDateModalVisible(true);
                }}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={selectedDateFilter !== 'all' ? colors.tint : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: colors.text },
                    selectedDateFilter !== 'all' && { color: colors.tint },
                  ]}
                  numberOfLines={1}>
                  {selectedDateFilterLabel}
                </ThemedText>
                <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
              </AnimatedPressable>

              <AnimatedPressable
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedCategory != null && {
                    borderColor: colors.tint,
                    backgroundColor: colors.tintSoft,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => { });
                  setCategoryModalVisible(true);
                }}>
                <Ionicons
                  name="pricetag-outline"
                  size={15}
                  color={selectedCategory != null ? colors.tint : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: colors.text },
                    selectedCategory != null && { color: colors.tint },
                  ]}
                  numberOfLines={1}>
                  {selectedCategory || 'All Categories'}
                </ThemedText>
                <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
              </AnimatedPressable>
            </View>

            {/* Transactions Section Header */}
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={[styles.sectionHeading, { color: colors.text }]}>Recent Transactions</ThemedText>
              <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                <ThemedText style={[styles.countBadgeText, { color: colors.tint }]}>{filteredTransactions.length}</ThemedText>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Transactions Found</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tap the &apos;+&apos; button in the bottom bar to add your first income or expense.
            </ThemedText>
          </View>
        }
      />

      {/* Date Filter Modal */}
      <SwipeableModal
        visible={isDateModalVisible}
        onClose={() => setDateModalVisible(false)}
        enableFullSheetDrag={true}
        sheetStyle={[
          styles.modalSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}>
        <ThemedText style={[styles.modalSheetTitle, { color: colors.text }]}>Select Time Range</ThemedText>
        {dateFilters.map((filter) => {
          const isSelected = selectedDateFilter === filter.key;
          return (
            <AnimatedPressable
              key={filter.key}
              style={[
                styles.modalItemRow,
                isSelected && [styles.modalItemRowActive, { backgroundColor: colors.tintSoft }],
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => { });
                setSelectedDateFilter(filter.key);
                setDateModalVisible(false);
              }}>
              <ThemedText
                style={[
                  styles.modalItemText,
                  { color: colors.text },
                  isSelected && [styles.modalItemTextActive, { color: colors.tint }],
                ]}>
                {filter.label}
              </ThemedText>
              {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.tint} />}
            </AnimatedPressable>
          );
        })}
      </SwipeableModal>

      {/* Category Filter Modal */}
      <SwipeableModal
        visible={isCategoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
        sheetStyle={[
          styles.modalSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            maxHeight: '75%',
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}>
        <ThemedText style={[styles.modalSheetTitle, { color: colors.text }]}>Filter by Category</ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          <AnimatedPressable
            style={[
              styles.modalItemRow,
              selectedCategory === null && [styles.modalItemRowActive, { backgroundColor: colors.tintSoft }],
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => { });
              setSelectedCategory(null);
              setCategoryModalVisible(false);
            }}>
            <View style={styles.modalCategoryLeft}>
              <Ionicons
                name="apps-outline"
                size={20}
                color={selectedCategory === null ? colors.tint : colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.modalItemText,
                  { color: colors.text },
                  selectedCategory === null && [styles.modalItemTextActive, { color: colors.tint }],
                ]}>
                All Categories
              </ThemedText>
            </View>
            {selectedCategory === null && <Ionicons name="checkmark-circle" size={20} color={colors.tint} />}
          </AnimatedPressable>

          {expenseCategories.map((cat) => {
            const isSelected = selectedCategory === cat.label;
            return (
              <AnimatedPressable
                key={cat.key}
                style={[
                  styles.modalItemRow,
                  isSelected && [styles.modalItemRowActive, { backgroundColor: colors.tintSoft }],
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => { });
                  setSelectedCategory(cat.label);
                  setCategoryModalVisible(false);
                }}>
                <View style={styles.modalCategoryLeft}>
                  <Ionicons
                    name={cat.icon}
                    size={20}
                    color={isSelected ? colors.tint : colors.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      { color: colors.text },
                      isSelected && [styles.modalItemTextActive, { color: colors.tint }],
                    ]}>
                    {cat.label}
                  </ThemedText>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.tint} />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </SwipeableModal>

      {/* Custom Mobile Delete Confirmation Bottom Sheet */}
      <SwipeableModal
        visible={transactionToDelete !== null}
        onClose={() => setTransactionToDelete(null)}
        enableFullSheetDrag={true}
        sheetStyle={[
          styles.modalSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}>
        <View style={styles.deleteModalHeader}>
          <View style={styles.deleteModalIconCircle}>
            <Ionicons name="trash-outline" size={26} color="#FF453A" />
          </View>
          <ThemedText style={[styles.deleteModalTitle, { color: colors.text }]}>İşlemi Sil</ThemedText>
          <ThemedText style={[styles.deleteModalSubtitle, { color: colors.textSecondary }]}>
            Bu işlem kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </ThemedText>
        </View>

        {transactionToDelete && (
          <View style={[styles.deletePreviewCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.deletePreviewLeft}>
              <View
                style={[
                  styles.deletePreviewIconCircle,
                  {
                    backgroundColor:
                      transactionToDelete.amount > 0
                        ? colors.incomeSoft
                        : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}>
                <Ionicons
                  name={getCategoryIcon(transactionToDelete.category, transactionToDelete.type)}
                  size={18}
                  color={transactionToDelete.amount > 0 ? colors.income : colors.tint}
                />
              </View>
              <View style={styles.deletePreviewTexts}>
                <ThemedText style={[styles.deletePreviewTitle, { color: colors.text }]} numberOfLines={1}>
                  {transactionToDelete.description || transactionToDelete.category}
                </ThemedText>
                <ThemedText style={[styles.deletePreviewCategory, { color: colors.textSecondary }]}>
                  {transactionToDelete.category}
                </ThemedText>
              </View>
            </View>
            <ThemedText
              style={
                transactionToDelete.amount > 0
                  ? [styles.incomeAmount, { color: colors.income }]
                  : [styles.expenseAmount, { color: colors.text }]
              }>
              {transactionToDelete.amount > 0 ? '+' : '-'}
              {currencies.find((c) => c.code === transactionToDelete.currency)?.symbol || transactionToDelete.currency}
              {Math.abs(transactionToDelete.amount).toFixed(2)}
            </ThemedText>
          </View>
        )}

        <View style={styles.deleteModalActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.deleteCancelBtn, { backgroundColor: colors.cardSecondary }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTransactionToDelete(null);
            }}>
            <ThemedText style={[styles.deleteCancelBtnText, { color: colors.text }]}>Vazgeç</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.deleteConfirmBtn}
            onPress={handleConfirmDelete}>
            <Ionicons name="trash" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
            <ThemedText style={styles.deleteConfirmBtnText}>Sil</ThemedText>
          </TouchableOpacity>
        </View>
      </SwipeableModal>

      {/* Settings Bottom Sheet Modal */}
      <SettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0E10',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  userInfoBlock: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F2F2F2',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  authBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickerStack: {
    gap: 6,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  neonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tint,
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9E9EA4',
    letterSpacing: 1,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'visible',
    minHeight: 48,
  },
  heroCurrencySymbol: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    color: Colors.tint,
    marginRight: 6,
    alignSelf: 'center',
  },
  heroAmountText: {
    flex: 1,
    fontSize: 38,
    lineHeight: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  currencyPillGroup: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#191A1F',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  statIconBadgeGreen: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconBadgeRed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextGroup: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  statAmountIncome: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.income,
    marginTop: 2,
  },
  statAmountExpense: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.expense,
    marginTop: 2,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191A1F',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  filterChipActive: {
    borderColor: 'rgba(57, 255, 20, 0.4)',
    backgroundColor: 'rgba(57, 255, 20, 0.05)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D1D6',
    flex: 1,
    marginHorizontal: 6,
  },
  filterChipTextActive: {
    color: Colors.tint,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 17,
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
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191A1F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F2F2F2',
  },
  transactionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  transactionCategoryTag: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 10,
    color: '#555',
    marginHorizontal: 5,
  },
  transactionDate: {
    fontSize: 11,
    color: '#6E6E73',
  },
  assetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  assetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.tint,
  },
  transactionRightBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  incomeAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.income,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E1F24',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D1D1D6',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6E6E73',
    textAlign: 'center',
    lineHeight: 18,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1A1B20',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3C3C40',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F2F2F2',
    marginBottom: 16,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemRowActive: {
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D1D1D6',
  },
  modalItemTextActive: {
    color: Colors.tint,
    fontWeight: '700',
  },
  modalCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  deleteModalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  deletePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141518',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  deletePreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  deletePreviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePreviewTexts: {
    flex: 1,
  },
  deletePreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deletePreviewCategory: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#26282E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E5E5EA',
  },
  deleteConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FF453A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});