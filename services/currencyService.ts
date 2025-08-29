// Bu dosya, para birimi dönüştürme oranlarını yönetir.
// Şimdilik oranları manuel olarak (hard-coded) giriyoruz.
// İLERİDEKİ ADIM: Bu fonksiyonu, gerçek bir finans API'sine (örn: exchangerate-api.com)
// bağlanacak şekilde güncelleyebiliriz.

export interface ExchangeRates {
  [key: string]: number;
}

// Varsayılan olarak 1 TRY'nin diğer para birimlerindeki karşılığını tutuyoruz.
const rates: ExchangeRates = {
  TRY: 1,
  USD: 0.031, // 1 TRY = 0.031 USD (Örnek kur)
  EUR: 0.028, // 1 TRY = 0.028 EUR (Örnek kur)
  RUB: 2.85,  // 1 TRY = 2.85 RUB (Örnek kur)
};

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  // Şimdilik sadece sabit oranları döndürüyoruz.
  // Gerçek bir API'ye bağlandığında, burada bir ağ isteği (fetch) olacak.
  return Promise.resolve(rates);
};