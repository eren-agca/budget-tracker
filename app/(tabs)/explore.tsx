import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { subscribeUserCollection } from '@/services/userDataService';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { analyzeTransactionsWithGemini } from '@/services/geminiService';
import { expenseCategories, getCategoryLabel } from '@/constants/Categories';
import { formatGroupedNumber } from '@/utils/numberFormat';

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
  const [rates, setRates] = useState<ExchangeRates>({ TRY: 1 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [selectedSliceIndex, setSelectedSliceIndex] = useState<number | null>(null);

  const chartAnimationProgress = useSharedValue(0);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeUserCollection(user, 'transactions', (docs) => {
      const transactionsData: Transaction[] = [];
      docs.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({
          id: doc.id,
          ...data,
          type: data.type || (data.amount >= 0 ? 'income' : 'expense'),
        } as Transaction);
      });
      setTransactions(transactionsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchRates = async () => {
      const fetchedRates = await getExchangeRates();
      if (fetchedRates) {
        setRates(fetchedRates);
      }
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
    setSelectedSliceIndex(null);
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

  const donutSlices = useMemo(() => {
    const cx = 115;
    const cy = 115;
    const baseOuterR = 96;
    const innerR = 58;
    let currentAngle = -Math.PI / 2;

    return breakdownList.map((item, index) => {
      const isSelected = selectedSliceIndex === index;
      const sweep = Math.max(0.02, (item.percentage / 100) * Math.PI * 2);
      const startAngle = currentAngle;
      const rawEndAngle = currentAngle + sweep;
      currentAngle = rawEndAngle;

      // Prevent full 360° arc collapse in SVG path
      const endAngle =
        rawEndAngle - startAngle >= Math.PI * 2 - 0.002
          ? startAngle + Math.PI * 2 - 0.002
          : rawEndAngle;
      const midAngle = (startAngle + endAngle) / 2;
      const outerR = isSelected ? baseOuterR + 5 : baseOuterR;

      const offsetDist = isSelected && breakdownList.length > 1 ? 4 : 0;
      const ox = Math.cos(midAngle) * offsetDist;
      const oy = Math.sin(midAngle) * offsetDist;

      const x1Out = cx + outerR * Math.cos(startAngle);
      const y1Out = cy + outerR * Math.sin(startAngle);
      const x2Out = cx + outerR * Math.cos(endAngle);
      const y2Out = cy + outerR * Math.sin(endAngle);

      const x1In = cx + innerR * Math.cos(endAngle);
      const y1In = cy + innerR * Math.sin(endAngle);
      const x2In = cx + innerR * Math.cos(startAngle);
      const y2In = cy + innerR * Math.sin(startAngle);

      const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

      const pathData = [
        `M ${x1Out} ${y1Out}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2Out} ${y2Out}`,
        `L ${x1In} ${y1In}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x2In} ${y2In}`,
        'Z',
      ].join(' ');

      const labelR = (outerR + innerR) / 2;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle) + 4;

      const isBrightSlice =
        item.color === '#39FF14' || item.color === '#2DD4BF' || item.color === '#F59E0B';

      return {
        item,
        index,
        pathData,
        ox,
        oy,
        labelX,
        labelY,
        startAngle,
        endAngle,
        isSelected,
        isBrightSlice,
      };
    });
  }, [breakdownList, selectedSliceIndex]);

  const donutPressRef = useRef<any>(null);

  const handleDonutPress = (e: any) => {
    let x = e?.nativeEvent?.locationX;
    let y = e?.nativeEvent?.locationY;

    if (Platform.OS === 'web' && donutPressRef.current && typeof donutPressRef.current.getBoundingClientRect === 'function') {
      const rect = donutPressRef.current.getBoundingClientRect();
      const clientX = e?.nativeEvent?.clientX ?? e?.clientX;
      const clientY = e?.nativeEvent?.clientY ?? e?.clientY;
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        x = clientX - rect.left;
        y = clientY - rect.top;
      }
    }

    if (typeof x !== 'number' || typeof y !== 'number') return;

    const dx = x - 115;
    const dy = y - 115;
    const dist = Math.hypot(dx, dy);
    if (dist < 50 || dist > 112) return;

    let angle = Math.atan2(dy, dx);
    if (angle < -Math.PI / 2) {
      angle += Math.PI * 2;
    }

    const hit = donutSlices.find((s) => angle >= s.startAngle && angle <= s.endAngle);
    if (!hit) return;

    Haptics.selectionAsync().catch(() => {});
    setSelectedSliceIndex((prev) => (prev === hit.index ? null : hit.index));
  };

  const activeSliceItem =
    selectedSliceIndex !== null && breakdownList[selectedSliceIndex]
      ? breakdownList[selectedSliceIndex]
      : null;

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
                        backgroundColor: isDark ? colors.cardElevated : colors.card,
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
        <View style={[styles.segmentedControl, { backgroundColor: isDark ? colors.card : colors.cardSecondary, borderColor: colors.border }]}>
          <AnimatedPressable
            style={[
              styles.segmentButton,
              activeTab === 'expense' && [
                styles.segmentButtonActiveExpense,
                {
                  backgroundColor: isDark ? colors.cardElevated : colors.card,
                  borderColor: isDark ? 'rgba(255, 107, 99, 0.45)' : 'rgba(223, 68, 62, 0.4)',
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
                {
                  backgroundColor: isDark ? colors.cardElevated : colors.card,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(56, 217, 150, 0.45)' : 'rgba(16, 155, 104, 0.4)',
                },
              ],
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('income');
            }}>
            <Ionicons
              name="arrow-down"
              size={14}
              color={activeTab === 'income' ? colors.income : colors.textSecondary}
            />
            <ThemedText
              style={[
                styles.segmentButtonText,
                { color: colors.textSecondary },
                activeTab === 'income' && { color: colors.text, fontWeight: '800' },
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
              {formatGroupedNumber(totalSum, language)}
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
          ) : chartData.length > 0 ? (
            <Animated.View style={[styles.chartContainer, animatedChartStyle]}>
              {/* Interactive Donut Ring + Center Summary */}
              <View style={styles.donutWrapper}>
                <Pressable
                  ref={donutPressRef}
                  onPress={handleDonutPress}
                  style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}>
                  <Svg width={230} height={230} viewBox="0 0 230 230">
                    <G>
                      {donutSlices.map((slice) => {
                        const dimmed = selectedSliceIndex !== null && !slice.isSelected;
                        return (
                          <G
                            key={slice.item.category}
                            transform={`translate(${slice.ox}, ${slice.oy})`}>
                            <Path
                              d={slice.pathData}
                              fill={slice.item.color}
                              opacity={dimmed ? 0.38 : 1}
                              stroke={colors.card}
                              strokeWidth={breakdownList.length > 1 ? 2.5 : 0}
                            />
                            {slice.item.percentage >= 8 && (
                              <SvgText
                                x={slice.labelX}
                                y={slice.labelY}
                                fill={slice.isBrightSlice ? '#090D16' : '#FFFFFF'}
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle"
                                opacity={dimmed ? 0.45 : 1}>
                                {`${Math.round(slice.item.percentage)}%`}
                              </SvgText>
                            )}
                          </G>
                        );
                      })}
                    </G>
                  </Svg>
                </Pressable>

                {/* Center Hole Interactive Summary */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    if (selectedSliceIndex !== null) {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedSliceIndex(null);
                    }
                  }}
                  style={styles.donutCenterOverlay}>
                  {activeSliceItem ? (
                    <>
                      <View
                        style={[
                          styles.donutCenterIconBadge,
                          { backgroundColor: `${activeSliceItem.color}24` },
                        ]}>
                        <Ionicons
                          name={activeSliceItem.icon}
                          size={16}
                          color={activeSliceItem.color}
                        />
                      </View>
                      <ThemedText
                        style={[styles.donutCenterCategory, { color: colors.text }]}
                        numberOfLines={1}>
                        {activeSliceItem.category}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.donutCenterAmount,
                          { color: activeSliceItem.color },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit>
                        {displayCurrency.symbol}
                        {formatGroupedNumber(activeSliceItem.amount, language, 0, 0)}
                      </ThemedText>
                      <View
                        style={[
                          styles.donutCenterPctPill,
                          { backgroundColor: `${activeSliceItem.color}22` },
                        ]}>
                        <ThemedText
                          style={[
                            styles.donutCenterPctText,
                            { color: activeSliceItem.color },
                          ]}>
                          {`${activeSliceItem.percentage.toFixed(1).replace('.', ',')}%`}
                        </ThemedText>
                      </View>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name={activeTab === 'expense' ? 'pie-chart-outline' : 'trending-up-outline'}
                        size={17}
                        color={colors.textSecondary}
                        style={{ marginBottom: 2 }}
                      />
                      <ThemedText
                        style={[styles.donutCenterSubLabel, { color: colors.textSecondary }]}
                        numberOfLines={1}>
                        {language === 'tr' ? 'TOPLAM' : 'TOTAL'}
                      </ThemedText>
                      <ThemedText
                        style={[styles.donutCenterAmount, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit>
                        {displayCurrency.symbol}
                        {formatGroupedNumber(totalSum, language, 0, 0)}
                      </ThemedText>
                      <ThemedText
                        style={[styles.donutCenterHint, { color: colors.textMuted }]}
                        numberOfLines={1}>
                        {language === 'tr' ? 'Dilime dokun' : 'Tap a slice'}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Card-Internal Interactive Color & Category Legend */}
              <View style={[styles.chartLegendDivider, { backgroundColor: colors.borderLight }]} />
              <View style={styles.chartLegendGrid}>
                {breakdownList.map((item, index) => {
                  const isSelected = selectedSliceIndex === index;
                  const dimmed = selectedSliceIndex !== null && !isSelected;
                  return (
                    <TouchableOpacity
                      key={item.category}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelectedSliceIndex((prev) => (prev === index ? null : index));
                      }}
                      style={[
                        styles.legendChip,
                        {
                          backgroundColor: isSelected
                            ? `${item.color}1F`
                            : isDark
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.025)',
                          borderColor: isSelected ? item.color : colors.borderLight,
                          opacity: dimmed ? 0.55 : 1,
                        },
                      ]}>
                      <View style={styles.legendChipLeft}>
                        <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                        <Ionicons
                          name={item.icon}
                          size={13}
                          color={item.color}
                          style={{ marginRight: 5 }}
                        />
                        <ThemedText
                          style={[
                            styles.legendChipName,
                            { color: colors.text },
                            isSelected && { fontWeight: '800' },
                          ]}
                          numberOfLines={1}>
                          {item.category}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.legendChipPct,
                          { color: isSelected ? item.color : colors.textSecondary },
                        ]}>
                        {`${item.percentage.toFixed(1).replace('.', ',')}%`}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
            {breakdownList.map((item, index) => {
              const isSelected = selectedSliceIndex === index;
              return (
                <TouchableOpacity
                  key={item.category}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedSliceIndex((prev) => (prev === index ? null : index));
                  }}
                  style={[
                    styles.breakdownRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? item.color : colors.border,
                    },
                  ]}>
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
                        {formatGroupedNumber(item.amount, language)}
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
                      {item.percentage.toFixed(1).replace('.', ',')}%
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })}
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
              <ThemedText style={[styles.analysisResultText, { color: colors.text }]}>
                {analysis.split(/(\*\*.*?\*\*)/g).map((part, idx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <ThemedText
                        key={idx}
                        style={[styles.analysisResultText, { color: colors.text, fontWeight: '800' }]}>
                        {part.slice(2, -2)}
                      </ThemedText>
                    );
                  }
                  return part;
                })}
              </ThemedText>
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
  donutWrapper: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenterOverlay: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  donutCenterIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  donutCenterCategory: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  donutCenterSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  donutCenterAmount: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
    textAlign: 'center',
  },
  donutCenterPctPill: {
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  donutCenterPctText: {
    fontSize: 10,
    fontWeight: '800',
  },
  donutCenterHint: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  chartLegendDivider: {
    width: '100%',
    height: 1,
    marginTop: 10,
    marginBottom: 12,
  },
  chartLegendGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  legendChipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  legendColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendChipName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  legendChipPct: {
    fontSize: 11.5,
    fontWeight: '800',
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