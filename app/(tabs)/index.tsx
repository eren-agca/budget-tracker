import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  AppState,
  Dimensions,
  FlatList,
  ListRenderItem,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { AnimatedPressable } from '@/components/AnimatedPressable';
import { SettingsModal } from '@/components/SettingsModal';
import { SwipeableModal } from '@/components/SwipeableModal';
import { ThemedText } from '@/components/ThemedText';
import { Ticker, TickerItemData } from '@/components/Ticker';
import { expenseCategories, getCategoryLabel, isSavingsCategory } from '@/constants/Categories';
import { Colors } from '@/constants/Colors';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { dateFilters, getDateFilters, getDateFilterLabel } from '@/constants/DateFilters';
import { INVESTMENT_PRESETS, getLiveAssetRateInTRY, getPresetLabel } from '@/constants/Investments';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { db } from '@/firebaseConfig';
import { ExchangeRates, getDailyOpenRatesSnapshot, getExchangeRates } from '@/services/currencyService';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  purchaseRate?: number;
  assetQuantity?: number;
  assetCode?: string;
  manualCurrentRate?: number;
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
    const { colors, isDark, language } = useSettings();
    const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };
    const isIncome = item.type === 'income' || item.amount > 0;
    const incomeAmountColor = isDark ? '#4ADE80' : '#16A34A';
    const expenseAmountColor = isDark ? '#F87171' : '#DC2626';
    const iconName = getCategoryIcon(item.category, item.type);
    const localizedCategory = getCategoryLabel(item.category, language);

    const formatDate = (timestamp: Date) => {
      if (!(timestamp instanceof Date)) return '';
      const day = String(timestamp.getDate()).padStart(2, '0');
      const monthNamesTr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthNames = language === 'tr' ? monthNamesTr : monthNamesEn;
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
            {item.description || localizedCategory}
          </ThemedText>
          <View style={styles.transactionMetaRow}>
            <ThemedText style={[styles.transactionCategoryTag, { color: colors.textSecondary }]}>
              {localizedCategory}
            </ThemedText>
            <ThemedText style={[styles.metaDot, { color: colors.textMuted }]}>•</ThemedText>
            <ThemedText style={[styles.transactionDate, { color: colors.textMuted }]}>
              {formatDate(item.date)}
            </ThemedText>
          </View>

          {isSavingsCategory(item.category) && item.purchaseRate != null && item.assetQuantity != null && (
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
                ? [styles.incomeAmount, { color: incomeAmountColor }]
                : [styles.expenseAmount, { color: expenseAmountColor }]
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

const InvestmentListItem = React.memo(
  ({
    item,
    rates,
    rateDirections,
    displayCurrency,
    isBalanceHidden,
    onDelete,
    onEditPrice,
  }: {
    item: Transaction;
    rates: ExchangeRates | null;
    rateDirections: Record<string, 'up' | 'down' | 'flat'>;
    displayCurrency: Currency;
    isBalanceHidden: boolean;
    onDelete: (item: Transaction) => void;
    onEditPrice: (item: Transaction, currentUnitRateInItemCurrency: number) => void;
  }) => {
    const { colors, isDark, t, language } = useSettings();
    const txCurrRate = rates?.[item.currency] || 1;
    const displayRate = rates?.[displayCurrency.code] || 1;
    const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };

    const quantity = item.assetQuantity && item.assetQuantity > 0 ? item.assetQuantity : 1;
    const buyUnitInItemCurr =
      item.purchaseRate && item.purchaseRate > 0 ? item.purchaseRate : Math.abs(item.amount) / quantity;
    const costInTRY = quantity * buyUnitInItemCurr * txCurrRate;

    const { unitRateInTRY: liveUnitInTRY, resolvedCode } = getLiveAssetRateInTRY(
      rates,
      item.assetCode,
      item.description
    );

    const isLive = liveUnitInTRY != null && liveUnitInTRY > 0;
    const liveDirection: 'up' | 'down' | 'flat' | undefined = isLive
      ? (resolvedCode && rateDirections[resolvedCode]) || 'flat'
      : undefined;
    const currentUnitInTRY = isLive
      ? liveUnitInTRY!
      : (item.manualCurrentRate ?? buyUnitInItemCurr) * txCurrRate;

    const currentValueInTRY = quantity * currentUnitInTRY;
    const pnlInTRY = currentValueInTRY - costInTRY;
    const pnlPct = costInTRY > 0 ? (pnlInTRY / costInTRY) * 100 : 0;
    const isProfit = pnlInTRY >= -0.005;

    const presetMatch = INVESTMENT_PRESETS.find((p) => p.code === (resolvedCode || item.assetCode));
    const iconName = presetMatch?.icon || 'trending-up-outline';
    const title =
      presetMatch && presetMatch.code !== 'CUSTOM'
        ? getPresetLabel(presetMatch.code, language)
        : item.description || getCategoryLabel(item.category, language);

    const currentUnitInItemCurr = currentUnitInTRY / txCurrRate;
    const currentValueDisplay = (currentValueInTRY / displayRate).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const pnlDisplay = (Math.abs(pnlInTRY) / displayRate).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return (
      <View style={[styles.transactionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View
          style={[
            styles.categoryIconCircle,
            {
              backgroundColor: isProfit ? colors.tintSoft : colors.expenseSoft,
            },
          ]}>
          <Ionicons name={iconName as any} size={20} color={isProfit ? colors.tint : colors.expense} />
        </View>

        <View style={styles.transactionMainInfo}>
          <View style={styles.investmentTitleRow}>
            <ThemedText style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </ThemedText>
            <View
              style={[
                styles.rateSourceBadge,
                {
                  backgroundColor: isLive ? colors.tintSoft : colors.warningSoft,
                },
              ]}>
              <ThemedText
                style={[
                  styles.rateSourceBadgeText,
                  { color: isLive ? colors.tint : colors.warning },
                ]}>
                {isLive ? t('liveRateBadge') : t('manualRateBadge')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.investmentRateMetaRow}>
            <ThemedText style={[styles.transactionCategoryTag, { color: colors.textSecondary }]}>
              {`${quantity} Adet • ${t('buyRateLabel')}: ${itemCurrency.symbol}${buyUnitInItemCurr.toFixed(2)} → ${t('currentRateLabel')}: ${itemCurrency.symbol}${currentUnitInItemCurr.toFixed(2)}`}
            </ThemedText>
            {liveDirection === 'up' && (
              <Ionicons name="arrow-up" size={13} color={colors.tint} />
            )}
            {liveDirection === 'down' && (
              <Ionicons name="arrow-down" size={13} color={colors.expense} />
            )}
            {liveDirection === 'flat' && (
              <Ionicons name="remove" size={14} color={isDark ? '#8E8E93' : '#64748B'} />
            )}
          </View>

          <View style={styles.investmentPnlRow}>
            <View
              style={[
                styles.pnlBadge,
                {
                  backgroundColor: isProfit ? colors.incomeSoft : colors.expenseSoft,
                },
              ]}>
              <Ionicons
                name={isProfit ? 'trending-up' : 'trending-down'}
                size={12}
                color={isProfit ? colors.income : colors.expense}
              />
              <ThemedText
                style={[
                  styles.pnlBadgeText,
                  { color: isProfit ? colors.income : colors.expense },
                ]}>
                {isBalanceHidden
                  ? `${isProfit ? '+' : '-'}${displayCurrency.symbol}••••`
                  : `${isProfit ? '+' : '-'}${displayCurrency.symbol}${pnlDisplay} (${isProfit ? '+' : ''}${pnlPct.toFixed(2)}%)`}
              </ThemedText>
            </View>

            {!isLive && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onEditPrice(item, Number(currentUnitInItemCurr.toFixed(2)));
                }}
                style={[
                  styles.updatePriceChip,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                    borderColor: colors.border,
                  },
                ]}>
                <Ionicons name="create-outline" size={12} color={colors.tint} />
                <ThemedText style={[styles.updatePriceChipText, { color: colors.text }]}>
                  {t('updatePriceBtn')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.transactionRightBlock}>
          <ThemedText style={[styles.incomeAmount, { color: colors.text }]}>
            {isBalanceHidden ? `${displayCurrency.symbol}•••••` : `${displayCurrency.symbol}${currentValueDisplay}`}
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
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              },
            ]}>
            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);
InvestmentListItem.displayName = 'InvestmentListItem';

const DEFAULT_CHART_WIDTH = Math.max(Dimensions.get('window').width - 72, 220);

const HeroBalanceChart = React.memo(
  ({
    points,
    color,
    isDark,
  }: {
    points: number[];
    color: string;
    isDark: boolean;
  }) => {
    const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
    const chartHeight = 76;
    const padTop = 12;
    const padBottom = 10;
    const padLeft = 4;
    const padRight = 10;

    const { linePath, areaPath, lastPoint } = useMemo(() => {
      const safePoints = points.length >= 2 ? points : [0, 0];
      const minVal = Math.min(...safePoints);
      const maxVal = Math.max(...safePoints);
      const range = maxVal - minVal;
      const usableW = Math.max(chartWidth - padLeft - padRight, 40);
      const usableH = chartHeight - padTop - padBottom;

      const coords = safePoints.map((val, idx) => {
        const x = padLeft + (idx / (safePoints.length - 1)) * usableW;
        const y =
          range === 0
            ? padTop + usableH * 0.58
            : padTop + usableH - ((val - minVal) / range) * usableH;
        return { x, y };
      });

      let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i];
        const p1 = coords[i + 1];
        const cp1x = p0.x + (p1.x - p0.x) * 0.45;
        const cp1y = p0.y;
        const cp2x = p0.x + (p1.x - p0.x) * 0.55;
        const cp2y = p1.y;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }

      const last = coords[coords.length - 1];
      const first = coords[0];
      const area = `${d} L ${last.x.toFixed(1)} ${chartHeight} L ${first.x.toFixed(1)} ${chartHeight} Z`;

      return { linePath: d, areaPath: area, lastPoint: last };
    }, [points, chartWidth]);

    return (
      <View
        style={styles.heroChartWrapper}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 40 && Math.abs(w - chartWidth) > 2) {
            setChartWidth(w);
          }
        }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="heroBalanceGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.32 : 0.22} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#heroBalanceGrad)" />
          <Path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={8}
            fill={color}
            opacity={isDark ? 0.28 : 0.2}
          />
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4.2}
            fill={isDark ? '#FFFFFF' : color}
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      </View>
    );
  }
);
HeroBalanceChart.displayName = 'HeroBalanceChart';

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDark, colors, t, language } = useSettings();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates>({ TRY: 1 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [fiatMetalTickerData, setFiatMetalTickerData] = useState<(string | TickerItemData)[]>([]);
  const [cryptoTickerData, setCryptoTickerData] = useState<(string | TickerItemData)[]>([]);
  const [rateDirections, setRateDirections] = useState<Record<string, 'up' | 'down' | 'flat'>>({});
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [activeView, setActiveView] = useState<'wallet' | 'investments'>('wallet');
  const [investmentToEditPrice, setInvestmentToEditPrice] = useState<Transaction | null>(null);
  const [editPriceInput, setEditPriceInput] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('@budget_tracker_hide_balance')
      .then((val) => {
        if (val === 'true') {
          setIsBalanceHidden(true);
        } else if (val === 'false') {
          setIsBalanceHidden(false);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleBalanceVisibility = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setIsBalanceHidden((prev) => {
      const next = !prev;
      AsyncStorage.setItem('@budget_tracker_hide_balance', String(next)).catch(() => {});
      return next;
    });
  }, []);

  const { walletTransactions, investmentTransactions } = useMemo(() => {
    const wallet: Transaction[] = [];
    const investments: Transaction[] = [];
    for (const tx of transactions) {
      if (isSavingsCategory(tx.category)) {
        investments.push(tx);
      } else {
        wallet.push(tx);
      }
    }
    return { walletTransactions: wallet, investmentTransactions: investments };
  }, [transactions]);

  const dateFilteredTransactions = useMemo(() => {
    const now = new Date();
    if (selectedDateFilter === 'all') {
      return walletTransactions;
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
        return walletTransactions;
    }
    startDate.setHours(0, 0, 0, 0);
    return walletTransactions.filter((t) => t.date && t.date >= startDate);
  }, [walletTransactions, selectedDateFilter]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    if (!rates) return { totalIncome: 0, totalExpense: 0, balance: 0 };
    return walletTransactions.reduce(
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
  }, [walletTransactions, rates]);

  const { chartPoints, monthlyTrendPercent } = useMemo(() => {
    if (!rates || walletTransactions.length === 0) {
      return { chartPoints: [0, 0, 0, 0], monthlyTrendPercent: null as string | null };
    }

    const chronological = [...walletTransactions].sort(
      (a, b) => (a.date instanceof Date ? a.date.getTime() : 0) - (b.date instanceof Date ? b.date.getTime() : 0)
    );

    const cumulative: number[] = [0];
    let running = 0;
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    let monthIncome = 0;
    let monthExpense = 0;

    for (const tx of chronological) {
      const r = rates[tx.currency] || 1;
      const signed = (tx.type === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount)) * r;
      running += signed;
      cumulative.push(running);

      if (tx.date instanceof Date && tx.date.getMonth() === curMonth && tx.date.getFullYear() === curYear) {
        if (signed >= 0) {
          monthIncome += signed;
        } else {
          monthExpense += Math.abs(signed);
        }
      }
    }

    let pts = cumulative;
    if (pts.length === 2) {
      const target = pts[1];
      pts = [0, target * 0.25, target * 0.6, target * 0.85, target];
    } else if (pts.length > 20) {
      pts = pts.slice(-20);
    }

    const monthNet = monthIncome - monthExpense;
    const prevBalance = running - monthNet;
    let pctValue: number | null = null;

    if (Math.abs(prevBalance) > 1) {
      pctValue = (monthNet / Math.abs(prevBalance)) * 100;
    } else if (monthIncome > 0 || monthExpense > 0) {
      pctValue = (monthNet / Math.max(monthIncome, monthExpense)) * 100;
    }

    let formattedPct: string | null = null;
    if (pctValue !== null && isFinite(pctValue)) {
      const clamped = Math.max(-999, Math.min(999, pctValue));
      const sign = clamped >= 0 ? '+' : '';
      formattedPct = `${sign}${clamped.toFixed(1)}%`;
    }

    return { chartPoints: pts, monthlyTrendPercent: formattedPct };
  }, [walletTransactions, rates]);

  const portfolioSummary = useMemo(() => {
    if (!rates || investmentTransactions.length === 0) {
      return {
        totalCostInTRY: 0,
        totalCurrentValueInTRY: 0,
        totalPnLInTRY: 0,
        totalPnLPct: 0,
        portfolioChartPoints: [0, 0, 0, 0],
      };
    }

    const chronological = [...investmentTransactions].sort(
      (a, b) => (a.date instanceof Date ? a.date.getTime() : 0) - (b.date instanceof Date ? b.date.getTime() : 0)
    );

    let totalCostInTRY = 0;
    let totalCurrentValueInTRY = 0;
    const cumulativeValues: number[] = [0];

    for (const item of chronological) {
      const txCurrRate = rates[item.currency] || 1;
      const quantity = item.assetQuantity && item.assetQuantity > 0 ? item.assetQuantity : 1;
      const buyUnitInItemCurr =
        item.purchaseRate && item.purchaseRate > 0 ? item.purchaseRate : Math.abs(item.amount) / quantity;
      const costInTRY = quantity * buyUnitInItemCurr * txCurrRate;

      const { unitRateInTRY: liveUnitInTRY } = getLiveAssetRateInTRY(
        rates,
        item.assetCode,
        item.description
      );
      const isLive = liveUnitInTRY != null && liveUnitInTRY > 0;
      const currentUnitInTRY = isLive
        ? liveUnitInTRY!
        : (item.manualCurrentRate ?? buyUnitInItemCurr) * txCurrRate;

      const currentValueInTRY = quantity * currentUnitInTRY;

      totalCostInTRY += costInTRY;
      totalCurrentValueInTRY += currentValueInTRY;
      cumulativeValues.push(totalCurrentValueInTRY);
    }

    let pts = cumulativeValues;
    if (pts.length === 2) {
      pts = [0, totalCostInTRY * 0.45, totalCostInTRY * 0.85, totalCostInTRY, totalCurrentValueInTRY];
    } else if (pts.length > 20) {
      pts = pts.slice(-20);
    }

    const totalPnLInTRY = totalCurrentValueInTRY - totalCostInTRY;
    const totalPnLPct = totalCostInTRY > 0 ? (totalPnLInTRY / totalCostInTRY) * 100 : 0;

    return {
      totalCostInTRY,
      totalCurrentValueInTRY,
      totalPnLInTRY,
      totalPnLPct,
      portfolioChartPoints: pts,
    };
  }, [investmentTransactions, rates]);

  useEffect(() => {
    const FALLBACK_MESSAGE = t('marketDataFallback');

    const fiatMetalItems = [
      { code: 'USD', name: 'USD' },
      { code: 'EUR', name: 'EUR' },
      { code: 'GBP', name: 'GBP' },
      { code: 'XAU_GRAM', name: 'GOLD' },
      { code: 'XAG_GRAM', name: 'SILVER' },
    ];

    const cryptoItems = [
      { code: 'BTC', name: 'BTC' },
      { code: 'ETH', name: 'ETH' },
      { code: 'XRP', name: 'XRP' },
    ];

    const buildTickers = (
      activeRates: ExchangeRates,
      dirs: Record<string, 'up' | 'down' | 'flat'>
    ) => {
      const formatData = (items: { code: string; name: string }[]): TickerItemData[] =>
        items
          .filter((item) => activeRates[item.code] && activeRates[item.code] > 0)
          .map((item) => {
            const rate = activeRates[item.code];
            const isCrypto = ['BTC', 'ETH', 'XRP'].includes(item.code);
            let formattedRate = '';
            if (isCrypto) {
              formattedRate = `₺${Math.round(rate).toLocaleString('tr-TR')}`;
            } else {
              const parts = rate.toFixed(2).split('.');
              const integerFormatted = Number(parts[0]).toLocaleString('tr-TR');
              formattedRate = `₺${integerFormatted},${parts[1]}`;
            }
            return {
              text: `${item.name} ${formattedRate}`,
              direction: dirs[item.code] || 'flat',
            };
          });

      const formattedFiat = formatData(fiatMetalItems);
      const formattedCrypto = formatData(cryptoItems);

      setFiatMetalTickerData(
        formattedFiat.length > 0 ? formattedFiat : [FALLBACK_MESSAGE]
      );
      setCryptoTickerData(
        formattedCrypto.length > 0 ? formattedCrypto : [FALLBACK_MESSAGE]
      );
    };

    // 1. Stale-While-Revalidate: Instant 0ms load from local cache before network finishes
    AsyncStorage.multiGet(['@budget_tracker_cached_rates', '@budget_tracker_rate_directions'])
      .then((entries) => {
        const rawRates = entries[0]?.[1];
        const rawDirs = entries[1]?.[1];
        if (rawRates) {
          const parsedRates = JSON.parse(rawRates);
          const parsedDirs = rawDirs ? JSON.parse(rawDirs) : {};
          if (parsedRates && Object.keys(parsedRates).length > 1) {
            setRates((prev) => (prev && Object.keys(prev).length > 1 ? prev : parsedRates));
            setRateDirections((prev) => (Object.keys(prev).length > 0 ? prev : parsedDirs));
            buildTickers(parsedRates, parsedDirs);
          }
        }
      })
      .catch(() => {});

    const fetchRates = async (force = false) => {
      if (AppState.currentState && AppState.currentState !== 'active') return;
      try {
        const fetchedRates = await getExchangeRates(force);
        if (!fetchedRates || Object.keys(fetchedRates).length <= 1) {
          setRates((prev) => (prev && Object.keys(prev).length > 1 ? prev : { TRY: 1 }));
          setFiatMetalTickerData((prev) => (prev.length > 0 ? prev : [FALLBACK_MESSAGE]));
          setCryptoTickerData((prev) => (prev.length > 0 ? prev : [FALLBACK_MESSAGE]));
          return;
        }

        setRates(fetchedRates);

        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const apiOpenRates = getDailyOpenRatesSnapshot();

        let dailyOpenRates: Record<string, number> = {};
        try {
          const rawDaily = await AsyncStorage.getItem('@budget_tracker_daily_open_rates');
          if (rawDaily) {
            const parsed = JSON.parse(rawDaily);
            if (parsed?.date === todayKey && parsed?.openRates && typeof parsed.openRates === 'object') {
              dailyOpenRates = { ...parsed.openRates };
            }
          }
        } catch {}

        const nextDirections: Record<string, 'up' | 'down' | 'flat'> = {};

        for (const [code, currentVal] of Object.entries(fetchedRates)) {
          if (typeof currentVal !== 'number' || currentVal <= 0) continue;

          // Use API's daily opening price if available, or lock in the first price seen at the start of the day
          const apiOpenVal = apiOpenRates?.[code];
          if (typeof apiOpenVal === 'number' && apiOpenVal > 0) {
            dailyOpenRates[code] = apiOpenVal;
          } else if (typeof dailyOpenRates[code] !== 'number' || dailyOpenRates[code] <= 0) {
            dailyOpenRates[code] = currentVal;
          }

          const openVal = dailyOpenRates[code];
          if (typeof openVal === 'number' && openVal > 0) {
            if (Math.abs(currentVal - openVal) > 0.0001) {
              nextDirections[code] = currentVal > openVal ? 'up' : 'down';
            } else {
              nextDirections[code] = 'flat';
            }
          } else {
            nextDirections[code] = 'flat';
          }
        }

        const goldDir = nextDirections['XAU_GRAM'] || 'flat';
        nextDirections['XAU_QUARTER'] = goldDir;
        nextDirections['XAU_HALF'] = goldDir;
        nextDirections['XAU_FULL'] = goldDir;

        setRateDirections(nextDirections);
        buildTickers(fetchedRates, nextDirections);

        AsyncStorage.multiSet([
          ['@budget_tracker_cached_rates', JSON.stringify(fetchedRates)],
          ['@budget_tracker_rate_directions', JSON.stringify(nextDirections)],
          ['@budget_tracker_daily_open_rates', JSON.stringify({ date: todayKey, openRates: dailyOpenRates })],
        ]).catch(() => {});
      } catch (error) {
        console.error('Error fetching rates:', error);
      }
    };

    fetchRates(true);
    const intervalId = setInterval(() => fetchRates(false), 30000); // 30-second live polling while active
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchRates(false);
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSub.remove();
    };
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
            description: `${sub.name} (${language === 'tr' ? 'Abonelik Ödemesi' : 'Subscription Payment'})`,
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

  const parseTransactionDocs = useCallback((docs: any[]): Transaction[] => {
    const transactionsData: Transaction[] = [];
    docs.forEach((docSnap) => {
      const data = docSnap.data();
      let parsedDate = new Date();
      if (data.date?.toDate) {
        parsedDate = data.date.toDate();
      } else if (data.date) {
        const fallbackDate = new Date(data.date);
        if (!isNaN(fallbackDate.getTime())) {
          parsedDate = fallbackDate;
        }
      }
      transactionsData.push({
        ...data,
        id: docSnap.id,
        date: parsedDate,
        type: data.type || (data.amount >= 0 ? 'income' : 'expense'),
      } as Transaction);
    });
    return transactionsData;
  }, []);

  const cacheTransactions = useCallback((uid: string, list: Transaction[]) => {
    const serializable = list.map((tx) => ({
      ...tx,
      date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
    }));
    AsyncStorage.setItem(`@budget_tracker_cached_transactions_${uid}`, JSON.stringify(serializable)).catch(() => {});
  }, []);

  const refreshTransactionsFromServer = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      const list = parseTransactionDocs(snap.docs);
      setTransactions(list);
      cacheTransactions(user.uid, list);
    } catch (err) {
      console.error('Error refreshing transactions:', err);
    }
  }, [user?.uid, parseTransactionDocs, cacheTransactions]);

  // Run auto checks and ensure latest transactions whenever Home tab gains focus
  useFocusEffect(
    useCallback(() => {
      runChecks();
      refreshTransactionsFromServer();
    }, [runChecks, refreshTransactionsFromServer])
  );

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setTransactions([]);
      return;
    }

    // Instant load from local cache so transactions and balance never flash 0
    AsyncStorage.getItem(`@budget_tracker_cached_transactions_${uid}`)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const hydrated: Transaction[] = parsed.map((tx: any) => ({
              ...tx,
              date: tx.date ? new Date(tx.date) : new Date(),
            }));
            setTransactions((prev) => (prev.length > 0 ? prev : hydrated));
          }
        }
      })
      .catch(() => {});

    const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const transactionsData = parseTransactionDocs(querySnapshot.docs);
        setTransactions(transactionsData);
        cacheTransactions(uid, transactionsData);
      },
      (error) => {
        console.error('Transactions onSnapshot error:', error);
        refreshTransactionsFromServer();
      }
    );
    return () => unsubscribe();
  }, [user?.uid, parseTransactionDocs, cacheTransactions, refreshTransactionsFromServer]);

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
        text1: language === 'tr' ? 'İşlem Silindi' : 'Transaction Deleted',
        text2: language === 'tr' ? 'Kayıt başarıyla kaldırıldı.' : 'Record removed successfully.',
        visibilityTime: 2500,
      });
    } catch (error) {
      console.error('Error deleting document: ', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Hata' : 'Error',
        text2: language === 'tr' ? 'İşlem silinirken bir sorun oluştu.' : 'An error occurred while deleting the transaction.',
      });
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) {
      return dateFilteredTransactions;
    }
    const targetKey = selectedCategory.toLowerCase();
    const isIncomeFilter =
      targetKey === 'incomes' ||
      targetKey === 'income' ||
      targetKey === 'gelir' ||
      targetKey === 'gelirler';

    if (isIncomeFilter) {
      return dateFilteredTransactions.filter((transaction) => {
        return transaction.type === 'income' || transaction.amount > 0;
      });
    }

    return dateFilteredTransactions.filter((transaction) => {
      // Exclude incomes completely when an expense category is selected
      const isTxIncome = transaction.type === 'income' || transaction.amount > 0;
      if (isTxIncome) return false;

      const cat = (transaction.category || '').toLowerCase();
      return (
        cat === targetKey ||
        expenseCategories.some(
          (c) =>
            (c.key.toLowerCase() === targetKey ||
              c.label.toLowerCase() === targetKey ||
              c.labelTr.toLowerCase() === targetKey ||
              c.labelEn.toLowerCase() === targetKey) &&
            (c.key.toLowerCase() === cat ||
              c.label.toLowerCase() === cat ||
              c.labelTr.toLowerCase() === cat ||
              c.labelEn.toLowerCase() === cat)
        )
      );
    });
  }, [dateFilteredTransactions, selectedCategory]);

  const selectedDateFilterLabel = getDateFilterLabel(selectedDateFilter, language);

  const userGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greetingMorning');
    if (hour < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  }, [language, t]);

  const handleEditInvestmentPrice = useCallback((item: Transaction, currentUnitRate: number) => {
    setInvestmentToEditPrice(item);
    setEditPriceInput(String(currentUnitRate));
  }, []);

  const handleSaveManualPrice = async () => {
    if (!investmentToEditPrice || !user) return;
    const numeric = parseFloat(editPriceInput.replace(',', '.'));
    if (isNaN(numeric) || numeric <= 0) {
      Toast.show({
        type: 'error',
        text1: language === 'tr' ? 'Geçersiz Fiyat' : 'Invalid Price',
        text2: t('invalidRate'),
      });
      return;
    }

    const targetId = investmentToEditPrice.id;
    setInvestmentToEditPrice(null);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid, 'transactions', targetId), {
        manualCurrentRate: numeric,
      });
      Toast.show({
        type: 'success',
        text1: language === 'tr' ? 'Fiyat Güncellendi' : 'Price Updated',
        text2: language === 'tr' ? 'Kâr/zarar hesabı yeni kura göre güncellendi.' : 'Profit/loss recalculated with the new price.',
      });
    } catch (err) {
      console.error('Error updating manual price:', err);
    }
  };

  const renderTransaction: ListRenderItem<Transaction> = useCallback(
    ({ item }) =>
      activeView === 'investments' ? (
        <InvestmentListItem
          item={item}
          rates={rates}
          rateDirections={rateDirections}
          displayCurrency={displayCurrency}
          isBalanceHidden={isBalanceHidden}
          onDelete={handleDeleteTransaction}
          onEditPrice={handleEditInvestmentPrice}
        />
      ) : (
        <TransactionListItem
          item={item}
          onDelete={handleDeleteTransaction}
          displayCurrency={displayCurrency}
          rate={rates ? rates[displayCurrency.code] || 1 : 1}
        />
      ),
    [activeView, handleDeleteTransaction, handleEditInvestmentPrice, displayCurrency, rates, rateDirections, isBalanceHidden]
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
          <ThemedText style={[styles.greetingText, { color: colors.textSecondary }]} numberOfLines={1}>
            {userGreeting}
          </ThemedText>
          <ThemedText style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
            {user?.email ? user.email.split('@')[0] : t('myPortfolio')}
          </ThemedText>
        </View>

        {/* Top-Center Currency Switcher (button transforms directly into the vertical list) */}
        <View style={styles.topCurrencyCenterWrapper}>
          {!isCurrencyMenuOpen ? (
            <AnimatedPressable
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsCurrencyMenuOpen(true);
              }}
              style={[
                styles.topCurrencyTrigger,
                {
                  backgroundColor: isDark ? '#191A20' : '#FFFFFF',
                  borderColor: colors.border,
                  shadowColor: isDark ? colors.tint : '#64748B',
                  shadowOpacity: isDark ? 0.12 : 0.08,
                },
              ]}>
              <View
                style={[
                  styles.topCurrencyDot,
                  {
                    backgroundColor: colors.tint,
                    shadowColor: colors.tint,
                  },
                ]}
              />
              <ThemedText style={[styles.topCurrencySymbol, { color: colors.tint }]}>
                {displayCurrency.symbol}
              </ThemedText>
              <ThemedText style={[styles.topCurrencyCode, { color: isDark ? colors.tint : colors.text }]}>
                {displayCurrency.label}
              </ThemedText>
              <Ionicons name="chevron-down" size={14} color={colors.tint} />
            </AnimatedPressable>
          ) : (
            <View
              style={[
                styles.topCurrencyDropdown,
                {
                  backgroundColor: isDark ? '#191A20' : '#FFFFFF',
                  borderColor: colors.tint,
                  shadowColor: isDark ? colors.tint : '#64748B',
                  shadowOpacity: isDark ? 0.24 : 0.14,
                },
              ]}>
              {[displayCurrency, ...currencies.filter((c) => c.code !== displayCurrency.code)].map((c, index) => {
                const isActive = index === 0;
                return (
                  <AnimatedPressable
                    key={c.code}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setDisplayCurrency(c);
                      setIsCurrencyMenuOpen(false);
                    }}
                    style={[
                      styles.topCurrencyDropdownItem,
                      !isActive && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}>
                    {isActive && (
                      <View
                        style={[
                          styles.topCurrencyDot,
                          {
                            backgroundColor: colors.tint,
                            shadowColor: colors.tint,
                          },
                        ]}
                      />
                    )}
                    <ThemedText
                      style={[
                        styles.topCurrencySymbol,
                        { color: isActive ? colors.tint : colors.textSecondary },
                      ]}>
                      {c.symbol}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.topCurrencyCode,
                        {
                          color: isActive ? (isDark ? colors.tint : colors.text) : colors.textSecondary,
                          fontWeight: isActive ? '800' : '700',
                        },
                      ]}>
                      {c.label}
                    </ThemedText>
                    {isActive && <Ionicons name="chevron-up" size={14} color={colors.tint} />}
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.topHeaderRight}>
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
      </View>

      {isCurrencyMenuOpen && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.currencyBackdrop}
          onPress={() => setIsCurrencyMenuOpen(false)}
        />
      )}

      {/* Live Market Tickers */}
      <View style={styles.tickerStack}>
        {fiatMetalTickerData.length > 0 && (
          <Ticker
            key={`fiat-${fiatMetalTickerData.length}`}
            data={fiatMetalTickerData}
            badgeLabel={t('marketTicker')}
          />
        )}
        {cryptoTickerData.length > 0 && (
          <Ticker
            key={`crypto-${cryptoTickerData.length}`}
            data={cryptoTickerData}
            badgeLabel={t('cryptoTicker')}
          />
        )}
      </View>

      <FlatList
        data={activeView === 'investments' ? investmentTransactions : filteredTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <>
            {/* Segmented Mode Switcher: Wallet vs. Investments */}
            <View
              style={[
                styles.viewModeSwitcher,
                {
                  backgroundColor: isDark ? '#121215' : colors.cardSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveView('wallet');
                }}
                style={[
                  styles.viewModeTab,
                  activeView === 'wallet' && [
                    styles.viewModeTabActive,
                    {
                      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
                      borderColor: colors.tint,
                    },
                  ],
                ]}>
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={activeView === 'wallet' ? colors.tint : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.viewModeTabText,
                    { color: colors.textSecondary },
                    activeView === 'wallet' && { color: colors.tint, fontWeight: '800' },
                  ]}>
                  {t('walletViewTab')}
                </ThemedText>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveView('investments');
                }}
                style={[
                  styles.viewModeTab,
                  activeView === 'investments' && [
                    styles.viewModeTabActive,
                    {
                      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
                      borderColor: colors.tint,
                    },
                  ],
                ]}>
                <Ionicons
                  name="trending-up-outline"
                  size={16}
                  color={activeView === 'investments' ? colors.tint : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.viewModeTabText,
                    { color: colors.textSecondary },
                    activeView === 'investments' && { color: colors.tint, fontWeight: '800' },
                  ]}>
                  {t('investmentsViewTab')}
                </ThemedText>
              </AnimatedPressable>
            </View>

            {/* Hero Net Worth / Investment Portfolio Card */}
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
                  <View
                    style={[
                      styles.neonDot,
                      {
                        backgroundColor: colors.tint,
                        shadowColor: colors.tint,
                      },
                    ]}
                  />
                  <ThemedText style={[styles.heroCardLabel, { color: colors.textSecondary }]}>
                    {activeView === 'investments' ? t('investmentPortfolioLabel') : t('totalBalanceLabel')}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.liveLedgerBadge,
                    {
                      backgroundColor: isDark ? '#121215' : colors.cardSecondary,
                      borderColor: colors.borderLight,
                    },
                  ]}>
                  <ThemedText style={[styles.liveLedgerText, { color: colors.textSecondary }]}>
                    {t('liveLedger')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.heroAmountRow}>
                <ThemedText style={[styles.heroCurrencySymbol, { color: colors.tint }]}>
                  {activeView === 'wallet' && !isBalanceHidden && balance < 0
                    ? `-${displayCurrency.symbol}`
                    : displayCurrency.symbol}
                </ThemedText>
                <ThemedText
                  style={[styles.heroAmountText, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}>
                  {isBalanceHidden
                    ? '••••••'
                    : activeView === 'investments'
                    ? formatAmount(Math.abs(portfolioSummary.totalCurrentValueInTRY))
                    : formatAmount(Math.abs(balance))}
                </ThemedText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={handleToggleBalanceVisibility}
                  style={[
                    styles.eyeToggleBtn,
                    {
                      backgroundColor: isDark ? '#26282E' : colors.cardSecondary,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border,
                    },
                  ]}>
                  <Ionicons
                    name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={23}
                    color={isDark ? '#E5E7EB' : '#334155'}
                  />
                </TouchableOpacity>
              </View>

              {/* Trend Pill Badge directly below Balance Amount */}
              <View style={styles.heroTrendRow}>
                {activeView === 'investments' ? (
                  <View
                    style={[
                      styles.trendBadge,
                      {
                        backgroundColor:
                          portfolioSummary.totalPnLInTRY >= -0.005 ? colors.tintSoft : colors.expenseSoft,
                        borderColor:
                          portfolioSummary.totalPnLInTRY >= -0.005
                            ? isDark
                              ? 'rgba(57, 255, 20, 0.22)'
                              : 'rgba(5, 150, 105, 0.22)'
                            : 'rgba(255, 59, 48, 0.25)',
                      },
                    ]}>
                    <Ionicons
                      name={portfolioSummary.totalPnLInTRY >= -0.005 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={portfolioSummary.totalPnLInTRY >= -0.005 ? colors.tint : colors.expense}
                    />
                    <ThemedText
                      style={[
                        styles.trendText,
                        { color: portfolioSummary.totalPnLInTRY >= -0.005 ? colors.tint : colors.expense },
                      ]}>
                      {isBalanceHidden
                        ? `${portfolioSummary.totalPnLInTRY >= -0.005 ? '+' : '-'}${displayCurrency.symbol}••••`
                        : `${portfolioSummary.totalPnLInTRY >= -0.005 ? '+' : '-'}${displayCurrency.symbol}${formatAmount(
                            Math.abs(portfolioSummary.totalPnLInTRY)
                          )} (${portfolioSummary.totalPnLInTRY >= -0.005 ? '+' : ''}${portfolioSummary.totalPnLPct.toFixed(
                            2
                          )}%)`}
                    </ThemedText>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.trendBadge,
                      {
                        backgroundColor: balance >= 0 ? colors.tintSoft : colors.expenseSoft,
                        borderColor:
                          balance >= 0
                            ? isDark
                              ? 'rgba(57, 255, 20, 0.22)'
                              : 'rgba(5, 150, 105, 0.22)'
                            : 'rgba(255, 59, 48, 0.25)',
                      },
                    ]}>
                    <Ionicons
                      name={balance >= 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={balance >= 0 ? colors.tint : colors.expense}
                    />
                    <ThemedText
                      style={[
                        styles.trendText,
                        { color: balance >= 0 ? colors.tint : colors.expense },
                      ]}>
                      {balance >= 0 ? t('netPositive') : t('deficit')}
                      {monthlyTrendPercent ? ` ${monthlyTrendPercent} ${t('thisMonthSuffix')}` : ''}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Dynamic Sparkline Chart */}
              <HeroBalanceChart
                points={activeView === 'investments' ? portfolioSummary.portfolioChartPoints : chartPoints}
                color={
                  activeView === 'investments'
                    ? portfolioSummary.totalPnLInTRY >= -0.005
                      ? colors.tint
                      : colors.expense
                    : balance >= 0
                    ? colors.tint
                    : colors.expense
                }
                isDark={isDark}
              />
            </View>

            {activeView === 'investments' ? (
              <>
                {/* Portfolio Cost vs. Net Profit/Loss Split Cards */}
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBadgeGreen, { backgroundColor: colors.tintSoft }]}>
                      <Ionicons name="wallet-outline" size={16} color={colors.tint} />
                    </View>
                    <View style={styles.statTextGroup}>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {t('totalCostLabel')}
                      </ThemedText>
                      <ThemedText style={[styles.statAmountIncome, { color: colors.text }]}>
                        {isBalanceHidden
                          ? `${displayCurrency.symbol}•••••`
                          : `${displayCurrency.symbol}${formatAmount(portfolioSummary.totalCostInTRY)}`}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View
                      style={[
                        styles.statIconBadgeGreen,
                        {
                          backgroundColor:
                            portfolioSummary.totalPnLInTRY >= -0.005 ? colors.incomeSoft : colors.expenseSoft,
                        },
                      ]}>
                      <Ionicons
                        name={portfolioSummary.totalPnLInTRY >= -0.005 ? 'trending-up' : 'trending-down'}
                        size={16}
                        color={portfolioSummary.totalPnLInTRY >= -0.005 ? colors.income : colors.expense}
                      />
                    </View>
                    <View style={styles.statTextGroup}>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {t('netProfitLossLabel')}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.statAmountIncome,
                          {
                            color: portfolioSummary.totalPnLInTRY >= -0.005 ? colors.income : colors.expense,
                          },
                        ]}>
                        {isBalanceHidden
                          ? `${portfolioSummary.totalPnLInTRY >= -0.005 ? '+' : '-'}${displayCurrency.symbol}•••••`
                          : `${portfolioSummary.totalPnLInTRY >= -0.005 ? '+' : '-'}${displayCurrency.symbol}${formatAmount(
                              Math.abs(portfolioSummary.totalPnLInTRY)
                            )}`}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.sectionHeaderRow}>
                  <ThemedText style={[styles.sectionHeading, { color: colors.text }]}>
                    {t('myInvestmentsHeading')}
                  </ThemedText>
                  <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                    <ThemedText style={[styles.countBadgeText, { color: colors.tint }]}>
                      {investmentTransactions.length}
                    </ThemedText>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Income & Expense Split Cards */}
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBadgeGreen, { backgroundColor: colors.incomeSoft }]}>
                      <Ionicons name="arrow-down" size={16} color={colors.income} />
                    </View>
                    <View style={styles.statTextGroup}>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('income')}</ThemedText>
                      <ThemedText style={[styles.statAmountIncome, { color: colors.income }]}>
                        {isBalanceHidden
                          ? `+${displayCurrency.symbol}•••••`
                          : `+${displayCurrency.symbol}${formatAmount(totalIncome)}`}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBadgeRed, { backgroundColor: colors.expenseSoft }]}>
                      <Ionicons name="arrow-up" size={16} color={colors.expense} />
                    </View>
                    <View style={styles.statTextGroup}>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {t('expenses')}
                      </ThemedText>
                      <ThemedText style={[styles.statAmountExpense, { color: colors.expense }]}>
                        {isBalanceHidden
                          ? `-${displayCurrency.symbol}•••••`
                          : `-${displayCurrency.symbol}${formatAmount(Math.abs(totalExpense))}`}
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
                      Haptics.selectionAsync().catch(() => {});
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
                        borderColor:
                          selectedCategory === 'incomes' || selectedCategory === 'income'
                            ? colors.income
                            : colors.tint,
                        backgroundColor:
                          selectedCategory === 'incomes' || selectedCategory === 'income'
                            ? isDark
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(16, 185, 129, 0.1)'
                            : colors.tintSoft,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCategoryModalVisible(true);
                    }}>
                    <Ionicons
                      name={
                        selectedCategory === 'incomes' || selectedCategory === 'income'
                          ? 'cash-outline'
                          : 'pricetag-outline'
                      }
                      size={15}
                      color={
                        selectedCategory != null
                          ? selectedCategory === 'incomes' || selectedCategory === 'income'
                            ? colors.income
                            : colors.tint
                          : colors.textSecondary
                      }
                    />
                    <ThemedText
                      style={[
                        styles.filterChipText,
                        { color: colors.text },
                        selectedCategory != null && {
                          color:
                            selectedCategory === 'incomes' || selectedCategory === 'income'
                              ? colors.income
                              : colors.tint,
                        },
                      ]}
                      numberOfLines={1}>
                      {selectedCategory ? getCategoryLabel(selectedCategory, language) : t('allCategories')}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
                  </AnimatedPressable>
                </View>

                {/* Transactions Section Header */}
                <View style={styles.sectionHeaderRow}>
                  <ThemedText style={[styles.sectionHeading, { color: colors.text }]}>
                    {t('recentTransactions')}
                  </ThemedText>
                  <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                    <ThemedText style={[styles.countBadgeText, { color: colors.tint }]}>
                      {filteredTransactions.length}
                    </ThemedText>
                  </View>
                </View>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons
                name={activeView === 'investments' ? 'trending-up-outline' : 'receipt-outline'}
                size={32}
                color={colors.textMuted}
              />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {activeView === 'investments' ? t('noInvestmentsFound') : t('noTransactionsFound')}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {activeView === 'investments' ? t('noInvestmentsSubtitle') : t('noTransactionsSubtitle')}
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
        <ThemedText style={[styles.modalSheetTitle, { color: colors.text }]}>{t('selectTimeRange')}</ThemedText>
        {getDateFilters(language).map((filter) => {
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
        <ThemedText style={[styles.modalSheetTitle, { color: colors.text }]}>{t('filterByCategory')}</ThemedText>
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
                {t('allCategories')}
              </ThemedText>
            </View>
            {selectedCategory === null && <Ionicons name="checkmark-circle" size={20} color={colors.tint} />}
          </AnimatedPressable>

          {/* Incomes Filter Option */}
          <AnimatedPressable
            style={[
              styles.modalItemRow,
              (selectedCategory === 'incomes' || selectedCategory === 'income') && [
                styles.modalItemRowActive,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' },
              ],
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => { });
              setSelectedCategory('incomes');
              setCategoryModalVisible(false);
            }}>
            <View style={styles.modalCategoryLeft}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={
                  selectedCategory === 'incomes' || selectedCategory === 'income'
                    ? colors.income
                    : colors.income
                }
              />
              <ThemedText
                style={[
                  styles.modalItemText,
                  { color: colors.text },
                  (selectedCategory === 'incomes' || selectedCategory === 'income') && [
                    styles.modalItemTextActive,
                    { color: colors.income },
                  ],
                ]}>
                {t('incomes')}
              </ThemedText>
            </View>
            {(selectedCategory === 'incomes' || selectedCategory === 'income') && (
              <Ionicons name="checkmark-circle" size={20} color={colors.income} />
            )}
          </AnimatedPressable>

          {expenseCategories.map((cat) => {
            const isSelected =
              selectedCategory === cat.key ||
              selectedCategory === cat.label ||
              selectedCategory === cat.labelTr ||
              selectedCategory === cat.labelEn;
            const catLabel = language === 'tr' ? cat.labelTr : cat.labelEn;
            return (
              <AnimatedPressable
                key={cat.key}
                style={[
                  styles.modalItemRow,
                  isSelected && [styles.modalItemRowActive, { backgroundColor: colors.tintSoft }],
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => { });
                  setSelectedCategory(cat.key);
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
                    {catLabel}
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
          <ThemedText style={[styles.deleteModalTitle, { color: colors.text }]}>{t('deleteConfirmTitle')}</ThemedText>
          <ThemedText style={[styles.deleteModalSubtitle, { color: colors.textSecondary }]}>
            {t('deleteConfirmDesc')}
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
                  {transactionToDelete.description || getCategoryLabel(transactionToDelete.category, language)}
                </ThemedText>
                <ThemedText style={[styles.deletePreviewCategory, { color: colors.textSecondary }]}>
                  {getCategoryLabel(transactionToDelete.category, language)}
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
            <ThemedText style={[styles.deleteCancelBtnText, { color: colors.text }]}>{t('cancel')}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.deleteConfirmBtn}
            onPress={handleConfirmDelete}>
            <Ionicons name="trash" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
            <ThemedText style={styles.deleteConfirmBtnText}>{t('delete')}</ThemedText>
          </TouchableOpacity>
        </View>
      </SwipeableModal>

      {/* Manual Current Price Update Modal for Investments */}
      <SwipeableModal
        visible={investmentToEditPrice !== null}
        onClose={() => setInvestmentToEditPrice(null)}
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
          <View style={[styles.deleteModalIconCircle, { backgroundColor: colors.tintSoft }]}>
            <Ionicons name="pricetag-outline" size={24} color={colors.tint} />
          </View>
          <ThemedText style={[styles.deleteModalTitle, { color: colors.text }]}>
            {t('updatePriceTitle')}
          </ThemedText>
          <ThemedText style={[styles.deleteModalSubtitle, { color: colors.textSecondary }]}>
            {t('updatePriceDesc')}
          </ThemedText>
        </View>

        {investmentToEditPrice && (
          <View
            style={[
              styles.priceInputCard,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border,
              },
            ]}>
            <ThemedText style={[styles.heroCurrencySymbol, { color: colors.tint, fontSize: 22 }]}>
              {currencies.find((c) => c.code === investmentToEditPrice.currency)?.symbol ||
                investmentToEditPrice.currency}
            </ThemedText>
            <TextInput
              value={editPriceInput}
              onChangeText={setEditPriceInput}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              style={[styles.priceInput, { color: colors.text }]}
              autoFocus={true}
            />
          </View>
        )}

        <View style={styles.deleteModalActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.deleteCancelBtn, { backgroundColor: colors.cardSecondary }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setInvestmentToEditPrice(null);
            }}>
            <ThemedText style={[styles.deleteCancelBtnText, { color: colors.text }]}>{t('cancel')}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.deleteConfirmBtn, { backgroundColor: colors.tint }]}
            onPress={handleSaveManualPrice}>
            <Ionicons name="checkmark" size={18} color={isDark ? '#000000' : '#FFFFFF'} style={{ marginRight: 6 }} />
            <ThemedText style={[styles.deleteConfirmBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
              {t('savePriceBtn')}
            </ThemedText>
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
    zIndex: 300,
  },
  userInfoBlock: {
    flex: 1,
    paddingRight: 8,
  },
  greetingText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F2F2F2',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  topCurrencyCenterWrapper: {
    position: 'relative',
    minWidth: 114,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  topCurrencyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 114,
    height: 36,
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  topCurrencyDropdown: {
    position: 'absolute',
    top: 0,
    minWidth: 114,
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 310,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  topCurrencyDropdownItem: {
    flexDirection: 'row',
    width: '100%',
    height: 36,
    gap: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 250,
  },
  topCurrencyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
    }),
  },
  topCurrencySymbol: {
    fontSize: 14,
    fontWeight: '800',
  },
  topCurrencyCode: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  topHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
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
    borderRadius: 24,
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
    gap: 7,
  },
  neonDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.tint,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 5,
      },
    }),
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9E9EA4',
    letterSpacing: 1,
  },
  eyeToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  liveLedgerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  liveLedgerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'visible',
    minHeight: 48,
  },
  heroCurrencySymbol: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
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
  heroChartWrapper: {
    width: '100%',
    height: 76,
    marginTop: 4,
    justifyContent: 'center',
  },
  currencyPillGroup: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  currencyPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
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
  viewModeSwitcher: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  viewModeTabActive: {
    borderWidth: 1,
  },
  viewModeTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  investmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  investmentRateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  rateSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rateSourceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  investmentPnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pnlBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  updatePriceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  updatePriceChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 20,
  },
  priceInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
  },
});