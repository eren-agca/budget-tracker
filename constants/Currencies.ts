// Bu dosya, uygulamada kullanılacak para birimlerini tanımlar.

export interface Currency {
  code: 'TRY' | 'USD' | 'EUR' | 'RUB';
  symbol: '₺' | '$' | '€' | '₽';
}

export const currencies: Currency[] = [
  { code: 'TRY', symbol: '₺' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'RUB', symbol: '₽' },
];

export const defaultCurrency: Currency = currencies[0]; // Varsayılan para birimi: TRY