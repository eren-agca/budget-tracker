import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExchangeRates } from './currencyService';

export type MarketType = 'BIST' | 'US' | 'FOREX_METAL' | 'FUND' | 'CRYPTO';

export interface MarketStatusInfo {
  isOpen: boolean;
  marketType: MarketType;
  labelTr: string;
  labelEn: string;
  badgeLabelTr: string;
  badgeLabelEn: string;
}

const STORAGE_KEY_CLOSING_RATES = '@budget_tracker_market_closing_cache_v2';

/**
 * Returns current Turkey Time (TSİ = UTC+3, fixed year-round)
 */
export function getTurkeyTime(): {
  day: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const nowUtc = Date.now();
  // Turkey is permanently UTC+3
  const trtDate = new Date(nowUtc + 3 * 3600 * 1000);
  const day = trtDate.getUTCDay();
  const hours = trtDate.getUTCHours();
  const minutes = trtDate.getUTCMinutes();
  return {
    day,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

/**
 * Identifies the market type for an asset code
 */
export function getAssetMarketType(assetCode: string): MarketType {
  const upper = assetCode.toUpperCase().trim();
  if (upper.startsWith('BIST:')) return 'BIST';
  if (upper.startsWith('US:')) return 'US';
  if (upper.startsWith('FUND:')) return 'FUND';
  if (['BTC', 'ETH', 'XRP', 'SOL', 'AVAX', 'USDT'].includes(upper)) return 'CRYPTO';
  return 'FOREX_METAL'; // USD, EUR, GBP, XAU_GRAM, XAG_GRAM, etc.
}

/**
 * BIST (Borsa İstanbul) session hours:
 * Weekdays 09:55 - 18:15 TSİ (Continuous trading 10:00-18:00 + closing auction).
 * Closed on Saturdays, Sundays, and outside trading hours.
 */
export function isBistMarketOpen(): boolean {
  const { day, totalMinutes } = getTurkeyTime();
  const isWeekday = day >= 1 && day <= 5;
  // 09:55 (595m) to 18:15 (1095m)
  return isWeekday && totalMinutes >= 595 && totalMinutes <= 1095;
}

/**
 * US Stock Markets (NYSE, NASDAQ) session hours:
 * Weekdays 09:30 - 16:00 EST.
 * In Turkey Time (TSİ), covers ~16:30 to 23:59 TSİ.
 * Closed on Saturdays, Sundays, and outside trading hours.
 */
export function isUsMarketOpen(): boolean {
  const { day, totalMinutes } = getTurkeyTime();
  const isWeekday = day >= 1 && day <= 5;
  // 16:30 (990m) to 23:59 (1439m)
  return isWeekday && totalMinutes >= 990 && totalMinutes <= 1439;
}

/**
 * Global Forex & Precious Metals (USD, EUR, Gold, Silver):
 * Operates 24/5 worldwide.
 * Opens Sunday 23:00 TSİ (~17:00 EST / 22:00 UTC).
 * Closes Friday 24:00 TSİ (~17:00 EST).
 * Closed Saturday all day, and Sunday until 23:00 TSİ.
 */
export function isForexMetalMarketOpen(): boolean {
  const { day, totalMinutes } = getTurkeyTime();
  if (day === 6) return false; // Saturday: full close
  if (day === 0 && totalMinutes < 1380) return false; // Sunday before 23:00 TSİ: closed
  return true;
}

/**
 * TEFAS Investment Funds:
 * Unit prices (NAV) are officially announced once per business day (typically between 19:00 - 23:59).
 * During intra-day hours (00:00 - 18:30) and weekends, fund prices are static (they do not change).
 */
export function isFundTradingSession(): boolean {
  const { day, totalMinutes } = getTurkeyTime();
  const isWeekday = day >= 1 && day <= 5;
  // Active new daily price publication window: 18:30 - 23:59 TSİ on weekdays
  return isWeekday && totalMinutes >= 1110 && totalMinutes <= 1439;
}

/**
 * Crypto markets trade 24/7/365 without closing.
 */
export function isCryptoMarketOpen(): boolean {
  return true;
}

/**
 * Checks whether the market for a given asset is currently active and trading live.
 */
export function isMarketOpen(assetCodeOrMarket: string): boolean {
  const type =
    assetCodeOrMarket === 'BIST' ||
    assetCodeOrMarket === 'US' ||
    assetCodeOrMarket === 'FOREX_METAL' ||
    assetCodeOrMarket === 'FUND' ||
    assetCodeOrMarket === 'CRYPTO'
      ? (assetCodeOrMarket as MarketType)
      : getAssetMarketType(assetCodeOrMarket);

  switch (type) {
    case 'BIST':
      return isBistMarketOpen();
    case 'US':
      return isUsMarketOpen();
    case 'FOREX_METAL':
      return isForexMetalMarketOpen();
    case 'FUND':
      return isFundTradingSession();
    case 'CRYPTO':
      return isCryptoMarketOpen();
    default:
      return true;
  }
}

/**
 * Returns user-facing status details for a market
 */
export function getMarketStatusInfo(market: MarketType): MarketStatusInfo {
  const isOpen = isMarketOpen(market);
  switch (market) {
    case 'BIST':
      return {
        isOpen,
        marketType: 'BIST',
        labelTr: isOpen ? 'BIST Açık' : 'BIST Kapalı (Kapanış: 18:15)',
        labelEn: isOpen ? 'BIST Open' : 'BIST Closed (Close: 18:15)',
        badgeLabelTr: isOpen ? 'BIST CANLI' : 'BIST KAPANIŞ',
        badgeLabelEn: isOpen ? 'BIST LIVE' : 'BIST CLOSE',
      };
    case 'US':
      return {
        isOpen,
        marketType: 'US',
        labelTr: isOpen ? 'ABD Borsaları Açık' : 'ABD Borsaları Kapalı',
        labelEn: isOpen ? 'US Markets Open' : 'US Markets Closed',
        badgeLabelTr: isOpen ? 'ABD CANLI' : 'ABD KAPANIŞ',
        badgeLabelEn: isOpen ? 'US LIVE' : 'US CLOSE',
      };
    case 'FOREX_METAL':
      return {
        isOpen,
        marketType: 'FOREX_METAL',
        labelTr: isOpen ? 'Piyasalar Açık' : 'Piyasalar Kapalı (Hafta Sonu)',
        labelEn: isOpen ? 'Markets Open' : 'Markets Closed (Weekend)',
        badgeLabelTr: isOpen ? 'CANLI' : 'KAPANIŞ',
        badgeLabelEn: isOpen ? 'LIVE' : 'CLOSE',
      };
    case 'FUND':
      return {
        isOpen,
        marketType: 'FUND',
        labelTr: 'TEFAS Günlük Değer',
        labelEn: 'TEFAS Daily Value',
        badgeLabelTr: 'GÜNLÜK',
        badgeLabelEn: 'DAILY',
      };
    case 'CRYPTO':
      return {
        isOpen: true,
        marketType: 'CRYPTO',
        labelTr: 'Kripto 7/24 Açık',
        labelEn: 'Crypto 24/7 Open',
        badgeLabelTr: '7/24 CANLI',
        badgeLabelEn: '24/7 LIVE',
      };
  }
}

interface StoredMarketClosingSnapshot {
  updatedAt: number;
  rates: ExchangeRates;
  openRates: ExchangeRates;
}

let inMemoryClosingCache: StoredMarketClosingSnapshot | null = null;
let hasLoadedFromStorage = false;

/**
 * Loads persisted market closing rates from AsyncStorage
 */
export async function loadClosingRatesFromStorage(): Promise<{
  rates: ExchangeRates;
  openRates: ExchangeRates;
} | null> {
  if (inMemoryClosingCache && Object.keys(inMemoryClosingCache.rates).length > 0) {
    return {
      rates: inMemoryClosingCache.rates,
      openRates: inMemoryClosingCache.openRates,
    };
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_CLOSING_RATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.rates && typeof parsed.rates === 'object') {
        inMemoryClosingCache = {
          updatedAt: Number(parsed.updatedAt) || Date.now(),
          rates: parsed.rates,
          openRates: parsed.openRates || {},
        };
        hasLoadedFromStorage = true;
        return {
          rates: inMemoryClosingCache.rates,
          openRates: inMemoryClosingCache.openRates,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load market closing rates from storage:', err);
  }

  hasLoadedFromStorage = true;
  return null;
}

/**
 * Saves current market closing rates to AsyncStorage so they survive app restarts and reloads
 */
export async function saveClosingRatesToStorage(
  rates: ExchangeRates,
  openRates: ExchangeRates = {}
): Promise<void> {
  if (!rates || Object.keys(rates).length === 0) return;

  const current = inMemoryClosingCache?.rates || {};
  const currentOpen = inMemoryClosingCache?.openRates || {};

  const mergedRates = { ...current, ...rates };
  const mergedOpenRates = { ...currentOpen, ...openRates };

  inMemoryClosingCache = {
    updatedAt: Date.now(),
    rates: mergedRates,
    openRates: mergedOpenRates,
  };

  try {
    await AsyncStorage.setItem(
      STORAGE_KEY_CLOSING_RATES,
      JSON.stringify(inMemoryClosingCache)
    );
  } catch (err) {
    console.warn('Failed to save market closing rates to storage:', err);
  }
}

/**
 * Synchronous getter for in-memory closing rates
 */
export function getInMemoryClosingRates(): {
  rates: ExchangeRates;
  openRates: ExchangeRates;
} | null {
  if (!inMemoryClosingCache) return null;
  return {
    rates: inMemoryClosingCache.rates,
    openRates: inMemoryClosingCache.openRates,
  };
}

