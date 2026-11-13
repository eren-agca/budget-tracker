import { Platform } from 'react-native';
import { getStockAndFundRates } from './stockFundService';
import {
  isForexMetalMarketOpen,
  loadClosingRatesFromStorage,
  saveClosingRatesToStorage,
} from './marketHoursService';

export interface ExchangeRates {
  [key: string]: number;
}

interface RawFiatResult {
  rates: ExchangeRates;
  openRates: ExchangeRates;
}

interface RawMetalResult {
  xauUsd?: number;
  xagUsd?: number;
  xauOpenUsd?: number;
  xagOpenUsd?: number;
}

interface RawCryptoResult {
  tryRates: ExchangeRates;
  tryOpenRates: ExchangeRates;
  usdRates: ExchangeRates;
  usdOpenRates: ExchangeRates;
}

const OUNCE_TO_GRAM = 31.1035;

// In-memory cache with 60-second TTL and in-flight deduplication to avoid rate limits
let cachedRates: ExchangeRates | null = null;
let cachedOpenRates: ExchangeRates | null = null;
let lastCacheTime = 0;
let inFlightRatesPromise: Promise<ExchangeRates | null> | null = null;
let coinGeckoCooldownUntil = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const getPreviousBusinessDateString = (): string => {
  const d = new Date();
  const day = d.getDay();
  if (day === 1) {
    d.setDate(d.getDate() - 3); // Monday -> Friday
  } else if (day === 0) {
    d.setDate(d.getDate() - 2); // Sunday -> Friday
  } else {
    d.setDate(d.getDate() - 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getFiatRatesRaw = async (): Promise<RawFiatResult> => {
  const rates: ExchangeRates = {};
  const openRates: ExchangeRates = {};

  try {
    const prevDateStr = getPreviousBusinessDateString();
    const requests: Promise<Response>[] = [fetch('https://open.er-api.com/v6/latest/USD')];
    if (Platform.OS !== 'web') {
      requests.push(fetch(`https://api.frankfurter.dev/v1/${prevDateStr}?base=USD&symbols=TRY,EUR,GBP`));
    }
    const [latestRes, prevRes] = await Promise.allSettled(requests);

    if (latestRes.status === 'fulfilled' && latestRes.value.ok) {
      const data = await latestRes.value.json();
      if (data?.rates?.TRY) {
        const usdToTry = data.rates.TRY;
        const usdToEur = data.rates.EUR;
        const usdToGbp = data.rates.GBP;
        rates.USD = usdToTry;
        if (usdToEur) rates.EUR = usdToTry / usdToEur;
        if (usdToGbp) rates.GBP = usdToTry / usdToGbp;
      }
    }

    if (!rates.USD) {
      const cdnFallback = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'
      );
      if (cdnFallback.ok) {
        const data = await cdnFallback.json();
        if (data?.usd?.try) {
          const usdToTry = data.usd.try;
          const usdToEur = data.usd.eur;
          const usdToGbp = data.usd.gbp;
          rates.USD = usdToTry;
          if (usdToEur) rates.EUR = usdToTry / usdToEur;
          if (usdToGbp) rates.GBP = usdToTry / usdToGbp;
        }
      }
    }

    if (prevRes && prevRes.status === 'fulfilled' && prevRes.value.ok) {
      const prevData = await prevRes.value.json();
      if (prevData?.rates?.TRY) {
        const prevUsdToTry = prevData.rates.TRY;
        const prevUsdToEur = prevData.rates.EUR;
        const prevUsdToGbp = prevData.rates.GBP;
        openRates.USD = prevUsdToTry;
        if (prevUsdToEur) openRates.EUR = prevUsdToTry / prevUsdToEur;
        if (prevUsdToGbp) openRates.GBP = prevUsdToTry / prevUsdToGbp;
      }
    }
  } catch (error) {
    console.warn('Error fetching fiat rates:', error);
  }

  return { rates, openRates };
};

const getMetalRatesRaw = async (): Promise<RawMetalResult> => {
  const result: RawMetalResult = {};

  try {
    // Fetch real-time spot prices (skip goldprice.org on web due to browser CORS policy)
    const requests: Promise<Response>[] = [
      fetch('https://api.gold-api.com/price/XAU'),
      fetch('https://api.gold-api.com/price/XAG'),
    ];
    if (Platform.OS !== 'web') {
      requests.push(fetch('https://data-asg.goldprice.org/dbXRates/USD'));
    }
    const [goldRes, silverRes, gpRes] = await Promise.allSettled(requests);

    if (goldRes.status === 'fulfilled' && goldRes.value.ok) {
      const goldData = await goldRes.value.json();
      if (typeof goldData?.price === 'number') {
        result.xauUsd = goldData.price;
      }
    }

    if (silverRes.status === 'fulfilled' && silverRes.value.ok) {
      const silverData = await silverRes.value.json();
      if (typeof silverData?.price === 'number') {
        result.xagUsd = silverData.price;
      }
    }

    if (gpRes && gpRes.status === 'fulfilled' && gpRes.value.ok) {
      const gpData = await gpRes.value.json();
      const item = gpData?.items?.[0];
      if (item) {
        if (!result.xauUsd && typeof item.xauPrice === 'number') {
          result.xauUsd = item.xauPrice;
        }
        if (!result.xagUsd && typeof item.xagPrice === 'number') {
          result.xagUsd = item.xagPrice;
        }
        if (typeof item.xauClose === 'number' && item.xauClose > 0) {
          result.xauOpenUsd = item.xauClose;
        }
        if (typeof item.xagClose === 'number' && item.xagClose > 0) {
          result.xagOpenUsd = item.xagClose;
        }
      }
    }

    if (!result.xauUsd || !result.xagUsd) {
      const fallbackRes = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json'
      );
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (!result.xauUsd && data?.usd?.xau) {
          result.xauUsd = 1 / data.usd.xau;
        }
        if (!result.xagUsd && data?.usd?.xag) {
          result.xagUsd = 1 / data.usd.xag;
        }
      }
    }
  } catch (error) {
    console.warn('Error fetching metal rates:', error);
  }

  return result;
};

