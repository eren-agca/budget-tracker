export interface Currency {
  code: 'TRY' | 'USD' | 'EUR' | 'GBP';
  symbol: '₺' | '$' | '€' | '£';
  label: string;
}

export const currencies: Currency[] = [
  { code: 'TRY', symbol: '₺', label: 'TRY' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'POUND' },
];

export const defaultCurrency: Currency = currencies[0];

export const getCurrencySymbol = (code?: string): string => {
  if (!code) return '₺';
  const found = currencies.find((c) => c.code === code);
  return found ? found.symbol : code;
};

export const getCurrencyLabel = (code?: string): string => {
  if (!code) return 'TRY';
  if (code === 'GBP') return 'POUND';
  const found = currencies.find((c) => c.code === code);
  return found ? (found.label || found.code) : code;
};