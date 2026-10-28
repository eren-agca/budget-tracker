import { collection, onSnapshot, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { analyzeTransactionsWithGemini } from '@/services/geminiService';
import { expenseCategories } from '@/constants/Categories';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  type: 'income' | 'expense';
  date: any;
}

interface BreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: any;
}

interface PieChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

const PALETTE = [
  '#39FF14', // Neon Green
  '#2DD4BF', // Teal
  '#60A5FA', // Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F87171', // Coral Red
];

export default function ExploreScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  const chartAnimationProgress = useSharedValue(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(query(collection(db, 'users', user.uid, 'transactions')), (snapshot) => {
      const transactionsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(transactionsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchRates = async () => {
      const fetchedRates = await getExchangeRates();
      setRates(fetchedRates);
    };
    fetchRates();
  }, []);

  // Compute breakdown list and chart data for selected type
  const { breakdownList, chartData, totalSum } = useMemo(() => {
    if (!rates || transactions.length === 0 || !rates[displayCurrency.code]) {
      return { breakdownList: [], chartData: [], totalSum: 0 };
    }

    const filtered = transactions.filter((t) => t.type === activeTab);
    if (filtered.length === 0) {
      return { breakdownList: [], chartData: [], totalSum: 0 };
    }

    const categoryMap: Record<string, number> = {};
    let totalInTRY = 0;

    filtered.forEach((curr) => {
      const category = curr.category || 'Other';
      const rate = rates[curr.currency] || 1;
      const amountInTRY = Math.abs(curr.amount) * rate;
      categoryMap[category] = (categoryMap[category] || 0) + amountInTRY;
      totalInTRY += amountInTRY;
    });

    const displayRate = rates[displayCurrency.code] || 1;
    const totalInDisplay = totalInTRY / displayRate;

    const sortedCategories = Object.keys(categoryMap).sort(
      (a, b) => categoryMap[b] - categoryMap[a]
    );

    const list: BreakdownItem[] = [];
    const chart: PieChartData[] = [];

    sortedCategories.forEach((cat, index) => {
      const catAmountDisplay = categoryMap[cat] / displayRate;
      const percentage = totalInDisplay > 0 ? (catAmountDisplay / totalInDisplay) * 100 : 0;
      const color = PALETTE[index % PALETTE.length];

      const matchIcon = expenseCategories.find(
        (c) => c.label.toLowerCase() === cat.toLowerCase() || c.key.toLowerCase() === cat.toLowerCase()
      );
      const icon = matchIcon?.icon || (activeTab === 'income' ? 'cash-outline' : 'pricetag-outline');

      list.push({
        category: cat,
        amount: catAmountDisplay,
        percentage,
        color,
        icon,
      });

      chart.push({
        name: cat,
        population: catAmountDisplay,
        color,
        legendFontColor: Colors.text,
        legendFontSize: 12,
      });
    });

    return { breakdownList: list, chartData: chart, totalSum: totalInDisplay };
  }, [transactions, rates, displayCurrency, activeTab]);

  useEffect(() => {
    if (!loading) {
      chartAnimationProgress.value = 0;
      chartAnimationProgress.value = withTiming(1, { duration: 500 });
    }
  }, [loading, activeTab]);

  const animatedChartStyle = useAnimatedStyle(() => ({
    opacity: chartAnimationProgress.value,
    transform: [{ scale: 0.95 + chartAnimationProgress.value * 0.05 }],
  }));

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const result = await analyzeTransactionsWithGemini(transactions);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.screenSubtitle}>FINANCIAL ANALYTICS</ThemedText>
            <ThemedText style={styles.screenTitle}>Insights</ThemedText>
          </View>

          {/* Currency Switcher */}
          <View style={styles.currencyPillsMini}>
            {currencies.map((c) => {
              const isActive = displayCurrency.code === c.code;
              return (
                <AnimatedPressable
                  key={c.code}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDisplayCurrency(c);
                  }}
                  style={[styles.currencyPillMini, isActive && styles.currencyPillMiniActive]}>
                  <ThemedText style={[styles.currencyPillMiniText, isActive && styles.currencyPillMiniTextActive]}>
                    {c.label}
                  </ThemedText>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Expenses / Income Segmented Switcher */}
        <View style={styles.segmentedControl}>
          <AnimatedPressable
            style={[styles.segmentButton, activeTab === 'expense' && styles.segmentButtonActiveExpense]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('expense');
            }}>
            <Ionicons
              name="arrow-up"
              size={14}
              color={activeTab === 'expense' ? '#FFF' : '#8E8E93'}
            />
            <ThemedText style={[styles.segmentButtonText, activeTab === 'expense' && styles.segmentButtonTextActive]}>
              Expenses
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.segmentButton, activeTab === 'income' && styles.segmentButtonActiveIncome]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('income');
            }}>
            <Ionicons
              name="arrow-down"
              size={14}
              color={activeTab === 'income' ? '#000' : '#8E8E93'}
            />
            <ThemedText
              style={[
                styles.segmentButtonText,
                activeTab === 'income' && { color: '#000', fontWeight: '800' },
              ]}>
              Income
            </ThemedText>
          </AnimatedPressable>
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <ThemedText style={styles.chartCardTitle}>
              {activeTab === 'expense' ? 'Spending Breakdown' : 'Income Breakdown'}
            </ThemedText>
            <ThemedText style={activeTab === 'expense' ? styles.totalExpenseText : styles.totalIncomeText}>
              {displayCurrency.symbol}
              {totalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator size="large" color={Colors.tint} />
            </View>
          ) : chartData.length > 0 ? (
            <Animated.View style={[styles.chartContainer, animatedChartStyle]}>
              <PieChart
                data={chartData}
                width={screenWidth - 64}
                height={200}
                chartConfig={{
                  backgroundGradientFrom: 'transparent',
                  backgroundGradientTo: 'transparent',
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                center={[screenWidth / 4 - 30, 0]}
                hasLegend={false}
              />
            </Animated.View>
          ) : (
            <View style={styles.chartPlaceholder}>
              <Ionicons name="pie-chart-outline" size={40} color="#444" />
              <ThemedText style={styles.noDataText}>
                No {activeTab} data available to display chart.
              </ThemedText>
            </View>
          )}
        </View>

        {/* Detailed Category Rows with Progress Bars */}
        {breakdownList.length > 0 && (
          <View style={styles.breakdownSection}>
            <ThemedText style={styles.breakdownHeading}>Top Categories</ThemedText>
            {breakdownList.map((item) => (
              <View key={item.category} style={styles.breakdownRow}>
                <View style={[styles.categoryIconWrap, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>

                <View style={styles.breakdownCenter}>
                  <View style={styles.breakdownTitleRow}>
                    <ThemedText style={styles.breakdownCategoryName}>{item.category}</ThemedText>
                    <ThemedText style={styles.breakdownAmount}>
                      {displayCurrency.symbol}
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </ThemedText>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>

                  <ThemedText style={styles.breakdownPercentText}>{item.percentage.toFixed(1)}%</ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* AI Financial Analysis Card */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardTop}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={16} color={Colors.tint} />
              <ThemedText style={styles.aiBadgeText}>AI FINANCIAL ASSISTANT</ThemedText>
            </View>

            <AnimatedPressable
              style={styles.aiAnalyzeButton}
              onPress={handleAnalysis}
              disabled={isAnalyzing}>
              {isAnalyzing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="flash" size={14} color="#000" />
                  <ThemedText style={styles.aiAnalyzeButtonText}>Analyze</ThemedText>
                </>
              )}
            </AnimatedPressable>
          </View>

          <ThemedText style={styles.aiCardDescription}>
            Get intelligent insights, anomaly detection, and smart budget advice powered by Google Gemini.
          </ThemedText>

          {analysis && (
            <View style={styles.analysisBox}>
              <ThemedText style={styles.analysisResultText}>{analysis}</ThemedText>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0E10',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  currencyPillsMini: {
    flexDirection: 'row',
    backgroundColor: '#191A1F',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  currencyPillMini: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  currencyPillMiniActive: {
    backgroundColor: '#26282E',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.4)',
  },
  currencyPillMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  currencyPillMiniTextActive: {
    color: Colors.tint,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#18191E',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  segmentButtonActiveExpense: {
    backgroundColor: '#26282E',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  segmentButtonActiveIncome: {
    backgroundColor: Colors.tint,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 18,
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
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  chartCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9E9EA4',
    letterSpacing: 0.3,
  },
  totalExpenseText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.expense,
  },
  totalIncomeText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.income,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  chartPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noDataText: {
    fontSize: 13,
    color: '#6E6E73',
  },
  breakdownSection: {
    marginBottom: 20,
  },
  breakdownHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191A1F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  breakdownCenter: {
    flex: 1,
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownCategoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F2F2F2',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownPercentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  aiCard: {
    backgroundColor: '#191A1F',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
    marginBottom: 24,
  },
  aiCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 0.8,
  },
  aiAnalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 5,
  },
  aiAnalyzeButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  aiCardDescription: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
  },
  analysisBox: {
    backgroundColor: '#121215',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  analysisResultText: {
    fontSize: 13,
    color: '#D1D1D6',
    lineHeight: 20,
  },
});