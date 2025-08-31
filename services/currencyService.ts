// Bu dosya, farklı API'lerden döviz, metal ve kripto para kurlarını çekmeyi yönetir.

export interface ExchangeRates {
  [key: string]: number;
}

// 1. Döviz ve Metal Kurlarını Çeken Fonksiyon
const getFiatAndMetalRates = async (): Promise<ExchangeRates> => {
  try {
    // Exchangerate.host API'si ücretsizdir ve anahtar gerektirmez.
    // TRY bazında istediğimiz sembollerin değerini alıyoruz.
    const response = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,RUB,XAU,XAG');
    const data = await response.json();

    // API, 1 TRY'nin kaç USD/XAU olduğunu verir. Biz 1 USD/XAU'nun kaç TRY olduğunu istediğimiz için 1'i sonuca bölüyoruz.
    const invertedRates: ExchangeRates = {};
    for (const key in data.rates) {
      invertedRates[key] = 1 / data.rates[key];
    }
    return invertedRates;
  } catch (error) {
    console.error('Error fetching fiat/metal rates:', error);
    return {}; // Hata durumunda boş obje döndür.
  }
};

// 2. Kripto Para Kurlarını Çeken Fonksiyon
const getCryptoRates = async (): Promise<ExchangeRates> => {
  try {
    // CoinGecko API'si en popüler ve ücretsiz kripto API'lerinden biridir.
    // İstediğimiz kriptoların TRY cinsinden değerini alıyoruz.
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=try');
    const data = await response.json();

    // Gelen veriyi standart formatımıza çeviriyoruz (örn: "bitcoin" -> "BTC").
    return {
      BTC: data.bitcoin?.try || 0,
      ETH: data.ethereum?.try || 0,
      XRP: data.ripple?.try || 0,
    };
  } catch (error) {
    console.error('Error fetching crypto rates:', error);
    return {}; // Hata durumunda boş obje döndür.
  }
};

// 3. Tüm Kurları Birleştiren Ana Fonksiyon
// Uygulamanın diğer kısımları bu fonksiyonu çağıracak.
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
  try {
    // İki API çağrısını aynı anda (paralel) yaparak zaman kazanıyoruz.
    const [fiatAndMetalRates, cryptoRates] = await Promise.all([
      getFiatAndMetalRates(),
      getCryptoRates(),
    ]);

    // İki sonuç objesini birleştirip, TRY'yi de ekleyerek nihai kur listesini oluşturuyoruz.
    return { ...fiatAndMetalRates, ...cryptoRates, TRY: 1 };
  } catch (error) {
    console.error('Error fetching combined exchange rates:', error);
    return null;
  }
};