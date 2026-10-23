import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { db } from '@/firebaseConfig';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';

interface RecurringIncome {
  id: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
  dayOfMonth: number;
}

export default function RecurringScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);

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

  const handleAddRecurringIncome = async () => {
    const numericAmount = parseFloat(amount.replace(',', '.'));
    const numericDay = parseInt(dayOfMonth, 10);

    if (!category || isNaN(numericAmount) || isNaN(numericDay) || numericDay < 1 || numericDay > 31) {
      Alert.alert('Incomplete Form', 'Please enter a valid source, amount, and day of month (between 1 and 31).');
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      await addDoc(collection(db, 'users', user.uid, 'recurringIncomes'), {
        amount: numericAmount,
        category,
        currency: transactionCurrency.code,
        dayOfMonth: numericDay,
        lastAdded: null,
      });

      setAmount('');
      setCategory('');
      setDayOfMonth('');
      setTransactionCurrency(defaultCurrency);
    } catch (error) {
      console.error('Error adding recurring income: ', error);
      Alert.alert('Error', 'Could not save the recurring income.');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Recurring Income', 'Are you sure you want to remove this recurring income stream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!user) throw new Error('User not authenticated');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await deleteDoc(doc(db, 'users', user.uid, 'recurringIncomes', id));
          } catch (error) {
            console.error('Error deleting recurring income: ', error);
            Alert.alert('Error', 'Could not delete the recurring income.');
          }
        },
      },
    ]);
  };

  const handleAmountChange = (text: string) => {
    const numericRegex = /^\d*([.,])?\d*$/;
    if (numericRegex.test(text) || text === '') {
      setAmount(text);
    }
  };

  const ListHeader = () => (
    <>
      <View style={styles.screenHeader}>
        <ThemedText style={styles.screenSubtitle}>AUTOMATED RECURRING STREAMS</ThemedText>
        <ThemedText style={styles.screenTitle}>Recurring</ThemedText>
      </View>

      {/* Add Recurring Income Card */}
      <View style={styles.formCard}>
        <View style={styles.formCardTitleRow}>
          <Ionicons name="calendar" size={16} color={Colors.tint} />
          <ThemedText style={styles.formCardTitle}>Add Recurring Income</ThemedText>
        </View>

        {/* Source Input */}
        <View style={styles.inputWrap}>
          <Ionicons name="briefcase-outline" size={18} color="#8E8E93" style={styles.inputIcon} />
          <TextInput
            placeholder="Income Source (e.g. Salary, Rent, Dividends)"
            value={category}
            onChangeText={setCategory}
            style={styles.textInput}
            placeholderTextColor="#636366"
          />
        </View>

        {/* Currency Switcher */}
        <View style={styles.currencyGroup}>
          {currencies.map((c) => {
            const isActive = transactionCurrency.code === c.code;
            return (
              <AnimatedPressable
                key={c.code}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTransactionCurrency(c);
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
          <View style={[styles.inputWrap, { flex: 1.2 }]}>
            <ThemedText style={styles.inputPrefix}>{transactionCurrency.symbol}</ThemedText>
            <TextInput
              placeholder="Amount (e.g. 35000)"
              value={amount}
              onChangeText={handleAmountChange}
              style={styles.textInput}
              keyboardType="numeric"
              placeholderTextColor="#636366"
            />
          </View>

          <View style={[styles.inputWrap, { flex: 1 }]}>
            <Ionicons name="today-outline" size={17} color="#8E8E93" style={styles.inputIcon} />
            <TextInput
              placeholder="Day (1-31)"
              value={dayOfMonth}
              onChangeText={setDayOfMonth}
              style={styles.textInput}
              keyboardType="number-pad"
              maxLength={2}
              placeholderTextColor="#636366"
            />
          </View>
        </View>

        {/* Add Button */}
        <AnimatedPressable style={styles.addButton} onPress={handleAddRecurringIncome}>
          <Ionicons name="add" size={20} color="#000" />
          <ThemedText style={styles.addButtonText}>Schedule Monthly Income</ThemedText>
        </AnimatedPressable>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <ThemedText style={styles.sectionTitle}>Active Scheduled Incomes</ThemedText>
        <View style={styles.countBadge}>
          <ThemedText style={styles.countBadgeText}>{recurringIncomes.length}</ThemedText>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={recurringIncomes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        renderItem={({ item }) => {
          const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };
          return (
            <View style={styles.recurringCard}>
              <View style={styles.dayCalendarBadge}>
                <ThemedText style={styles.dayBadgeLabel}>DAY</ThemedText>
                <ThemedText style={styles.dayBadgeNumber}>{item.dayOfMonth}</ThemedText>
              </View>

              <View style={styles.recurringCenter}>
                <ThemedText style={styles.recurringTitle}>{item.category}</ThemedText>
                <ThemedText style={styles.recurringSub}>
                  Deposits on the {item.dayOfMonth}th of each month
                </ThemedText>
              </View>

              <View style={styles.recurringRight}>
                <ThemedText style={styles.recurringAmount}>
                  +{itemCurrency.symbol}
                  {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
                <AnimatedPressable
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDelete(item.id)}
                  style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={17} color="#6E6E73" />
                </AnimatedPressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="repeat-outline" size={32} color="#555" />
            </View>
            <ThemedText style={styles.emptyTitle}>No Recurring Streams</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Add recurring salaries or passive income streams above to have them automatically recorded each month.
            </ThemedText>
          </View>
        }
      />
    </View>
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
    marginBottom: 16,
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
  formCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
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
    marginBottom: 16,
  },
  formCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F2F2F2',
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputPrefix: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.tint,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '500',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tint,
    borderRadius: 14,
    height: 48,
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
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dayBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.tint,
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
});