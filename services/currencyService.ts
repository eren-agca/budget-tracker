export interface ExchangeRates {
  [key: string]: number;
}

const getFiatRates = async (): Promise<ExchangeRates> => {
  let rates: ExchangeRates = {};
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,RUB');
    if (!response.ok) throw new Error('Frankfurter API request failed');
    const data = await response.json();
    if (!data.rates || !data.rates.TRY) throw new Error('Invalid data from Frankfurter API');

    const usdToTry = data.rates.TRY;
    const usdToEur = data.rates.EUR;
    const usdToRub = data.rates.RUB;

    rates.USD = usdToTry;
    if (usdToEur) {
        rates['EUR'] = usdToTry / usdToEur;
    }
    if (usdToRub) {
        rates['RUB'] = usdToTry / usdToRub;
    }
  } catch (error) {
    console.warn('Primary Fiat API (Frankfurter) failed:', error, 'Trying fallback...');
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('Fallback Fiat API request failed');
      const data = await response.json();
      if (!data.rates || !data.rates.TRY) throw new Error('Invalid data from Fallback Fiat API');

      const usdToTry = data.rates.TRY;
      const usdToEur = data.rates.EUR;
      const usdToRub = data.rates.RUB;

      if (!rates.USD) rates.USD = usdToTry;
      if (usdToEur) { rates['EUR'] = usdToTry / usdToEur; }
      if (usdToRub) { rates['RUB'] = usdToTry / usdToRub; }
    } catch (fallbackError) {
      console.error('Could not fetch main fiat rates from primary/secondary source:', fallbackError);
    }
  }

  if (!rates.RUB) {
    try {
      console.log('Fetching RUB from a dedicated fallback API...');
      const rubResponse = await fetch('https://open.er-api.com/v6/latest/RUB');
      if (!rubResponse.ok) throw new Error('RUB Fallback API request failed');
      const rubData = await rubResponse.json();
      if (rubData.rates && rubData.rates.TRY) {
        rates['RUB'] = rubData.rates.TRY;
      }
    } catch (rubError) {
      console.warn('Dedicated RUB fallback API failed:', rubError);
    }
  }

  return rates;
};

