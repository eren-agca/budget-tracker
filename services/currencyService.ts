// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/services/currencyService.ts

// Bu dosya, farklı API'lerden döviz, metal ve kripto para kurlarını çekmeyi yönetir.

export interface ExchangeRates {
  [key: string]: number;
}

// 1. Döviz Kurlarını Çeken Fonksiyon (USD, EUR, RUB)
const getFiatRates = async (): Promise<ExchangeRates> => {
  // Birincil API: frankfurter.app (Hızlı ve güvenilir)
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,RUB');
    if (!response.ok) throw new Error('Frankfurter API request failed');
    const data = await response.json();
    if (!data.rates) throw new Error('Invalid data from Frankfurter API');

    // API, 1 TRY'nin diğer para birimlerindeki değerini verir. Biz tersini alıyoruz.
    const invertedRates: ExchangeRates = {};
    for (const key in data.rates) {
      invertedRates[key] = 1 / data.rates[key];
    }
    return invertedRates;
  } catch (error) {
    console.warn('Primary Fiat API (Frankfurter) failed:', error, 'Trying fallback...');
    // Yedek API: open.er-api.com (Eğer birincil API çalışmazsa devreye girer)
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/TRY');
      if (!response.ok) throw new Error('Fallback Fiat API request failed');
      const data = await response.json();
      if (!data.rates) throw new Error('Invalid data from Fallback Fiat API');

      const rates: ExchangeRates = {};
      if (data.rates.USD) rates['USD'] = 1 / data.rates.USD;
      if (data.rates.EUR) rates['EUR'] = 1 / data.rates.EUR;
      if (data.rates.RUB) rates['RUB'] = 1 / data.rates.RUB;
      return rates;
    } catch (fallbackError) {
      console.error('Could not fetch fiat rates from any source:', fallbackError);
      return {};
    }
  }
};

// 2. Değerli Metal Kurlarını Çeken Fonksiyon (Altın, Gümüş)
const getMetalRates = async (): Promise<ExchangeRates> => {
  try {
    // Adım 1: Güvenilir bir kaynaktan USD/TRY kurunu al.
    let usdToTryRate: number | null = null;
    try {
      const primaryResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY');
      if (!primaryResponse.ok) throw new Error('Primary USD/TRY fetch failed');
      const primaryData = await primaryResponse.json();
      usdToTryRate = primaryData.rates?.TRY;
    } catch (error) {
      console.warn('Primary USD/TRY fetch failed, trying fallback...');
      const fallbackResponse = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!fallbackResponse.ok) throw new Error('Fallback USD/TRY fetch failed');
      const fallbackData = await fallbackResponse.json();
      usdToTryRate = fallbackData.rates?.TRY;
    }

    if (!usdToTryRate) {
      throw new Error('Could not fetch USD/TRY rate from any source.');
    }

    // Adım 2: Metallerin USD cinsinden fiyatını al.
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    const metalData = await metalResponse.json();

    if (!metalData.items || !metalData.items[0] || !metalData.items[0].xauPrice || !metalData.items[0].xagPrice) {
      console.warn('Metal API response format has changed or is invalid.');
      return {};
    }

    const xauPricePerOunceInUsd = metalData.items[0].xauPrice;
    const xagPricePerOunceInUsd = metalData.items[0].xagPrice;

    // Adım 3: Ons fiyatını gram fiyatına çevir ve TRY karşılığını hesapla.
    const OUNCE_TO_GRAM = 31.1035;

    return {
      XAU_GRAM: (xauPricePerOunceInUsd / OUNCE_TO_GRAM) * usdToTryRate,
      XAG_GRAM: (xagPricePerOunceInUsd / OUNCE_TO_GRAM) * usdToTryRate,
    };
  } catch (error) {
    console.warn('Could not fetch metal rates:', error);
    return {};
  }
};

// 3. Kripto Para Kurlarını Çeken Fonksiyon (BTC, ETH, XRP)
const getCryptoRates = async (): Promise<ExchangeRates> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=try');
    const data = await response.json();

    const rates: ExchangeRates = {};
    if (data.bitcoin?.try) rates['BTC'] = data.bitcoin.try;
    if (data.ethereum?.try) rates['ETH'] = data.ethereum.try;
    if (data.ripple?.try) rates['XRP'] = data.ripple.try;

    return rates;
  } catch (error) {
    console.warn('Could not fetch crypto rates:', error);
    return {};
  }
};

// Ana fonksiyon: Tüm kur verilerini birleştirir.
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
  const results = await Promise.allSettled([getFiatRates(), getMetalRates(), getCryptoRates()]);

  const combinedRates: ExchangeRates = { TRY: 1 };

  results.forEach((result) => {
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