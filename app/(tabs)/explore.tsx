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
import { useSettings } from '@/context/SettingsContext';
import { analyzeTransactionsWithGemini } from '@/services/geminiService';
import { expenseCategories, getCategoryLabel } from '@/constants/Categories';

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
  const { colors, isDark, t, language } = useSettings();

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
        (c) =>
          c.label.toLowerCase() === cat.toLowerCase() ||
          c.key.toLowerCase() === cat.toLowerCase() ||
          c.labelTr.toLowerCase() === cat.toLowerCase() ||
          c.labelEn.toLowerCase() === cat.toLowerCase()
      );
      const icon = matchIcon?.icon || (activeTab === 'income' ? 'cash-outline' : 'pricetag-outline');
      const localizedCategory = getCategoryLabel(cat, language);

      list.push({
        category: localizedCategory,
        amount: catAmountDisplay,
        percentage,
        color,
        icon,
      });

      chart.push({
        name: localizedCategory,
        population: catAmountDisplay,
        color,
        legendFontColor: colors.text,
        legendFontSize: 12,
      });
    });

    return { breakdownList: list, chartData: chart, totalSum: totalInDisplay };
  }, [transactions, rates, displayCurrency, activeTab, colors.text, language]);

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
    const result = await analyzeTransactionsWithGemini(transactions, language);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={[styles.screenSubtitle, { color: colors.textSecondary }]}>{t('analyticsSubtitle')}</ThemedText>
            <ThemedText style={[styles.screenTitle, { color: colors.text }]}>{t('analyticsTitle')}</ThemedText>
          </View>

          {/* Currency Switcher */}
          <View style={[styles.currencyPillsMini, { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }]}>
            {currencies.map((c) => {
              const isActive = displayCurrency.code === c.code;
              return (
                <AnimatedPressable
                  key={c.code}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDisplayCurrency(c);
                  }}
                  style={[
                    styles.currencyPillMini,
                    isActive && [
                      styles.currencyPillMiniActive,
                      {
                        backgroundColor: isDark ? '#26282E' : '#FFFFFF',
                        borderColor: colors.tint,
                      },
                    ],
                  ]}>
                  <ThemedText
                    style={[
                      styles.currencyPillMiniText,
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

        {/* Expenses / Income Segmented Switcher */}
        <View style={[styles.segmentedControl, { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }]}>
          <AnimatedPressable
            style={[
              styles.segmentButton,
              activeTab === 'expense' && [
                styles.segmentButtonActiveExpense,
                {
                  backgroundColor: isDark ? '#26282E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 59, 48, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                },
              ],
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('expense');
            }}>
            <Ionicons
              name="arrow-up"
              size={14}
              color={activeTab === 'expense' ? colors.expense : colors.textSecondary}
            />
            <ThemedText
              style={[
                styles.segmentButtonText,
                { color: colors.textSecondary },
                activeTab === 'expense' && { color: colors.text, fontWeight: '800' },
              ]}>
              {t('expenses')}
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[
              styles.segmentButton,
              activeTab === 'income' && [
                styles.segmentButtonActiveIncome,
                { backgroundColor: colors.tint },
              ],
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('income');
            }}>
            <Ionicons
              name="arrow-down"
              size={14}
              color={activeTab === 'income' ? (isDark ? '#000000' : '#FFFFFF') : colors.textSecondary}
            />
            <ThemedText
              style={[
                styles.segmentButtonText,
                { color: colors.textSecondary },
                activeTab === 'income' && { color: isDark ? '#000000' : '#FFFFFF', fontWeight: '800' },
              ]}>
              {t('income')}
            </ThemedText>
          </AnimatedPressable>
        </View>

        {/* Chart Card */}
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow.shadowColor,
              shadowOpacity: colors.shadow.shadowOpacity,
            },
          ]}>
          <View style={styles.chartCardHeader}>
            <ThemedText style={[styles.chartCardTitle, { color: colors.textSecondary }]}>
              {activeTab === 'expense' ? t('spendingBreakdown') : t('incomeBreakdown')}
            </ThemedText>
            <ThemedText
              style={
                activeTab === 'expense'
                  ? [styles.totalExpenseText, { color: colors.expense }]
                  : [styles.totalIncomeText, { color: colors.income }]
              }>
              {displayCurrency.symbol}
              {totalSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator size="large" color={colors.tint} />
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
                  color: (opacity = 1) => isDark ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
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
              <Ionicons name="pie-chart-outline" size={40} color={colors.textMuted} />
              <ThemedText style={[styles.noDataText, { color: colors.textSecondary }]}>
                {activeTab === 'expense' ? t('noChartDataExpense') : t('noChartDataIncome')}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Detailed Category Rows with Progress Bars */}
        {breakdownList.length > 0 && (
          <View style={styles.breakdownSection}>
            <ThemedText style={[styles.breakdownHeading, { color: colors.text }]}>{t('topCategories')}</ThemedText>
            {breakdownList.map((item) => (
              <View
                key={item.category}
                style={[styles.breakdownRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.categoryIconWrap, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>

                <View style={styles.breakdownCenter}>
                  <View style={styles.breakdownTitleRow}>
                    <ThemedText style={[styles.breakdownCategoryName, { color: colors.text }]}>
                      {item.category}
                    </ThemedText>
                    <ThemedText style={[styles.breakdownAmount, { color: colors.text }]}>
                      {displayCurrency.symbol}
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </ThemedText>
                  </View>

                  {/* Progress Bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>

                  <ThemedText style={[styles.breakdownPercentText, { color: colors.textSecondary }]}>
                    {item.percentage.toFixed(1)}%
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* AI Financial Analysis Card */}
        <View
          style={[
            styles.aiCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(57, 255, 20, 0.3)' : 'rgba(5, 150, 105, 0.35)',
              shadowColor: colors.shadow.shadowColor,
              shadowOpacity: colors.shadow.shadowOpacity,
            },
          ]}>
          <View style={styles.aiCardTop}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={16} color={colors.tint} />
              <ThemedText style={[styles.aiBadgeText, { color: colors.tint }]}>{t('aiAdvisorBadge')}</ThemedText>
            </View>

            <AnimatedPressable
              style={[styles.aiAnalyzeButton, { backgroundColor: colors.tint }]}
              onPress={handleAnalysis}
              disabled={isAnalyzing}>
              {isAnalyzing ? (
                <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
              ) : (
                <>
                  <Ionicons name="flash" size={14} color={isDark ? '#000000' : '#FFFFFF'} />
                  <ThemedText style={[styles.aiAnalyzeButtonText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                    {t('aiAnalyzeBtn')}
                  </ThemedText>
                </>
              )}
            </AnimatedPressable>
          </View>

          <ThemedText style={[styles.aiCardDescription, { color: colors.textSecondary }]}>
            {t('aiAdvisorDesc')}
          </ThemedText>

          {analysis && (
            <View style={[styles.analysisBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <ThemedText style={[styles.analysisResultText, { color: colors.text }]}>{analysis}</ThemedText>
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