import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { analyzeTransactionsWithGemini } from '@/services/geminiService';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
  type: 'income' | 'expense';
  date: any;
}

interface PieChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

export default function ExploreScreen() {
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pieAnimationProgress = useSharedValue(0);
  const barAnimationProgress = useSharedValue(0);

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

  const expenseChartData = useMemo((): PieChartData[] => {
    if (!rates || transactions.length === 0 || !rates[displayCurrency.code]) {
      return [];
    }

    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
      return [];
    }

    const expenseByCategory = expenses.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      const rate = rates[curr.currency] || 1;
      const amountInTRY = Math.abs(curr.amount) * rate;
      acc[category] += amountInTRY;
      return acc;
    }, {} as Record<string, number>);

    const colorPalette = ['#60A5FA', '#F87171', '#4ADE80', '#FBBF24', '#A78BFA', '#2DD4BF'];

    return Object.keys(expenseByCategory).map((category, index) => {
      const totalInCategoryInTRY = expenseByCategory[category];
      const totalInDisplayCurrency = totalInCategoryInTRY / (rates[displayCurrency.code] || 1);
      return {
        name: `${displayCurrency.symbol}${totalInDisplayCurrency.toFixed(0)} ${category}`,
        population: totalInDisplayCurrency,
        color: colorPalette[index % colorPalette.length],
        legendFontColor: Colors.text,
        legendFontSize: 14,
      };
    });
  }, [transactions, rates, displayCurrency]);

  const incomeChartData = useMemo((): PieChartData[] => {
    if (!rates || transactions.length === 0 || !rates[displayCurrency.code]) {
      return [];
    }

    const incomes = transactions.filter((t) => t.type === 'income');
    if (incomes.length === 0) {
      return [];
    }

    const incomeByCategory = incomes.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      const rate = rates[curr.currency] || 1;
      const amountInTRY = curr.amount * rate;
      acc[category] += amountInTRY;
      return acc;
    }, {} as Record<string, number>);

    const colorPalette = ['#34C759', '#52D769', '#28A745', '#84E198', '#A3E9B3'];

    return Object.keys(incomeByCategory).map((category, index) => {
      const totalInCategoryInTRY = incomeByCategory[category];
      const totalInDisplayCurrency = totalInCategoryInTRY / (rates[displayCurrency.code] || 1);
      return {
        name: `${displayCurrency.symbol}${totalInDisplayCurrency.toFixed(0)} ${category}`,
        population: totalInDisplayCurrency,
        color: colorPalette[index % colorPalette.length], 
        legendFontColor: Colors.text,
        legendFontSize: 14,
      };
    });
  }, [transactions, rates, displayCurrency]);

  useEffect(() => {
    if (!loading) {
      pieAnimationProgress.value = withTiming(expenseChartData.length > 0 ? 1 : 0, { duration: 600 });
      barAnimationProgress.value = withTiming(incomeChartData.length > 0 ? 1 : 0, { duration: 600 });
    }
  }, [loading, expenseChartData, incomeChartData]);

  const animatedPieStyle = useAnimatedStyle(() => ({
    opacity: pieAnimationProgress.value,
    transform: [{ scale: pieAnimationProgress.value }],
  }));

  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: barAnimationProgress.value,
    transform: [{ scale: barAnimationProgress.value }],
  }));

  const chartConfig = {
    backgroundGradientFrom: Colors.background,
    backgroundGradientTo: Colors.background,
    color: (opacity = 1) => `rgba(255, 255, 255, 0)`,
  };

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    const result = await analyzeTransactionsWithGemini(transactions);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const ChartPlaceholder = () => (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={Colors.text} />
      </View>
  );

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
        <ScrollView>
          <View style={styles.topDecorationBar} />

          <View style={styles.titleContainer}>
            <ThemedText type="subtitle">Display Currency</ThemedText>
          </View>
          <View style={styles.currencySelectorContainer}>
            {currencies.map((c) => (
                <AnimatedPressable
                    key={c.code}
                    onPress={() => setDisplayCurrency(c)}
                    style={[styles.currencyButton, displayCurrency.code === c.code && styles.currencyButtonActive]}>
                  <ThemedText style={[styles.currencyButtonText, displayCurrency.code === c.code && styles.currencyButtonTextActive]}>
                    {c.code}
                  </ThemedText>
                </AnimatedPressable>
            ))}
          </View>

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Expense Breakdown</ThemedText>
          </ThemedView>

          {loading ? (
              <ChartPlaceholder />
          ) : expenseChartData.length > 0 ? (
              <Animated.View style={animatedPieStyle}>
                <PieChart
                    data={expenseChartData}
                    width={Dimensions.get('window').width}
                    height={220}
                    chartConfig={chartConfig}
                    accessor={'population'}
                    backgroundColor={'transparent'}
                    paddingLeft={'15'}
                    center={[10, 0]}
                    hasLegend={false}
                />
              </Animated.View>
          ) : (
              <View style={styles.emptyContainer}>
                <ThemedText>No expense data to display a chart.</ThemedText>
              </View>
          )}

          {expenseChartData.length > 0 && (
              <View style={styles.legendContainer}>
                {expenseChartData.map((item) => (
                    <View key={`expense-${item.name}`} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                      <ThemedText style={styles.legendText} numberOfLines={2}>{item.name}</ThemedText>
                    </View>
                ))}
              </View>
          )}

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Income Breakdown</ThemedText>
          </ThemedView>

          {loading ? (
              <ChartPlaceholder />
          ) : incomeChartData.length > 0 ? (
              <Animated.View style={animatedBarStyle}>
                <PieChart
                    data={incomeChartData}
                    width={Dimensions.get('window').width}
                    height={220}
                    chartConfig={chartConfig}
                    accessor={'population'}
                    backgroundColor={'transparent'}
                    paddingLeft={'15'}
                    center={[10, 0]}
                    hasLegend={false}
                />
              </Animated.View>
          ) : (
              <View style={styles.emptyContainer}>
                <ThemedText>No income data to display a chart.</ThemedText>
              </View>
          )}

          {incomeChartData.length > 0 && (
              <View style={styles.legendContainer}>
                {incomeChartData.map((item) => (
                    <View key={`income-${item.name}`} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                      <ThemedText style={styles.legendText} numberOfLines={2}>{item.name}</ThemedText>
                    </View>
                ))}
              </View>
          )}

          <View style={styles.analysisContainer}>
            <AnimatedPressable style={styles.analysisButton} onPress={handleAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <ThemedText style={styles.analysisButtonText}>Analyze My Spending</ThemedText>
              )}
            </AnimatedPressable>

            {analysis && (
                <View style={styles.analysisResultBox}>
                  <ThemedText style={styles.analysisResultText}>{analysis}</ThemedText>
                </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  currencySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
    gap: 12,
  },
    topDecorationBar: {
        top:-5,
        height: 5,
        backgroundColor: '#48484a',
        marginHorizontal: 120,
        marginTop: 25,
        borderRadius: 2.5,
    },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    flexShrink: 1,
  },
  currencyButton: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 15,
  },
  currencyButtonActive: {
    backgroundColor: Colors.tint,
  },
  currencyButtonText: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  currencyButtonTextActive: {
    color: Colors.background,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    minHeight: 220,
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  analysisContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 48,
  },
  analysisButton: {
    backgroundColor: Colors.tint,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  analysisButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  analysisResultBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
  },
  analysisResultText: {
    color: Colors.text,
  },
});