// In-memory cache with 5-minute TTL to prevent rate limits and redundant network calls
let cachedRates: ExchangeRates | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getMetalRates = async (usdToTryRate: number): Promise<ExchangeRates> => {
  if (!usdToTryRate) {
    return {};
  }

  const rates: ExchangeRates = {};
  const OUNCE_TO_GRAM = 31.1035;

  // 1. Primary: api.gold-api.com (Dedicated free real-time spot metal API)
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU'),
      fetch('https://api.gold-api.com/price/XAG'),
    ]);

    if (goldRes.ok && silverRes.ok) {
      const goldData = await goldRes.json();
      const silverData = await silverRes.json();

      if (goldData && typeof goldData.price === 'number') {
        rates['XAU_GRAM'] = Number(((goldData.price / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }
      if (silverData && typeof silverData.price === 'number') {
        rates['XAG_GRAM'] = Number(((silverData.price / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }

      if (rates['XAU_GRAM'] && rates['XAG_GRAM']) {
        return rates;
      }
    }
  } catch (error) {
    console.warn('Primary Gold API (gold-api.com) failed, trying fallback...', error);
  }

  // 2. Secondary fallback: jsdelivr currency-api
  try {
    const fallbackRes = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json');
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      if (data?.usd?.xau) {
        const ounceGoldInUsd = 1 / data.usd.xau;
        rates['XAU_GRAM'] = Number(((ounceGoldInUsd / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }
      if (data?.usd?.xag) {
        const ounceSilverInUsd = 1 / data.usd.xag;
        rates['XAG_GRAM'] = Number(((ounceSilverInUsd / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }

      if (rates['XAU_GRAM']) {
        return rates;
      }
    }
  } catch (fallbackError) {
    console.warn('Secondary metal fallback (currency-api) failed:', fallbackError);
  }

  // 3. Tertiary fallback: goldprice.org
  try {
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    if (metalResponse.ok) {
      const metalData = await metalResponse.json();
      const item = metalData.items?.[0];
      if (item?.xauPrice) {
        rates['XAU_GRAM'] = Number(((item.xauPrice / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }
      if (item?.xagPrice) {
        rates['XAG_GRAM'] = Number(((item.xagPrice / OUNCE_TO_GRAM) * usdToTryRate).toFixed(2));
      }
    }
  } catch (tertiaryError) {
    console.warn('Tertiary metal API (goldprice.org) failed:', tertiaryError);
  }

  return rates;
};

const getCryptoRates = async (usdToTryRate?: number): Promise<ExchangeRates> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=try');
    if (!response.ok) throw new Error(`CoinGecko API request failed with status ${response.status}`);
    const data = await response.json();

    const rates: ExchangeRates = {};
    if (data.bitcoin?.try) rates['BTC'] = data.bitcoin.try;
    if (data.ethereum?.try) rates['ETH'] = data.ethereum.try;
    if (data.ripple?.try) rates['XRP'] = data.ripple.try;

    if (Object.keys(rates).length > 0) {
      return rates;
    }
    throw new Error('Invalid data format from CoinGecko: bitcoin.try missing');
  } catch (error) {
    console.warn(`Primary Crypto API (CoinGecko) failed: ${error}. Trying fallback...`);

    if (!usdToTryRate) {
      console.error('Cannot use Crypto fallback API without USD/TRY rate.');
      return {};
    }

    try {
      const response = await fetch('https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,ripple');
      if (!response.ok) throw new Error(`CoinCap API request failed with status ${response.status}`);
      const data = await response.json();

      const rates: ExchangeRates = {};
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((asset: any) => {
          if (asset.id === 'bitcoin' && asset.priceUsd) {
            rates['BTC'] = parseFloat(asset.priceUsd) * usdToTryRate;
          }
          if (asset.id === 'ethereum' && asset.priceUsd) {
            rates['ETH'] = parseFloat(asset.priceUsd) * usdToTryRate;
          }
          if (asset.id === 'ripple' && asset.priceUsd) {
            rates['XRP'] = parseFloat(asset.priceUsd) * usdToTryRate;
          }
        });
      }

      if (Object.keys(rates).length > 0) {
        return rates;
      }
      
      throw new Error('Invalid data format from CoinCap or bitcoin asset not found');
    } catch (fallbackError) {
      console.error(`Crypto fallback API (CoinCap) also failed: ${fallbackError}`);
      return {};
    }
  }
};

export const getExchangeRates = async (forceRefresh = false): Promise<ExchangeRates | null> => {
  const now = Date.now();

  // Return cached rates if fresh within TTL to avoid hitting API rate limits
  if (!forceRefresh && cachedRates && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedRates;
  }

  const combinedRates: ExchangeRates = { TRY: 1 };

  const fiatRates = await getFiatRates();
  if (fiatRates && Object.keys(fiatRates).length > 0) {
    Object.assign(combinedRates, fiatRates);
  } else {
    console.error("Warning: Could not fetch base fiat rates. Metal and Crypto fallback rates will be skipped.");
  }

  const usdToTryRate = combinedRates['USD'];
  const promisesToSettle = [];

  promisesToSettle.push(getCryptoRates(usdToTryRate));
  
  if (usdToTryRate) {
    promisesToSettle.push(getMetalRates(usdToTryRate));
  }

  const otherResults = await Promise.allSettled(promisesToSettle);

  otherResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      Object.assign(combinedRates, result.value);
    }
  });

  if (Object.keys(combinedRates).length <= 1) {
    console.error('Error fetching exchange rates: All API calls failed.');
    // If we have a stale cache, fall back to it gracefully rather than returning null
    return cachedRates;
  }

  // Update in-memory cache
  cachedRates = combinedRates;
  lastCacheTime = now;

  return combinedRates;
};