const getCryptoRatesRaw = async (): Promise<RawCryptoResult> => {
  const tryRates: ExchangeRates = {};
  const tryOpenRates: ExchangeRates = {};
  const usdRates: ExchangeRates = {};
  const usdOpenRates: ExchangeRates = {};

  // 1. Primary (Mobile Only - skip on Web to avoid browser CORS error): BtcTurk Public Ticker API
  if (Platform.OS !== 'web') {
    try {
      const response = await fetch('https://api.btcturk.com/api/v2/ticker');
      if (response.ok) {
        const json = await response.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        for (const ticker of list) {
          const pair = ticker.pairNormalized || ticker.pair;
          const lastPrice = Number(ticker.last);
          const openPrice = Number(ticker.open);
          if ((pair === 'BTC_TRY' || pair === 'BTCTRY') && lastPrice > 0) {
            tryRates.BTC = lastPrice;
            if (openPrice > 0) tryOpenRates.BTC = openPrice;
          } else if ((pair === 'ETH_TRY' || pair === 'ETHTRY') && lastPrice > 0) {
            tryRates.ETH = lastPrice;
            if (openPrice > 0) tryOpenRates.ETH = openPrice;
          } else if ((pair === 'XRP_TRY' || pair === 'XRPTRY') && lastPrice > 0) {
            tryRates.XRP = lastPrice;
            if (openPrice > 0) tryOpenRates.XRP = openPrice;
          }
        }
        if (tryRates.BTC && tryRates.ETH && tryRates.XRP) {
          return { tryRates, tryOpenRates, usdRates, usdOpenRates };
        }
      }
    } catch {
      // Silent fallback to CoinGecko if BtcTurk is unreachable
    }
  }

  // 2. Primary Web / Secondary Mobile: Binance Public 24h Ticker (CORS-friendly, high rate limits)
  try {
    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22XRPUSDT%22%5D'
    );
    if (response.ok) {
      const list = await response.json();
      if (Array.isArray(list)) {
        for (const item of list) {
          const last = parseFloat(item?.lastPrice);
          const open = parseFloat(item?.openPrice);
          if (item?.symbol === 'BTCUSDT' && last > 0) {
            usdRates.BTC = last;
            if (open > 0) usdOpenRates.BTC = open;
          } else if (item?.symbol === 'ETHUSDT' && last > 0) {
            usdRates.ETH = last;
            if (open > 0) usdOpenRates.ETH = open;
          } else if (item?.symbol === 'XRPUSDT' && last > 0) {
            usdRates.XRP = last;
            if (open > 0) usdOpenRates.XRP = open;
          }
        }
        if (usdRates.BTC && usdRates.ETH && usdRates.XRP) {
          return { tryRates, tryOpenRates, usdRates, usdOpenRates };
        }
      }
    }
  } catch {
    // Fallback to CryptoCompare / CoinGecko
  }

  // 3. Fallback: CryptoCompare Multi-Full (CORS-friendly, returns TRY + OPEN24HOUR directly)
  try {
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH,XRP&tsyms=TRY'
    );
    if (response.ok) {
      const json = await response.json();
      const raw = json?.RAW;
      if (raw) {
        for (const sym of ['BTC', 'ETH', 'XRP'] as const) {
          const entry = raw[sym]?.TRY;
          if (typeof entry?.PRICE === 'number' && entry.PRICE > 0) {
            tryRates[sym] = entry.PRICE;
            if (typeof entry?.OPEN24HOUR === 'number' && entry.OPEN24HOUR > 0) {
              tryOpenRates[sym] = entry.OPEN24HOUR;
            }
          }
        }
        if (Object.keys(tryRates).length > 0) {
          return { tryRates, tryOpenRates, usdRates, usdOpenRates };
        }
      }
    }
  } catch {
    // Fallback to CoinGecko
  }

  // 4. Tertiary Fallback: CoinGecko with 5-minute cooldown if rate-limited (HTTP 429)
  if (Date.now() >= coinGeckoCooldownUntil) {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=try&include_24hr_change=true'
      );
      if (response.status === 429) {
        coinGeckoCooldownUntil = Date.now() + 5 * 60 * 1000;
      } else if (response.ok) {
        const data = await response.json();
        if (data.bitcoin?.try) {
          tryRates.BTC = data.bitcoin.try;
          if (typeof data.bitcoin.try_24h_change === 'number') {
            tryOpenRates.BTC = data.bitcoin.try / (1 + data.bitcoin.try_24h_change / 100);
          }
        }
        if (data.ethereum?.try) {
          tryRates.ETH = data.ethereum.try;
          if (typeof data.ethereum.try_24h_change === 'number') {
            tryOpenRates.ETH = data.ethereum.try / (1 + data.ethereum.try_24h_change / 100);
          }
        }
        if (data.ripple?.try) {
          tryRates.XRP = data.ripple.try;
          if (typeof data.ripple.try_24h_change === 'number') {
            tryOpenRates.XRP = data.ripple.try / (1 + data.ripple.try_24h_change / 100);
          }
        }
        if (Object.keys(tryRates).length > 0) {
          return { tryRates, tryOpenRates, usdRates, usdOpenRates };
        }
      }
    } catch {
      // Silent fallback; cached rates will be preserved if available
    }
  }

  return { tryRates, tryOpenRates, usdRates, usdOpenRates };
};

