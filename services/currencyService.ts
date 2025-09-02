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

const getMetalRates = async (usdToTryRate: number): Promise<ExchangeRates> => {
  try {
    if (!usdToTryRate) {
      throw new Error('USD/TRY rate was not provided to getMetalRates.');
    }

    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    if (!metalResponse.ok) throw new Error('Metal API request failed');
    const metalData = await metalResponse.json();

    if (!metalData.items || !metalData.items[0]) {
      console.warn('Metal API response format has changed or is invalid (no items).');
      return {};
    }

    const item = metalData.items[0];
    const rates: ExchangeRates = {};
    const OUNCE_TO_GRAM = 31.1035;

    if (item.xauPrice) {
      rates['XAU_GRAM'] = (item.xauPrice / OUNCE_TO_GRAM) * usdToTryRate;
    }
    if (item.xagPrice) {
      rates['XAG_GRAM'] = (item.xagPrice / OUNCE_TO_GRAM) * usdToTryRate;
    }

    return rates;
  } catch (error) {
    console.warn('Could not fetch metal rates:', error);
    return {};
  }
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

export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
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

  console.log('Fetched and combined rates:', combinedRates);

  if (Object.keys(combinedRates).length <= 1) {
    console.error('Error fetching exchange rates: All API calls failed.');
    return null;
  }

  return combinedRates;
};