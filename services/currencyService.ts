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

// In-memory cache with 25-second TTL for fast 30s polling without hitting rate limits
let cachedRates: ExchangeRates | null = null;
let cachedOpenRates: ExchangeRates | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25 * 1000; // 25 seconds

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
    const [latestRes, prevRes] = await Promise.allSettled([
      fetch('https://open.er-api.com/v6/latest/USD'),
      fetch(`https://api.frankfurter.app/${prevDateStr}?from=USD&to=TRY,EUR,GBP`),
    ]);

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
      const frankfurterLatest = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP');
      if (frankfurterLatest.ok) {
        const data = await frankfurterLatest.json();
        if (data?.rates?.TRY) {
          const usdToTry = data.rates.TRY;
          const usdToEur = data.rates.EUR;
          const usdToGbp = data.rates.GBP;
          rates.USD = usdToTry;
          if (usdToEur) rates.EUR = usdToTry / usdToEur;
          if (usdToGbp) rates.GBP = usdToTry / usdToGbp;
        }
      }
    }

    if (prevRes.status === 'fulfilled' && prevRes.value.ok) {
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
    // Fetch real-time spot prices and daily open/close metadata in parallel
    const [goldRes, silverRes, gpRes] = await Promise.allSettled([
      fetch('https://api.gold-api.com/price/XAU'),
      fetch('https://api.gold-api.com/price/XAG'),
      fetch('https://data-asg.goldprice.org/dbXRates/USD'),
    ]);

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

    if (gpRes.status === 'fulfilled' && gpRes.value.ok) {
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

  // 1. Primary: Binance 24hr Ticker API (Ultra-fast ~60ms, high rate limit, direct TRY & openPrice)
  try {
    const binanceUrl =
      'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCTRY%22,%22ETHTRY%22,%22XRPTRY%22%5D';
    const response = await fetch(binanceUrl);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const ticker of data) {
          const lastPrice = parseFloat(ticker.lastPrice);
          const openPrice = parseFloat(ticker.openPrice);
          if (ticker.symbol === 'BTCTRY' && lastPrice > 0) {
            tryRates.BTC = lastPrice;
            if (openPrice > 0) tryOpenRates.BTC = openPrice;
          } else if (ticker.symbol === 'ETHTRY' && lastPrice > 0) {
            tryRates.ETH = lastPrice;
            if (openPrice > 0) tryOpenRates.ETH = openPrice;
          } else if (ticker.symbol === 'XRPTRY' && lastPrice > 0) {
            tryRates.XRP = lastPrice;
            if (openPrice > 0) tryOpenRates.XRP = openPrice;
          }
        }
      }
      if (tryRates.BTC && tryRates.ETH && tryRates.XRP) {
        return { tryRates, tryOpenRates, usdRates, usdOpenRates };
      }
    }
  } catch (error) {
    console.warn('Primary Crypto API (Binance) failed, trying CoinGecko fallback:', error);
  }

  // 2. Secondary: CoinGecko with 24hr change
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=try&include_24hr_change=true'
    );
    if (response.ok) {
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
  } catch (error) {
    console.warn('Secondary Crypto API (CoinGecko) failed, trying CoinCap fallback:', error);
  }

  // 3. Tertiary: CoinCap USD
  try {
    const response = await fetch('https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,ripple');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.data)) {
        for (const asset of data.data) {
          const priceUsd = parseFloat(asset.priceUsd);
          const changePct = parseFloat(asset.changePercent24Hr || '0');
          const openUsd = priceUsd / (1 + changePct / 100);
          if (asset.id === 'bitcoin' && priceUsd > 0) {
            usdRates.BTC = priceUsd;
            usdOpenRates.BTC = openUsd;
          } else if (asset.id === 'ethereum' && priceUsd > 0) {
            usdRates.ETH = priceUsd;
            usdOpenRates.ETH = openUsd;
          } else if (asset.id === 'ripple' && priceUsd > 0) {
            usdRates.XRP = priceUsd;
            usdOpenRates.XRP = openUsd;
          }
        }
      }
    }
  } catch (fallbackError) {
    console.error('All Crypto APIs failed:', fallbackError);
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

  const combinedRates: ExchangeRates = { TRY: 1 };
  const combinedOpenRates: ExchangeRates = { TRY: 1 };

  // Fetch Fiat, Metal, and Crypto 100% in parallel to minimize latency
  const [fiatSettled, metalSettled, cryptoSettled] = await Promise.allSettled([
    getFiatRatesRaw(),
    getMetalRatesRaw(),
    getCryptoRatesRaw(),
  ]);

  if (fiatSettled.status === 'fulfilled') {
    Object.assign(combinedRates, fiatSettled.value.rates);
    Object.assign(combinedOpenRates, fiatSettled.value.openRates);
  }

  const usdToTry = combinedRates.USD;
  const openUsdToTry = combinedOpenRates.USD || usdToTry;

  if (metalSettled.status === 'fulfilled' && usdToTry) {
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

  if (Object.keys(combinedRates).length <= 1) {
    console.error('Error fetching exchange rates: All API calls failed.');
    return cachedRates;
  }

  cachedRates = combinedRates;
  cachedOpenRates = combinedOpenRates;
  lastCacheTime = now;

  return combinedRates;
};
