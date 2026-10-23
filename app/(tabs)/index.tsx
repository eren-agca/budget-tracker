import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  View,
  ListRenderItem,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { Ticker } from '@/components/Ticker';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { dateFilters } from '@/constants/DateFilters';
import { expenseCategories } from '@/constants/Categories';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';
import { db, auth } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  purchaseRate?: number;
  assetQuantity?: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
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
    onDelete: (id: string) => void;
    displayCurrency: Currency;
    rate: number;
  }) => {
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
      <View style={styles.transactionCard}>
        <View
          style={[
            styles.categoryIconCircle,
            { backgroundColor: isIncome ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 255, 255, 0.05)' },
          ]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isIncome ? Colors.income : Colors.tint}
          />
        </View>

        <View style={styles.transactionMainInfo}>
          <ThemedText style={styles.transactionTitle} numberOfLines={1}>
            {item.description || item.category}
          </ThemedText>
          <View style={styles.transactionMetaRow}>
            <ThemedText style={styles.transactionCategoryTag}>{item.category}</ThemedText>
            <ThemedText style={styles.metaDot}>•</ThemedText>
            <ThemedText style={styles.transactionDate}>{formatDate(item.date)}</ThemedText>
          </View>

          {item.category === 'Savings' && item.purchaseRate != null && item.assetQuantity != null && (
            <View style={styles.assetBadge}>
              <Ionicons name="sparkles" size={11} color={Colors.tint} />
              <ThemedText style={styles.assetBadgeText}>
                {`${item.assetQuantity} @ ${item.purchaseRate.toFixed(2)} ${itemCurrency.symbol}`}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.transactionRightBlock}>
          <ThemedText style={isIncome ? styles.incomeAmount : styles.expenseAmount}>
            {isIncome ? '+' : '-'}{itemCurrency.symbol}{Math.abs(item.amount).toFixed(2)}
          </ThemedText>
          <AnimatedPressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onDelete(item.id)}
            style={styles.deleteIconButton}>
            <Ionicons name="trash-outline" size={17} color="#6E6E73" />
          </AnimatedPressable>
        </View>
      </View>
    );
  }
);

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [fiatMetalTickerData, setFiatMetalTickerData] = useState<string[]>([]);
  const [cryptoTickerData, setCryptoTickerData] = useState<string[]>([]);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isDateModalVisible, setDateModalVisible] = useState(false);

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
      try {
        const fetchedRates = await getExchangeRates();
        if (!fetchedRates) {
          setRates({});
          setFiatMetalTickerData(['Rates updating...']);
          setCryptoTickerData([]);
          return;
        }

        setRates(fetchedRates);

        const fiatMetalItems = [
          { code: 'USD', name: 'USD' },
          { code: 'EUR', name: 'EUR' },
          { code: 'RUB', name: 'RUB' },
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
              const options: Intl.NumberFormatOptions = {
                style: 'currency',
                currency: 'TRY',
                minimumFractionDigits: isCrypto ? 0 : 2,
                maximumFractionDigits: isCrypto ? 0 : 2,
              };
              const formattedRate = new Intl.NumberFormat('tr-TR', options).format(rate);
              return `${item.name} ${formattedRate}`;
            });

        setFiatMetalTickerData(formatData(fiatMetalItems));
        setCryptoTickerData(formatData(cryptoItems));
      } catch (error) {
        console.error('Error fetching rates:', error);
        setRates({});
      }
    };

    fetchRates();
    const intervalId = setInterval(fetchRates, 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkRecurringIncomes = async () => {
      const recurringQuery = query(collection(db, 'users', user.uid, 'recurringIncomes'));
      const querySnapshot = await getDocs(recurringQuery);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      for (const docSnap of querySnapshot.docs) {
        const recurring = docSnap.data();
        const lastAdded = recurring.lastAdded ? recurring.lastAdded.toDate() : null;
        const isDayDue = today.getDate() >= recurring.dayOfMonth;
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
    };
    const timeoutId = setTimeout(checkRecurringIncomes, 3000);
    return () => clearTimeout(timeoutId);
  }, [user]);

  useEffect(() => {
    if (!user) return;
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

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            console.error('Error logging out: ', error);
          }
        },
      },
    ]);
  };

  const handleDeleteTransaction = useCallback(
    async (id: string) => {
      if (!user) return;
      Alert.alert('Delete Transaction', 'Are you sure you want to delete this record?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
            } catch (error) {
              console.error('Error deleting document: ', error);
            }
          },
        },
      ]);
    },
    [user]
  );

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Header Row */}
      <View style={styles.topHeader}>
        <View style={styles.userInfoBlock}>
          <ThemedText style={styles.greetingText}>{userGreeting}</ThemedText>
          <ThemedText style={styles.userNameText}>
            {user?.email ? user.email.split('@')[0] : 'My Portfolio'}
          </ThemedText>
        </View>

        {user && (
          <AnimatedPressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={user.isAnonymous ? () => router.push('/login') : handleLogout}
            style={styles.authBadge}>
            <Ionicons
              name={user.isAnonymous ? 'log-in-outline' : 'log-out-outline'}
              size={18}
              color={user.isAnonymous ? Colors.tint : '#FF453A'}
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
            <View style={styles.heroCard}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTitleWithDot}>
                  <View style={styles.neonDot} />
                  <ThemedText style={styles.heroCardLabel}>TOTAL BALANCE</ThemedText>
                </View>
                <View style={[styles.trendBadge, { backgroundColor: balance >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)' }]}>
                  <Ionicons
                    name={balance >= 0 ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={balance >= 0 ? Colors.income : Colors.expense}
                  />
                  <ThemedText style={[styles.trendText, { color: balance >= 0 ? Colors.income : Colors.expense }]}>
                    {balance >= 0 ? 'Net Positive' : 'Deficit'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroAmountRow}>
                <ThemedText style={styles.heroCurrencySymbol}>{displayCurrency.symbol}</ThemedText>
                <ThemedText style={styles.heroAmountText}>{formatAmount(balance)}</ThemedText>
              </View>

              {/* Integrated Currency Switcher */}
              <View style={styles.currencyPillGroup}>
                {currencies.map((c) => {
                  const isActive = displayCurrency.code === c.code;
                  return (
                    <AnimatedPressable
                      key={c.code}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setDisplayCurrency(c);
                      }}
                      style={[styles.currencyPill, isActive && styles.currencyPillActive]}>
                      <ThemedText style={[styles.currencyPillText, isActive && styles.currencyPillTextActive]}>
                        {c.code}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Income & Expense Split Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconBadgeGreen}>
                  <Ionicons name="arrow-down" size={16} color={Colors.income} />
                </View>
                <View style={styles.statTextGroup}>
                  <ThemedText style={styles.statLabel}>Income</ThemedText>
                  <ThemedText style={styles.statAmountIncome}>
                    +{displayCurrency.symbol}{formatAmount(totalIncome)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconBadgeRed}>
                  <Ionicons name="arrow-up" size={16} color={Colors.expense} />
                </View>
                <View style={styles.statTextGroup}>
                  <ThemedText style={styles.statLabel}>Expenses</ThemedText>
                  <ThemedText style={styles.statAmountExpense}>
                    -{displayCurrency.symbol}{formatAmount(Math.abs(totalExpense))}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Filter Section */}
            <View style={styles.filtersRow}>
              <AnimatedPressable
                style={[styles.filterChip, selectedDateFilter !== 'all' && styles.filterChipActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDateModalVisible(true);
                }}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={selectedDateFilter !== 'all' ? Colors.tint : '#8E8E93'}
                />
                <ThemedText
                  style={[styles.filterChipText, selectedDateFilter !== 'all' && styles.filterChipTextActive]}
                  numberOfLines={1}>
                  {selectedDateFilterLabel}
                </ThemedText>
                <Ionicons name="chevron-down" size={13} color="#8E8E93" />
              </AnimatedPressable>

              <AnimatedPressable
                style={[styles.filterChip, selectedCategory != null && styles.filterChipActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCategoryModalVisible(true);
                }}>
                <Ionicons
                  name="pricetag-outline"
                  size={15}
                  color={selectedCategory != null ? Colors.tint : '#8E8E93'}
                />
                <ThemedText
                  style={[styles.filterChipText, selectedCategory != null && styles.filterChipTextActive]}
                  numberOfLines={1}>
                  {selectedCategory || 'All Categories'}
                </ThemedText>
                <Ionicons name="chevron-down" size={13} color="#8E8E93" />
              </AnimatedPressable>
            </View>

            {/* Transactions Section Header */}
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionHeading}>Recent Transactions</ThemedText>
              <View style={styles.countBadge}>
                <ThemedText style={styles.countBadgeText}>{filteredTransactions.length}</ThemedText>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={32} color="#555" />
            </View>
            <ThemedText style={styles.emptyTitle}>No Transactions Found</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Tap the green '+' button below to add your first income or expense.
            </ThemedText>
          </View>
        }
      />

      {/* Floating Action Button (FAB) in Thumb Zone */}
      <AnimatedPressable
        style={[styles.fab, { bottom: insets.bottom + 84 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push('/add-transaction');
        }}>
        <Ionicons name="add" size={30} color="#000" />
      </AnimatedPressable>

      {/* Date Filter Modal */}
      <Modal
        transparent={true}
        visible={isDateModalVisible}
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <ThemedText style={styles.modalSheetTitle}>Select Time Range</ThemedText>
            {dateFilters.map((filter) => {
              const isSelected = selectedDateFilter === filter.key;
              return (
                <AnimatedPressable
                  key={filter.key}
                  style={[styles.modalItemRow, isSelected && styles.modalItemRowActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedDateFilter(filter.key);
                    setDateModalVisible(false);
                  }}>
                  <ThemedText style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                    {filter.label}
                  </ThemedText>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.tint} />}
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Category Filter Modal */}
      <Modal
        transparent={true}
        visible={isCategoryModalVisible}
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '75%' }]}>
            <View style={styles.sheetHandle} />
            <ThemedText style={styles.modalSheetTitle}>Filter by Category</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AnimatedPressable
                style={[styles.modalItemRow, selectedCategory === null && styles.modalItemRowActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedCategory(null);
                  setCategoryModalVisible(false);
                }}>
                <View style={styles.modalCategoryLeft}>
                  <Ionicons name="apps-outline" size={20} color={selectedCategory === null ? Colors.tint : '#8E8E93'} />
                  <ThemedText style={[styles.modalItemText, selectedCategory === null && styles.modalItemTextActive]}>
                    All Categories
                  </ThemedText>
                </View>
                {selectedCategory === null && <Ionicons name="checkmark-circle" size={20} color={Colors.tint} />}
              </AnimatedPressable>

              {expenseCategories.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <AnimatedPressable
                    key={cat.key}
                    style={[styles.modalItemRow, isSelected && styles.modalItemRowActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedCategory(cat.label);
                      setCategoryModalVisible(false);
                    }}>
                    <View style={styles.modalCategoryLeft}>
                      <Ionicons name={cat.icon} size={20} color={isSelected ? Colors.tint : '#8E8E93'} />
                      <ThemedText style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>
                        {cat.label}
                      </ThemedText>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.tint} />}
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'baseline',
    marginBottom: 16,
  },
  heroCurrencySymbol: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.tint,
    marginRight: 4,
  },
  heroAmountText: {
    fontSize: 36,
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
    padding: 4,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 99,
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
});