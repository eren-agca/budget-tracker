// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/services/currencyService.ts

// Bu dosya, farklı API'lerden döviz, metal ve kripto para kurlarını çekmeyi yönetir.

export interface ExchangeRates {
  [key: string]: number;
}

// 1. Döviz Kurlarını Çeken Fonksiyon (USD, EUR, RUB)
const getFiatRates = async (): Promise<ExchangeRates> => {
  let rates: ExchangeRates = {};
  try {
    // Daha sağlam bir yaklaşım: USD'yi temel alıp çapraz kur hesapla.
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,RUB');
    if (!response.ok) throw new Error('Frankfurter API request failed');
    const data = await response.json();
    if (!data.rates || !data.rates.TRY) throw new Error('Invalid data from Frankfurter API');

    const usdToTry = data.rates.TRY;
    const usdToEur = data.rates.EUR;
    const usdToRub = data.rates.RUB;

    rates.USD = usdToTry;
    if (usdToEur) {
        // EUR/TRY = (USD/TRY) / (USD/EUR)
        rates['EUR'] = usdToTry / usdToEur;
    }
    if (usdToRub) {
        // RUB/TRY = (USD/TRY) / (USD/RUB)
        rates['RUB'] = usdToTry / usdToRub;
    }
  } catch (error) {
    console.warn('Primary Fiat API (Frankfurter) failed:', error, 'Trying fallback...');
    // Yedek API: open.er-api.com
    try {
      // Bu API zaten USD tabanlıdır.
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('Fallback Fiat API request failed');
      const data = await response.json();
      if (!data.rates || !data.rates.TRY) throw new Error('Invalid data from Fallback Fiat API');

      const usdToTry = data.rates.TRY;
      const usdToEur = data.rates.EUR;
      const usdToRub = data.rates.RUB;

      // Sadece henüz alınmamış verileri ekle
      if (!rates.USD) rates.USD = usdToTry;
      if (usdToEur) { rates['EUR'] = usdToTry / usdToEur; }
      if (usdToRub) { rates['RUB'] = usdToTry / usdToRub; }
    } catch (fallbackError) {
      console.error('Could not fetch main fiat rates from primary/secondary source:', fallbackError);
    }
  }

  // RUBLE İÇİN ÖZEL YEDEK API
  // Eğer önceki API'lerden Ruble kuru alınamadıysa, üçüncü bir API'yi dene.
  if (!rates.RUB) {
    try {
      console.log('Fetching RUB from a dedicated fallback API...');
      // Bu API, 1 RUB'nin diğer para birimlerindeki karşılığını verir.
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

// 2. Değerli Metal Kurlarını Çeken Fonksiyon (Altın, Gümüş)
// DEĞİŞİKLİK: Bu fonksiyon artık gereksiz API çağrılarını önlemek için USD/TRY kurunu parametre olarak alıyor.
const getMetalRates = async (usdToTryRate: number): Promise<ExchangeRates> => {
  try {
    // Adım 1: USD/TRY kurunun sağlandığından emin ol.
    if (!usdToTryRate) {
      throw new Error('USD/TRY rate was not provided to getMetalRates.');
    }

    // Adım 2: Metallerin USD cinsinden fiyatını al.
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    if (!metalResponse.ok) throw new Error('Metal API request failed');
    const metalData = await metalResponse.json();

    if (!metalData.items || !metalData.items[0]) {
      console.warn('Metal API response format has changed or is invalid (no items).');
      return {};
    }

    // Adım 3: Ons fiyatını gram fiyatına çevir ve TRY karşılığını hesapla.
    const item = metalData.items[0];
    const rates: ExchangeRates = {};
    const OUNCE_TO_GRAM = 31.1035;

    // Sadece Altın fiyatını alıyoruz.
    if (item.xauPrice) {
      rates['XAU_GRAM'] = (item.xauPrice / OUNCE_TO_GRAM) * usdToTryRate;
    }

    return rates;
  } catch (error) {
    console.warn('Could not fetch metal rates:', error);
    return {};
  }
};

// 3. Kripto Para Kurlarını Çeken Fonksiyon
// DEĞİŞİKLİK: USD/TRY kurunu parametre olarak alarak yedek bir API kullanma yeteneği ekliyoruz.
const getCryptoRates = async (usdToTryRate?: number): Promise<ExchangeRates> => {
  // Birincil API: CoinGecko
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try');
    if (!response.ok) throw new Error(`CoinGecko API request failed with status ${response.status}`);
    const data = await response.json();

    const rates: ExchangeRates = {};
    if (data.bitcoin?.try) rates['BTC'] = data.bitcoin.try;

    if (Object.keys(rates).length > 0) {
      return rates;
    }
    throw new Error('Invalid data format from CoinGecko: bitcoin.try missing');
  } catch (error) {
    console.warn(`Primary Crypto API (CoinGecko) failed: ${error}. Trying fallback...`);

    // Yedek API: CoinCap (USD üzerinden)
    if (!usdToTryRate) {
      console.error('Cannot use Crypto fallback API without USD/TRY rate.');
      return {};
    }

    try {
      const response = await fetch('https://api.coincap.io/v2/assets?ids=bitcoin');
      if (!response.ok) throw new Error(`CoinCap API request failed with status ${response.status}`);
      const data = await response.json();

      const rates: ExchangeRates = {};
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((asset: any) => {
          if (asset.id === 'bitcoin' && asset.priceUsd) {
            rates['BTC'] = parseFloat(asset.priceUsd) * usdToTryRate;
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

// Ana fonksiyon: Tüm kur verilerini birleştirir.
// DEĞİŞİKLİK: Veri çekme mantığı daha verimli ve sağlam hale getirildi.
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
  const combinedRates: ExchangeRates = { TRY: 1 };

  // Adım 1: Önce temel döviz kurlarını al. Bu, metaller ve kripto yedeği için gereklidir.
  const fiatRates = await getFiatRates();
  if (fiatRates && Object.keys(fiatRates).length > 0) {
    Object.assign(combinedRates, fiatRates);
  } else {
    // Döviz kurları alınamazsa bile devam et, belki diğerleri çalışır.
    console.error("Warning: Could not fetch base fiat rates. Metal and Crypto fallback rates will be skipped.");
  }

  // Adım 2: Metal ve kripto kurlarını paralel olarak al.
  const usdToTryRate = combinedRates['USD'];
  const promisesToSettle = [];

  // Kripto kurunu almayı dene. USD kuru varsa yedeği kullanabilir.
  promisesToSettle.push(getCryptoRates(usdToTryRate));
  
  // Sadece USD/TRY kuru varsa metal kurunu almayı dene.
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