export const getDailyOpenRatesSnapshot = (): ExchangeRates | null => {
  return cachedOpenRates;
};

export const getExchangeRates = async (forceRefresh = false): Promise<ExchangeRates | null> => {
  const now = Date.now();

  if (!forceRefresh && cachedRates && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedRates;
  }

  if (inFlightRatesPromise) {
    return inFlightRatesPromise;
  }

  inFlightRatesPromise = (async () => {
    try {
      // Load closing rates from storage if memory cache is empty (e.g. app restart while markets closed)
      if (!cachedRates) {
        const stored = await loadClosingRatesFromStorage();
        if (stored && Object.keys(stored.rates).length > 0) {
          cachedRates = { ...stored.rates };
          cachedOpenRates = { ...stored.openRates };
        }
      }

      const combinedRates: ExchangeRates = { TRY: 1, ...(cachedRates || {}) };
      const combinedOpenRates: ExchangeRates = { TRY: 1, ...(cachedOpenRates || {}) };

      const forexMetalOpen = isForexMetalMarketOpen();

      // If Forex & Metals markets are OPEN, fetch live; if CLOSED (weekend), preserve closing rates
      const [fiatSettled, metalSettled, cryptoSettled] = await Promise.allSettled([
        forexMetalOpen || !combinedRates.USD ? getFiatRatesRaw() : Promise.resolve<RawFiatResult | null>(null),
        forexMetalOpen || !combinedRates.XAU_GRAM ? getMetalRatesRaw() : Promise.resolve<RawMetalResult | null>(null),
        getCryptoRatesRaw(), // Crypto is always 24/7
      ]);

      if (fiatSettled.status === 'fulfilled' && fiatSettled.value) {
        Object.assign(combinedRates, fiatSettled.value.rates);
        Object.assign(combinedOpenRates, fiatSettled.value.openRates);
      }

      const usdToTry = combinedRates.USD;
      const openUsdToTry = combinedOpenRates.USD || usdToTry;

      if (metalSettled.status === 'fulfilled' && metalSettled.value && usdToTry) {
        const { xauUsd, xagUsd, xauOpenUsd, xagOpenUsd } = metalSettled.value;
        if (xauUsd) {
          combinedRates.XAU_GRAM = Number(((xauUsd / OUNCE_TO_GRAM) * usdToTry).toFixed(2));
        }
        if (xagUsd) {
          combinedRates.XAG_GRAM = Number(((xagUsd / OUNCE_TO_GRAM) * usdToTry).toFixed(2));
        }
        if (xauOpenUsd && openUsdToTry) {
          combinedOpenRates.XAU_GRAM = Number(((xauOpenUsd / OUNCE_TO_GRAM) * openUsdToTry).toFixed(2));
        }
        if (xagOpenUsd && openUsdToTry) {
          combinedOpenRates.XAG_GRAM = Number(((xagOpenUsd / OUNCE_TO_GRAM) * openUsdToTry).toFixed(2));
        }
      }

      if (cryptoSettled.status === 'fulfilled') {
        const { tryRates, tryOpenRates, usdRates, usdOpenRates } = cryptoSettled.value;
        if (Object.keys(tryRates).length > 0) {
          Object.assign(combinedRates, tryRates);
          Object.assign(combinedOpenRates, tryOpenRates);
        } else if (usdToTry && Object.keys(usdRates).length > 0) {
          for (const [k, v] of Object.entries(usdRates)) {
            combinedRates[k] = v * usdToTry;
          }
          for (const [k, v] of Object.entries(usdOpenRates)) {
            combinedOpenRates[k] = v * (openUsdToTry || usdToTry);
          }
        }
      }

      const isOnline = Object.keys(combinedRates).length > 1;

      // Fetch Stock & TEFAS Fund rates using the resolved USD/TRY rate
      try {
        const stockFund = await getStockAndFundRates(usdToTry || 34.5, isOnline);
        Object.assign(combinedRates, stockFund.rates);
        Object.assign(combinedOpenRates, stockFund.openRates);
      } catch (err) {
        console.warn('Error fetching stock/fund rates:', err);
      }

      if (Object.keys(combinedRates).length <= 1) {
        cachedRates = null;
        cachedOpenRates = null;
        return null;
      }

      cachedRates = combinedRates;
      cachedOpenRates = combinedOpenRates;
      lastCacheTime = Date.now();

      // Save current rates so on next app open / market closure we have exact closing prices
      saveClosingRatesToStorage(combinedRates, combinedOpenRates).catch(() => {});

      return combinedRates;
    } finally {
      inFlightRatesPromise = null;
    }
  })();

  return inFlightRatesPromise;
};
