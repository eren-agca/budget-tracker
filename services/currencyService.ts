// Bu dosya, farklı API'lerden döviz, metal ve kripto para kurlarını çekmeyi yönetir.

export interface ExchangeRates {
  [key: string]: number;
}

// 1. Döviz Kurlarını Çeken Fonksiyon (USD, EUR, RUB)
const getFiatRates = async (): Promise<ExchangeRates> => {
  try {
    // frankfurter.app, Avrupa Merkez Bankası verilerini kullanan, hızlı ve güvenilir bir servistir.
    const response = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,RUB');
    const data = await response.json();
    if (!data.rates) return {};

    // API, 1 TRY'nin diğer para birimlerindeki değerini verir. Biz tersini alıyoruz.
    const invertedRates: ExchangeRates = {};
    for (const key in data.rates) {
      invertedRates[key] = 1 / data.rates[key];
    }
    return invertedRates;
  } catch (error) {
    console.warn('Could not fetch fiat rates:', error);
    return {}; // Hata durumunda boş obje döndürerek diğer API'lerin çalışmasını engelleme.
  }
};

// 2. Değerli Metal Kurlarını Çeken Fonksiyon (Altın, Gümüş)
const getMetalRates = async (): Promise<ExchangeRates> => {
  try {
    // Bu daha güvenilir bir yöntemdir. Önce USD/TRY kurunu, sonra metallerin USD karşılığını alırız.
    // Adım 1: Güvenilir bir kaynaktan USD/TRY kurunu al.
    const fiatResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY');
    const fiatData = await fiatResponse.json();
    const usdToTryRate = fiatData.rates?.TRY;
    if (!usdToTryRate) return {};

    // Adım 2: Metallerin USD cinsinden fiyatını al. Bu API, 1 USD'nin kaç ons metal ettiğini verir.
    // DÜZELTME: Daha güvenilir bir API'ye geçiyoruz. Bu API, 1 Ons Altın/Gümüş'ün kaç USD ettiğini doğrudan verir.
    const metalResponse = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
    const metalData = await metalResponse.json();

    // API'den gelen verinin yapısını kontrol et.
    if (!metalData.items || !metalData.items[0] || !metalData.items[0].xauPrice || !metalData.items[0].xagPrice) {
      console.warn('Metal API response format has changed or is invalid.');
      return {};
    }

    const xauPricePerOunceInUsd = metalData.items[0].xauPrice;
    const xagPricePerOunceInUsd = metalData.items[0].xagPrice;

    // Adım 3: Ons fiyatını gram fiyatına çevir ve TRY karşılığını hesapla.
    const OUNCE_TO_GRAM = 31.1035;

    return {
      // 1 Gram Altın/Gümüş'ün TRY karşılığını hesapla.
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
    // CoinGecko, kripto paralar için endüstri standardı, güvenilir bir API'dir.
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
  // Promise.allSettled kullanarak, bir API başarısız olsa bile diğerlerinin sonuçlarını alabiliyoruz.
  // Bu, sistemi çok daha dayanıklı hale getirir.
  const results = await Promise.allSettled([getFiatRates(), getMetalRates(), getCryptoRates()]);

  const combinedRates: ExchangeRates = { TRY: 1 };

  results.forEach((result) => {
    // Sadece başarılı olan isteklerin sonuçlarını birleştiriyoruz.
    if (result.status === 'fulfilled' && result.value) {
      Object.assign(combinedRates, result.value);
    }
  });

  // Eğer hiçbir API'den veri alınamadıysa (örn: internet yok), null döndür.
  if (Object.keys(combinedRates).length <= 1) {
    console.error('Error fetching exchange rates: All API calls failed.');
    return null;
  }

  return combinedRates;
};