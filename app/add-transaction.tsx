import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { expenseCategories } from '@/constants/Categories';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

const INCOME_SHORTCUTS = [
  { label: 'Salary', icon: 'cash-outline' },
  { label: 'Freelance', icon: 'laptop-outline' },
  { label: 'Investment', icon: 'trending-up-outline' },
  { label: 'Gift', icon: 'gift-outline' },
  { label: 'Rental', icon: 'key-outline' },
  { label: 'Other', icon: 'apps-outline' },
];

export default function AddTransactionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(false);

  const handleTypeChange = (newType: 'expense' | 'income') => {
    Haptics.selectionAsync().catch(() => {});
    setType(newType);
    setCategory('');
    setPurchaseRate('');
  };

  const handleSaveTransaction = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }

    const isExpense = type === 'expense';
    const isSavings = isExpense && category === 'Savings';
    const savingsFieldsValid = !isSavings || purchaseRate;

    if ((isExpense && !description) || !amount || !category || !savingsFieldsValid) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields.');
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number for the amount.');
      return;
    }

    const numericPurchaseRate = parseFloat(purchaseRate.replace(',', '.'));
    if (isSavings && (isNaN(numericPurchaseRate) || numericPurchaseRate <= 0)) {
      Alert.alert('Invalid Rate', 'Please enter a valid number for the purchase rate.');
      return;
    }

    setLoading(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const totalCost = isSavings ? numericAmount * numericPurchaseRate : numericAmount;

      const transactionData: any = {
        description: isExpense ? description : category,
        amount: isExpense ? -Math.abs(totalCost) : Math.abs(totalCost),
        category,
        currency: transactionCurrency.code,
        type,
        date: Timestamp.now(),
      };

      if (isSavings) {
        transactionData.purchaseRate = numericPurchaseRate;
        transactionData.assetQuantity = numericAmount;
      }

      await addDoc(collection(db, 'users', user.uid, 'transactions'), transactionData);

      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: `${type === 'expense' ? 'Expense' : 'Income'} recorded successfully.`,
      });

      router.back();
    } catch (error) {
      console.error('Error adding document: ', error);
      Alert.alert('Error', 'An error occurred while saving the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (text: string) => {
    if (text.length > 12) return;
    const numericRegex = /^\d*([.,]\d{0,2})?$/;
    if (numericRegex.test(text) || text === '') {
      setAmount(text);
    }
  };

  const handleRateChange = (text: string) => {
    if (text.length > 12) return;
    const numericRegex = /^\d*([.,]\d{0,2})?$/;
    if (numericRegex.test(text) || text === '') {
      setPurchaseRate(text);
    }
  };

  const isSavings = type === 'expense' && category === 'Savings';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { paddingTop: insets.top }]}>
      
      {/* Modal Navigation Bar */}
      <View style={styles.navBar}>
        <AnimatedPressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => router.back()}
          style={styles.closeButton}>
          <Ionicons name="close" size={22} color="#D1D1D6" />
        </AnimatedPressable>
        <ThemedText style={styles.navTitle}>New Transaction</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        
        {/* Segmented Type Toggle (Expense / Income) */}
        <View style={styles.typeSwitcher}>
          <AnimatedPressable
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
            onPress={() => handleTypeChange('expense')}>
            <Ionicons name="arrow-up" size={15} color={type === 'expense' ? '#FFF' : '#8E8E93'} />
            <ThemedText style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
              Expense
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
            onPress={() => handleTypeChange('income')}>
            <Ionicons name="arrow-down" size={15} color={type === 'income' ? '#000' : '#8E8E93'} />
            <ThemedText
              style={[
                styles.typeButtonText,
                type === 'income' && { color: '#000', fontWeight: '800' },
              ]}>
              Income
            </ThemedText>
          </AnimatedPressable>
        </View>

        {/* Hero Amount Display & Input Card */}
        <View style={styles.amountCard}>
          <ThemedText style={styles.amountLabel}>ENTER AMOUNT</ThemedText>
          <View style={styles.amountRow}>
            <ThemedText style={styles.currencySymbolLarge}>{transactionCurrency.symbol}</ThemedText>
            <TextInput
              placeholder="0.00"
              value={amount}
              onChangeText={handleAmountChange}
              style={styles.amountInput}
              keyboardType="numeric"
              maxLength={12}
              placeholderTextColor="#444"
              autoFocus={true}
            />
          </View>

          {/* Currency Pill Selector */}
          <View style={styles.currencyPills}>
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
                    {c.label}
                  </ThemedText>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Description Field (For Expense) */}
        {type === 'expense' && (
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Ionicons name="create-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
              <TextInput
                placeholder={isSavings ? "Asset Name (e.g. Gold Gram, Silver)" : "Description (e.g. Groceries at Market)"}
                value={description}
                onChangeText={setDescription}
                style={styles.fieldInput}
                maxLength={60}
                placeholderTextColor="#636366"
              />
            </View>
          </View>
        )}

        {/* Savings Special Fields */}
        {isSavings && (
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Ionicons name="pricetag-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
              <TextInput
                placeholder={`Purchase Rate (e.g. 1 Unit = 4180 ${transactionCurrency.symbol})`}
                value={purchaseRate}
                onChangeText={handleRateChange}
                style={styles.fieldInput}
                keyboardType="numeric"
                placeholderTextColor="#636366"
              />
            </View>
          </View>
        )}

        {/* Categories Section */}
        <View style={styles.sectionWrap}>
          <ThemedText style={styles.sectionTitle}>
            {type === 'expense' ? 'Select Category' : 'Income Source'}
          </ThemedText>

          {type === 'expense' ? (
            <View style={styles.categoryGrid}>
              {expenseCategories.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <AnimatedPressable
                    key={cat.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCategory(cat.label);
                    }}
                    style={[styles.categoryTile, isSelected && styles.categoryTileActive]}>
                    <View
                      style={[
                        styles.categoryIconCircle,
                        isSelected && { backgroundColor: 'rgba(57, 255, 20, 0.2)' },
                      ]}>
                      <Ionicons
                        name={cat.icon}
                        size={20}
                        color={isSelected ? Colors.tint : '#A1A1A6'}
                      />
                    </View>
                    <ThemedText
                      style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}
                      numberOfLines={1}>
                      {cat.label}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>
          ) : (
            <>
              {/* Income Shortcut Chips */}
              <View style={styles.incomeShortcuts}>
                {INCOME_SHORTCUTS.map((item) => {
                  const isSelected = category === item.label;
                  return (
                    <AnimatedPressable
                      key={item.label}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCategory(item.label);
                      }}
                      style={[styles.shortcutChip, isSelected && styles.shortcutChipActive]}>
                      <Ionicons
                        name={item.icon as any}
                        size={15}
                        color={isSelected ? Colors.tint : '#8E8E93'}
                      />
                      <ThemedText style={[styles.shortcutText, isSelected && styles.shortcutTextActive]}>
                        {item.label}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* Or custom income source text */}
              <View style={[styles.inputCard, { marginTop: 12 }]}>
                <View style={styles.inputRow}>
                  <Ionicons name="pencil-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                  <TextInput
                    placeholder="Or type custom source (e.g. Dividend)"
                    value={category}
                    onChangeText={setCategory}
                    style={styles.fieldInput}
                    placeholderTextColor="#636366"
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Primary Save Button */}
        <AnimatedPressable
          style={[styles.saveButton, loading && { opacity: 0.7 }]}
          onPress={handleSaveTransaction}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#000" />
              <ThemedText style={styles.saveButtonText}>
                {`Save ${type === 'expense' ? 'Expense' : 'Income'}`}
              </ThemedText>
            </>
          )}
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0E10',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1F24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#18191E',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  typeButtonActiveExpense: {
    backgroundColor: '#26282E',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  typeButtonActiveIncome: {
    backgroundColor: Colors.tint,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  amountCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  currencySymbolLarge: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.tint,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    minWidth: 120,
    textAlign: 'center',
  },
  currencyPills: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    width: '100%',
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
  inputCard: {
    backgroundColor: '#191A1F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    marginRight: 10,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#A1A1A6',
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryTile: {
    width: '22.5%',
    aspectRatio: 1,
    backgroundColor: '#191A1F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  categoryTileActive: {
    borderColor: Colors.tint,
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#141416',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: Colors.tint,
    fontWeight: '700',
  },
  incomeShortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191A1F',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 6,
  },
  shortcutChipActive: {
    borderColor: Colors.tint,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  shortcutTextActive: {
    color: Colors.tint,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tint,
    borderRadius: 16,
    height: 54,
    gap: 8,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.2,
  },
});