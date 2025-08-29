// Bu dosya, seçili para birimini tüm uygulamada paylaşmak için bir React Context oluşturur.

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Currency, defaultCurrency } from '@/constants/Currencies';

// Context'in tip tanımı.
interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

// Context'i oluşturuyoruz.
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Uygulamayı sarmalayacak olan Provider bileşeni.
export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
};

// Context'i daha kolay kullanmamızı sağlayan özel bir hook.
export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};