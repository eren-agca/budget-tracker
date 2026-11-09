import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
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
import { StockBrandBadge } from '@/components/BrandLogo';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { expenseCategories, incomeCategories, getCategoryLabel, isSavingsCategory } from '@/constants/Categories';
import { INVESTMENT_PRESETS, getLiveAssetRateInTRY, getPresetLabel } from '@/constants/Investments';
import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import {
  fetchSingleAssetQuote,
  POPULAR_BIST_STOCKS,
  POPULAR_TEFAS_FUNDS,
  POPULAR_US_STOCKS,
  QuickAssetPreset,
  registerTrackedAssetCodes,
} from '@/services/stockFundService';
import { addUserDoc } from '@/services/userDataService';
import { useAuth } from '@/context/AuthContext';
import { useSettings, ThemeColors } from '@/context/SettingsContext';
import { Colors } from '@/constants/Colors';

export default function AddTransactionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark, t, language } = useSettings();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [selectedAssetCode, setSelectedAssetCode] = useState<string>('XAU_GRAM');
  const [investmentTab, setInvestmentTab] = useState<'market' | 'fund' | 'stock' | 'crypto'>('market');
  const [stockMarket, setStockMarket] = useState<'BIST' | 'US'>('BIST');
  const [activeMarketGroup, setActiveMarketGroup] = useState<'TEFAS_FUND' | 'STOCK_BIST' | 'STOCK_US' | null>(null);
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [liveRates, setLiveRates] = useState<ExchangeRates | null>(null);
  const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);
  const [type, setType] = useState<'expense' | 'income' | 'investment'>('expense');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    getExchangeRates(true)
      .then((r) => {
        if (r) setLiveRates(r);
      })
      .catch(() => {});
  }, []);

  const formatRateString = (val: number, assetCode: string) => {
    if (assetCode.startsWith('FUND:') || val < 10) {
      return Number(val.toFixed(4)).toString();
    }
    return val.toFixed(2);
  };

  const applyPresetRate = (assetCode: string, curr: Currency, ratesObj: ExchangeRates | null) => {
    if (!ratesObj || assetCode === 'CUSTOM') return;
    const { unitRateInTRY } = getLiveAssetRateInTRY(ratesObj, assetCode);
    if (unitRateInTRY && unitRateInTRY > 0) {
      const currRate = ratesObj[curr.code] || 1;
      const converted = unitRateInTRY / currRate;
      setPurchaseRate(formatRateString(converted, assetCode));
    }
  };

  const selectStockOrFundAsset = async (
    fullAssetCode: string,
    displayTitle: string,
    targetCurr: Currency = transactionCurrency
  ) => {
    setSelectedAssetCode(fullAssetCode);
    setDescription(displayTitle);
    const cachedTry = liveRates?.[fullAssetCode];
    if (cachedTry && cachedTry > 0) {
      const currRate = liveRates?.[targetCurr.code] || 1;
      setPurchaseRate(formatRateString(cachedTry / currRate, fullAssetCode));
    }
    setFetchingQuote(true);
    try {
      const usdTry = liveRates?.USD || 34.5;
      const quote = await fetchSingleAssetQuote(fullAssetCode, usdTry);
      if (quote && quote.priceInTRY > 0) {
        setLiveRates((prev) => ({ ...(prev || { TRY: 1 }), [fullAssetCode]: quote.priceInTRY }));
        const currRate = liveRates?.[targetCurr.code] || (targetCurr.code === 'USD' ? usdTry : 1);
        const converted = quote.priceInTRY / currRate;
        setPurchaseRate(formatRateString(converted, fullAssetCode));
      }
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleTypeChange = (newType: 'expense' | 'income' | 'investment') => {
    Haptics.selectionAsync().catch(() => {});
    setType(newType);
    if (newType === 'investment') {
      setCategory('Savings');
      setInvestmentTab('market');
      setActiveMarketGroup(null);
      setSelectedAssetCode('XAU_GRAM');
      setDescription(getPresetLabel('XAU_GRAM', language));
      applyPresetRate('XAU_GRAM', transactionCurrency, liveRates);
    } else {
      setCategory('');
      setPurchaseRate('');
      setDescription('');
      setActiveMarketGroup(null);
    }
  };

  const isSavings = type === 'investment' || (type === 'expense' && isSavingsCategory(category));

  const MARKET_TAB_CODES = ['XAU_GRAM', 'XAU_QUARTER', 'XAU_HALF', 'XAU_FULL', 'XAG_GRAM', 'USD', 'EUR', 'GBP'];
  const CRYPTO_TAB_CODES = ['BTC', 'ETH', 'XRP', 'CUSTOM'];

  const handleSelectInvestmentTab = (tab: 'market' | 'fund' | 'stock' | 'crypto') => {
    Haptics.selectionAsync().catch(() => {});
    setInvestmentTab(tab);
    setCustomTickerInput('');
    if (tab === 'market') {
      setActiveMarketGroup(null);
      if (!MARKET_TAB_CODES.includes(selectedAssetCode)) {
        const tryCurr = currencies.find((c) => c.code === 'TRY') || defaultCurrency;
        setTransactionCurrency(tryCurr);
        setSelectedAssetCode('XAU_GRAM');
        setDescription(getPresetLabel('XAU_GRAM', language));
        applyPresetRate('XAU_GRAM', tryCurr, liveRates);
      }
    } else if (tab === 'fund') {
      setActiveMarketGroup('TEFAS_FUND');
      if (!selectedAssetCode.startsWith('FUND:')) {
        const first = POPULAR_TEFAS_FUNDS[0];
        const tryCurr = currencies.find((c) => c.code === 'TRY') || defaultCurrency;
        setTransactionCurrency(tryCurr);
        selectStockOrFundAsset(first.assetCode, language === 'tr' ? first.nameTr : first.nameEn, tryCurr);
      }
    } else if (tab === 'stock') {
      const targetGroup = stockMarket === 'BIST' ? 'STOCK_BIST' : 'STOCK_US';
      setActiveMarketGroup(targetGroup);
      if (stockMarket === 'BIST' && !selectedAssetCode.startsWith('BIST:')) {
        const first = POPULAR_BIST_STOCKS[0];
        const tryCurr = currencies.find((c) => c.code === 'TRY') || defaultCurrency;
        setTransactionCurrency(tryCurr);
        selectStockOrFundAsset(first.assetCode, language === 'tr' ? first.nameTr : first.nameEn, tryCurr);
      } else if (stockMarket === 'US' && !selectedAssetCode.startsWith('US:')) {
        const first = POPULAR_US_STOCKS[0];
        const usdCurr = currencies.find((c) => c.code === 'USD') || transactionCurrency;
        setTransactionCurrency(usdCurr);
        selectStockOrFundAsset(first.assetCode, language === 'tr' ? first.nameTr : first.nameEn, usdCurr);
      }
    } else if (tab === 'crypto') {
      setActiveMarketGroup(null);
      if (!CRYPTO_TAB_CODES.includes(selectedAssetCode)) {
        setSelectedAssetCode('BTC');
        setDescription(getPresetLabel('BTC', language));
        applyPresetRate('BTC', transactionCurrency, liveRates);
      }
    }
  };

  const handleToggleStockMarket = (mkt: 'BIST' | 'US') => {
    Haptics.selectionAsync().catch(() => {});
    setStockMarket(mkt);
    setCustomTickerInput('');
    if (mkt === 'BIST') {
      setActiveMarketGroup('STOCK_BIST');
      const first = POPULAR_BIST_STOCKS[0];
      const tryCurr = currencies.find((c) => c.code === 'TRY') || defaultCurrency;
      setTransactionCurrency(tryCurr);
      selectStockOrFundAsset(first.assetCode, language === 'tr' ? first.nameTr : first.nameEn, tryCurr);
    } else {
      setActiveMarketGroup('STOCK_US');
      const first = POPULAR_US_STOCKS[0];
      const usdCurr = currencies.find((c) => c.code === 'USD') || transactionCurrency;
      setTransactionCurrency(usdCurr);
      selectStockOrFundAsset(first.assetCode, language === 'tr' ? first.nameTr : first.nameEn, usdCurr);
    }
  };

  const handleSelectAssetPreset = (presetCode: string) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveMarketGroup(null);
    setSelectedAssetCode(presetCode);
    if (presetCode === 'CUSTOM') {
      setDescription('');
      setPurchaseRate('');
    } else {
      setDescription(getPresetLabel(presetCode, language));
      applyPresetRate(presetCode, transactionCurrency, liveRates);
    }
  };

  const handleSearchCustomSymbol = async () => {
    const clean = customTickerInput.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (!clean) return;
    Haptics.selectionAsync().catch(() => {});
    const prefix =
      investmentTab === 'fund'
        ? 'FUND:'
        : stockMarket === 'BIST'
        ? 'BIST:'
        : 'US:';
    const fullCode = `${prefix}${clean.replace(/\.IS$/i, '')}`;
    const label = getPresetLabel(fullCode, language);
    await selectStockOrFundAsset(fullCode, label, transactionCurrency);
  };

  const handleSaveTransaction = async () => {
    if (!user) {
      Alert.alert(language === 'tr' ? 'Hata' : 'Error', language === 'tr' ? 'Kullanıcı oturumu bulunamadı.' : 'User not authenticated. Please try again.');
      return;
    }

    const isExpenseOrInv = type === 'expense' || type === 'investment';
    const effectiveCategory = type === 'investment' ? 'Savings' : category;
    const effectiveDescription =
      isSavings && selectedAssetCode !== 'CUSTOM' && !description
        ? getPresetLabel(selectedAssetCode, language)
        : description;
    const savingsFieldsValid = !isSavings || purchaseRate;

    if ((isExpenseOrInv && !effectiveDescription) || !amount || !effectiveCategory || !savingsFieldsValid) {
      Alert.alert(language === 'tr' ? 'Eksik Alan' : 'Incomplete Form', t('fillAllFields'));
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert(language === 'tr' ? 'Geçersiz Tutar' : 'Invalid Amount', t('invalidAmount'));
      return;
    }

    const numericPurchaseRate = parseFloat(purchaseRate.replace(',', '.'));
    if (isSavings && (isNaN(numericPurchaseRate) || numericPurchaseRate <= 0)) {
      Alert.alert(language === 'tr' ? 'Geçersiz Kur' : 'Invalid Rate', t('invalidRate'));
      return;
    }

    setLoading(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const totalCost = isSavings ? numericAmount * numericPurchaseRate : numericAmount;

      const transactionData: any = {
        description: isExpenseOrInv ? effectiveDescription : (getCategoryLabel(effectiveCategory, language) || effectiveCategory),
        amount: isExpenseOrInv ? -Math.abs(totalCost) : Math.abs(totalCost),
        category: effectiveCategory,
        currency: transactionCurrency.code,
        type: isExpenseOrInv ? 'expense' : 'income',
        date: Timestamp.now(),
      };

      if (isSavings) {
        transactionData.purchaseRate = numericPurchaseRate;
        transactionData.assetQuantity = numericAmount;
        transactionData.assetCode = selectedAssetCode;
        registerTrackedAssetCodes([selectedAssetCode]);
      }

      await addUserDoc(user, 'transactions', transactionData);

      Toast.show({
        type: 'success',
        text1: t('transactionSaved'),
        text2: t('transactionSavedDesc'),
      });

      router.back();
    } catch (error) {
      console.error('Error adding document: ', error);
      Alert.alert(language === 'tr' ? 'Hata' : 'Error', language === 'tr' ? 'İşlem kaydedilirken bir hata oluştu.' : 'An error occurred while saving the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (text: string) => {
    if (text.length > 14) return;
    const numericRegex = /^\d*([.,]\d{0,4})?$/;
    if (numericRegex.test(text) || text === '') {
      setAmount(text);
    }
  };

  const handleRateChange = (text: string) => {
    if (text.length > 14) return;
    const numericRegex = /^\d*([.,]\d{0,6})?$/;
    if (numericRegex.test(text) || text === '') {
      setPurchaseRate(text);
    }
  };

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
        <ThemedText style={styles.navTitle}>{t('newTransactionTitle')}</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        
        {/* Segmented Type Toggle (Expense / Income / Investment) */}
        <View style={styles.typeSwitcher}>
          <AnimatedPressable
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActiveExpense]}
            onPress={() => handleTypeChange('expense')}>
            <Ionicons name="arrow-up" size={15} color={type === 'expense' ? colors.text : colors.textSecondary} />
            <ThemedText style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
              {t('expenseType')}
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
            onPress={() => handleTypeChange('income')}>
            <Ionicons name="arrow-down" size={15} color={type === 'income' ? (isDark ? '#000' : '#FFF') : colors.textSecondary} />
            <ThemedText
              style={[
                styles.typeButtonText,
                type === 'income' && { color: isDark ? '#000' : '#FFF', fontWeight: '800' },
              ]}>
              {t('incomeType')}
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.typeButton, type === 'investment' && styles.typeButtonActiveIncome]}
            onPress={() => handleTypeChange('investment')}>
            <Ionicons
              name="trending-up"
              size={15}
              color={type === 'investment' ? (isDark ? '#000' : '#FFF') : colors.textSecondary}
            />
            <ThemedText
              style={[
                styles.typeButtonText,
                type === 'investment' && { color: isDark ? '#000' : '#FFF', fontWeight: '800' },
              ]}>
              {t('investmentType')}
            </ThemedText>
          </AnimatedPressable>
        </View>

        {/* Hero Amount / Quantity Display & Input Card */}
        <View style={styles.amountCard}>
          <ThemedText style={styles.amountLabel}>
            {isSavings ? t('enterQuantityLabel') : t('enterAmount')}
          </ThemedText>
          <View style={styles.amountRow}>
            {!isSavings && (
              <ThemedText style={styles.currencySymbolLarge}>{transactionCurrency.symbol}</ThemedText>
            )}
            <TextInput
              placeholder={isSavings ? '1' : '0.00'}
              value={amount}
              onChangeText={handleAmountChange}
              style={styles.amountInput}
              keyboardType="numeric"
              maxLength={12}
              placeholderTextColor="#444"
              autoFocus={false}
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
                    if (isSavings && selectedAssetCode !== 'CUSTOM') {
                      applyPresetRate(selectedAssetCode, c, liveRates);
                    }
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

        {/* Description Field (For regular Expense or Custom Investment) */}
        {(type === 'expense' && !isSavings) || (isSavings && selectedAssetCode === 'CUSTOM') ? (
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Ionicons name="create-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
              <TextInput
                placeholder={isSavings ? t('assetNamePlaceholder') : t('descriptionPlaceholder')}
                value={description}
                onChangeText={setDescription}
                style={styles.fieldInput}
                maxLength={60}
                placeholderTextColor="#636366"
              />
            </View>
          </View>
        ) : null}

        {/* Savings / Investment Purchase Rate Field */}
        {isSavings && (
          <View style={{ marginBottom: 16 }}>
            <ThemedText
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: colors.textSecondary,
                letterSpacing: 0.4,
                marginBottom: 6,
                marginLeft: 4,
              }}>
              {language === 'tr'
                ? 'BİRİM ALIŞ FİYATINIZ / MALİYET (Kâr/Zarar hesabı için)'
                : 'YOUR UNIT BUY PRICE / COST (For Profit/Loss tracking)'}
            </ThemedText>
            <View style={[styles.inputCard, { marginBottom: 0 }]}>
              <View style={styles.inputRow}>
                <Ionicons name="pricetag-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                <TextInput
                  placeholder={`${t('purchaseRatePlaceholder')} ${transactionCurrency.symbol})`}
                  value={purchaseRate}
                  onChangeText={handleRateChange}
                  style={styles.fieldInput}
                  keyboardType="numeric"
                  placeholderTextColor="#636366"
                />
              </View>
            </View>
          </View>
        )}

        {/* Categories or Investment Asset Selection Section */}
        <View style={styles.sectionWrap}>
          <ThemedText style={styles.sectionTitle}>
            {isSavings
              ? t('selectInvestmentAsset')
              : type === 'expense'
              ? t('selectCategory')
              : t('incomeSourceSelect')}
          </ThemedText>

          {isSavings ? (
            <View style={styles.investmentSelectorCard}>
              {/* 1. Compact 4-Category Filter Tabs */}
              <View style={styles.investmentTabBar}>
                {(
                  [
                    {
                      key: 'market',
                      icon: 'diamond-outline' as const,
                      labelTr: 'Altın & Döviz',
                      labelEn: 'Gold & FX',
                    },
                    {
                      key: 'fund',
                      icon: 'pie-chart-outline' as const,
                      labelTr: 'Fon (TEFAS)',
                      labelEn: 'Funds',
                    },
                    {
                      key: 'stock',
                      icon: 'stats-chart-outline' as const,
                      labelTr: 'Hisse',
                      labelEn: 'Stocks',
                    },
                    {
                      key: 'crypto',
                      icon: 'logo-bitcoin' as const,
                      labelTr: 'Kripto',
                      labelEn: 'Crypto',
                    },
                  ] as const
                ).map((tabItem) => {
                  const isTabActive = investmentTab === tabItem.key;
                  return (
                    <AnimatedPressable
                      key={tabItem.key}
                      onPress={() => handleSelectInvestmentTab(tabItem.key)}
                      style={[
                        styles.investmentTabBtn,
                        isTabActive && styles.investmentTabBtnActive,
                      ]}>
                      <Ionicons
                        name={tabItem.icon}
                        size={13}
                        color={isTabActive ? (isDark ? '#000' : '#FFF') : colors.textSecondary}
                      />
                      <ThemedText
                        style={[
                          styles.investmentTabText,
                          isTabActive && styles.investmentTabTextActive,
                        ]}
                        numberOfLines={1}>
                        {language === 'tr' ? tabItem.labelTr : tabItem.labelEn}
                      </ThemedText>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* 2. Optional Compact Sub-Toolbar for Funds & Stocks (BIST/US Toggle + Custom Code Input) */}
              {(investmentTab === 'fund' || investmentTab === 'stock') && (
                <View style={styles.compactSearchToolbar}>
                  {investmentTab === 'stock' && (
                    <View style={styles.marketMiniSwitch}>
                      <AnimatedPressable
                        onPress={() => handleToggleStockMarket('BIST')}
                        style={[
                          styles.marketMiniSwitchBtn,
                          stockMarket === 'BIST' && styles.marketMiniSwitchBtnActive,
                        ]}>
                        <ThemedText
                          style={[
                            styles.marketMiniSwitchText,
                            stockMarket === 'BIST' && styles.marketMiniSwitchTextActive,
                          ]}>
                          BIST
                        </ThemedText>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleToggleStockMarket('US')}
                        style={[
                          styles.marketMiniSwitchBtn,
                          stockMarket === 'US' && styles.marketMiniSwitchBtnActive,
                        ]}>
                        <ThemedText
                          style={[
                            styles.marketMiniSwitchText,
                            stockMarket === 'US' && styles.marketMiniSwitchTextActive,
                          ]}>
                          ABD
                        </ThemedText>
                      </AnimatedPressable>
                    </View>
                  )}

                  <View style={styles.compactSearchInputWrap}>
                    <Ionicons name="search" size={14} color={colors.textMuted} />
                    <TextInput
                      placeholder={
                        investmentTab === 'fund'
                          ? language === 'tr'
                            ? 'Fon kodu (AFA, TI1, YAY...)'
                            : 'Fund code (AFA, TI1...)'
                          : stockMarket === 'BIST'
                          ? language === 'tr'
                            ? 'Hisse kodu (THYAO, FROTO...)'
                            : 'BIST ticker (THYAO...)'
                          : language === 'tr'
                          ? 'ABD kodu (NVDA, AAPL...)'
                          : 'US ticker (NVDA...)'
                      }
                      value={customTickerInput}
                      onChangeText={(txt) => setCustomTickerInput(txt.toUpperCase())}
                      onSubmitEditing={handleSearchCustomSymbol}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={10}
                      placeholderTextColor={colors.textMuted}
                      style={styles.compactSearchInput}
                    />
                    {fetchingQuote ? (
                      <ActivityIndicator size="small" color={colors.tint} />
                    ) : (
                      <AnimatedPressable
                        onPress={handleSearchCustomSymbol}
                        style={styles.compactFetchBtn}>
                        <Ionicons name="flash" size={12} color={isDark ? '#000' : '#FFF'} />
                        <ThemedText style={styles.compactFetchBtnText}>
                          {language === 'tr' ? 'Bul' : 'Fetch'}
                        </ThemedText>
                      </AnimatedPressable>
                    )}
                  </View>
                </View>
              )}

              {/* 3. Single-Row Horizontal Scroll of Filtered Assets */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalAssetRow}>
                {investmentTab === 'market' &&
                  INVESTMENT_PRESETS.filter((p) => MARKET_TAB_CODES.includes(p.code)).map(
                    (preset) => {
                      const isSelected = selectedAssetCode === preset.code;
                      const label = language === 'tr' ? preset.labelTr : preset.labelEn;
                      return (
                        <AnimatedPressable
                          key={preset.code}
                          onPress={() => handleSelectAssetPreset(preset.code)}
                          style={[
                            styles.horizontalAssetChip,
                            isSelected && styles.shortcutChipActive,
                          ]}>
                          <View
                            style={[
                              styles.assetIconCircle,
                              isSelected && { backgroundColor: 'rgba(57, 255, 20, 0.2)' },
                            ]}>
                            <Ionicons
                              name={preset.icon}
                              size={16}
                              color={isSelected ? colors.tint : colors.textSecondary}
                            />
                          </View>
                          <ThemedText
                            style={[
                              styles.shortcutText,
                              isSelected && styles.shortcutTextActive,
                            ]}>
                            {label}
                          </ThemedText>
                        </AnimatedPressable>
                      );
                    }
                  )}

                {investmentTab === 'fund' &&
                  POPULAR_TEFAS_FUNDS.map((item: QuickAssetPreset) => {
                    const isChipSelected = selectedAssetCode === item.assetCode;
                    const chipText =
                      language === 'tr'
                        ? item.chipLabelTr || item.symbol
                        : item.chipLabelEn || item.symbol;
                    return (
                      <AnimatedPressable
                        key={item.assetCode}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setCustomTickerInput(item.symbol);
                          selectStockOrFundAsset(
                            item.assetCode,
                            language === 'tr' ? item.nameTr : item.nameEn,
                            transactionCurrency
                          );
                        }}
                        style={[
                          styles.horizontalAssetChip,
                          isChipSelected && styles.shortcutChipActive,
                        ]}>
                        <StockBrandBadge symbol={item.symbol} size={24} iconSize={13} />
                        <ThemedText
                          style={[
                            styles.shortcutText,
                            isChipSelected && styles.shortcutTextActive,
                          ]}>
                          {chipText}
                        </ThemedText>
                      </AnimatedPressable>
                    );
                  })}

                {investmentTab === 'stock' &&
                  (stockMarket === 'BIST' ? POPULAR_BIST_STOCKS : POPULAR_US_STOCKS).map(
                    (item: QuickAssetPreset) => {
                      const isChipSelected = selectedAssetCode === item.assetCode;
                      return (
                        <AnimatedPressable
                          key={item.assetCode}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setCustomTickerInput(item.symbol);
                            selectStockOrFundAsset(
                              item.assetCode,
                              language === 'tr' ? item.nameTr : item.nameEn,
                              transactionCurrency
                            );
                          }}
                          style={[
                            styles.stockLogoTile,
                            isChipSelected && styles.shortcutChipActive,
                          ]}>
                          <StockBrandBadge symbol={item.symbol} size={30} iconSize={16} />
                          <ThemedText
                            style={[
                              styles.stockLogoTileCode,
                              isChipSelected && styles.shortcutTextActive,
                            ]}>
                            {item.symbol}
                          </ThemedText>
                        </AnimatedPressable>
                      );
                    }
                  )}

                {investmentTab === 'crypto' &&
                  INVESTMENT_PRESETS.filter((p) => CRYPTO_TAB_CODES.includes(p.code)).map(
                    (preset) => {
                      const isSelected = selectedAssetCode === preset.code;
                      const label = language === 'tr' ? preset.labelTr : preset.labelEn;
                      return (
                        <AnimatedPressable
                          key={preset.code}
                          onPress={() => handleSelectAssetPreset(preset.code)}
                          style={[
                            styles.horizontalAssetChip,
                            isSelected && styles.shortcutChipActive,
                          ]}>
                          <View
                            style={[
                              styles.assetIconCircle,
                              isSelected && { backgroundColor: 'rgba(57, 255, 20, 0.2)' },
                            ]}>
                            <Ionicons
                              name={preset.icon}
                              size={16}
                              color={isSelected ? colors.tint : colors.textSecondary}
                            />
                          </View>
                          <ThemedText
                            style={[
                              styles.shortcutText,
                              isSelected && styles.shortcutTextActive,
                            ]}>
                            {label}
                          </ThemedText>
                        </AnimatedPressable>
                      );
                    }
                  )}
              </ScrollView>

              {/* 4. Compact Selected Asset Summary Strip */}
              {description && selectedAssetCode !== 'CUSTOM' ? (
                <View style={styles.selectedAssetBanner}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.tint} />
                  <ThemedText style={styles.selectedAssetBannerText} numberOfLines={1}>
                    {description}
                    {purchaseRate ? ` • ${transactionCurrency.symbol}${purchaseRate}` : ''}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : type === 'expense' ? (
            <View style={styles.categoryGrid}>
              {expenseCategories.map((cat) => {
                const isSelected = category === cat.label || category === cat.key || category === cat.labelTr || category === cat.labelEn;
                const label = language === 'tr' ? cat.labelTr : cat.labelEn;
                return (
                  <AnimatedPressable
                    key={cat.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCategory(cat.label);
                      if (isSavingsCategory(cat.label)) {
                        setSelectedAssetCode('XAU_GRAM');
                        setDescription(getPresetLabel('XAU_GRAM', language));
                        applyPresetRate('XAU_GRAM', transactionCurrency, liveRates);
                      }
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
                      {label}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>
          ) : (
            <>
              {/* Income Shortcut Chips */}
              <View style={styles.incomeShortcuts}>
                {incomeCategories.map((item) => {
                  const isSelected = category === item.label || category === item.key || category === item.labelTr || category === item.labelEn;
                  const label = language === 'tr' ? item.labelTr : item.labelEn;
                  return (
                    <AnimatedPressable
                      key={item.key}
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
                        {label}
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
                    placeholder={t('customIncomeSourcePlaceholder')}
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
                {t('saveTransaction')}
              </ThemedText>
            </>
          )}
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    typeSwitcher: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 59, 48, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    },
    typeButtonActiveIncome: {
      backgroundColor: colors.tint,
    },
    typeButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    typeButtonTextActive: {
      color: colors.text,
    },
    amountCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: colors.shadow.shadowOpacity,
          shadowRadius: 10,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    amountLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
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
      color: colors.tint,
      marginRight: 6,
    },
    amountInput: {
      fontSize: 42,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -1,
      minWidth: 120,
      textAlign: 'center',
    },
    currencyPills: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: '100%',
    },
    currencyPill: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 9,
      alignItems: 'center',
    },
    currencyPillActive: {
      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.tint,
    },
    currencyPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    currencyPillTextActive: {
      color: colors.tint,
    },
    inputCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
    },
    sectionWrap: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textSecondary,
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
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 6,
    },
    categoryTileActive: {
      borderColor: colors.tint,
      backgroundColor: colors.tintSoft,
    },
    categoryIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? '#141416' : '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    categoryLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    categoryLabelActive: {
      color: colors.tint,
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
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    shortcutChipActive: {
      borderColor: colors.tint,
      backgroundColor: colors.tintSoft,
    },
    shortcutText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    shortcutTextActive: {
      color: colors.tint,
      fontWeight: '700',
    },
    investmentSelectorCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    investmentTabBar: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 2,
    },
    investmentTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 9,
      gap: 4,
    },
    investmentTabBtnActive: {
      backgroundColor: colors.tint,
    },
    investmentTabText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    investmentTabTextActive: {
      color: isDark ? '#000000' : '#FFFFFF',
      fontWeight: '800',
    },
    compactSearchToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    marketMiniSwitch: {
      flexDirection: 'row',
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      padding: 2,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    marketMiniSwitchBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    marketMiniSwitchBtnActive: {
      backgroundColor: isDark ? '#26282E' : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.tint,
    },
    marketMiniSwitchText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    marketMiniSwitchTextActive: {
      color: colors.tint,
      fontWeight: '800',
    },
    compactSearchInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 38,
      backgroundColor: colors.cardSecondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingLeft: 10,
      paddingRight: 4,
      gap: 6,
    },
    compactSearchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 0,
    },
    compactFetchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 7,
      gap: 3,
    },
    compactFetchBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#000000' : '#FFFFFF',
    },
    horizontalAssetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 2,
    },
    horizontalAssetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 7,
    },
    assetIconCircle: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: isDark ? '#1A1C22' : '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stockLogoTile: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minWidth: 64,
      gap: 4,
    },
    stockLogoTileCode: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    selectedAssetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.tintSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    selectedAssetBannerText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.tint,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
      borderRadius: 16,
      height: 54,
      gap: 8,
      marginTop: 8,
      ...Platform.select({
        ios: {
          shadowColor: isDark ? colors.tint : '#64748B',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.45 : 0.15,
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
      color: isDark ? '#000000' : '#FFFFFF',
      letterSpacing: 0.2,
    },
  });