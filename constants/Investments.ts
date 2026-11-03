import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeRates } from '@/services/currencyService';
import { AppLanguage } from '@/context/SettingsContext';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface InvestmentPreset {
  code: string;
  labelTr: string;
  labelEn: string;
  icon: IoniconName;
  isLive: boolean;
}

export const INVESTMENT_PRESETS: InvestmentPreset[] = [
  { code: 'XAU_GRAM', labelTr: 'Gram Altın', labelEn: 'Gold (Gram)', icon: 'diamond-outline', isLive: true },
  { code: 'XAU_QUARTER', labelTr: 'Çeyrek Altın', labelEn: 'Quarter Gold', icon: 'sunny-outline', isLive: true },
  { code: 'XAU_HALF', labelTr: 'Yarım Altın', labelEn: 'Half Gold', icon: 'sunny-outline', isLive: true },
  { code: 'XAU_FULL', labelTr: 'Tam Altın', labelEn: 'Full Gold', icon: 'sunny-outline', isLive: true },
  { code: 'XAG_GRAM', labelTr: 'Gram Gümüş', labelEn: 'Silver (Gram)', icon: 'sparkles-outline', isLive: true },
  { code: 'USD', labelTr: 'Dolar (USD)', labelEn: 'US Dollar (USD)', icon: 'cash-outline', isLive: true },
  { code: 'EUR', labelTr: 'Euro (EUR)', labelEn: 'Euro (EUR)', icon: 'cash-outline', isLive: true },
  { code: 'GBP', labelTr: 'Sterlin (GBP)', labelEn: 'Pound (GBP)', icon: 'cash-outline', isLive: true },
  { code: 'BTC', labelTr: 'Bitcoin (BTC)', labelEn: 'Bitcoin (BTC)', icon: 'logo-bitcoin', isLive: true },
  { code: 'ETH', labelTr: 'Ethereum (ETH)', labelEn: 'Ethereum (ETH)', icon: 'prism-outline', isLive: true },
  { code: 'XRP', labelTr: 'Ripple (XRP)', labelEn: 'Ripple (XRP)', icon: 'pulse-outline', isLive: true },
  { code: 'CUSTOM', labelTr: 'Özel Yatırım', labelEn: 'Custom Asset', icon: 'trending-up-outline', isLive: false },
];

export function getPresetLabel(code: string, lang: AppLanguage = 'tr'): string {
  const found = INVESTMENT_PRESETS.find((p) => p.code === code);
  if (!found) return code;
  return lang === 'tr' ? found.labelTr : found.labelEn;
}

/**
 * Attempts to infer a live preset code from assetCode or free-text description.
 */
export function inferAssetCode(assetCode?: string, description?: string): string | null {
  if (assetCode && assetCode !== 'CUSTOM') {
    return assetCode;
  }
  if (!description) return null;
  const lower = description.toLowerCase();

  if (lower.includes('çeyrek') || lower.includes('ceyrek') || lower.includes('quarter gold')) {
    return 'XAU_QUARTER';
  }
  if (lower.includes('yarım') || lower.includes('yarim') || lower.includes('half gold')) {
    return 'XAU_HALF';
  }
  if (lower.includes('tam altın') || lower.includes('tam altin') || lower.includes('cumhuriyet') || lower.includes('full gold')) {
    return 'XAU_FULL';
  }
  if (lower.includes('altın') || lower.includes('altin') || lower.includes('gold') || lower.includes('xau')) {
    return 'XAU_GRAM';
  }
  if (lower.includes('gümüş') || lower.includes('gumus') || lower.includes('silver') || lower.includes('xag')) {
    return 'XAG_GRAM';
  }
  if (lower.includes('btc') || lower.includes('bitcoin')) {
    return 'BTC';
  }
  if (lower.includes('eth') || lower.includes('ethereum')) {
    return 'ETH';
  }
  if (lower.includes('xrp') || lower.includes('ripple')) {
    return 'XRP';
  }
  if (lower.includes('usd') || lower.includes('dolar') || lower.includes('dollar')) {
    return 'USD';
  }
  if (lower.includes('eur') || lower.includes('euro')) {
    return 'EUR';
  }
  if (lower.includes('gbp') || lower.includes('sterlin') || lower.includes('pound')) {
    return 'GBP';
  }

  return null;
}

/**
 * Returns the live unit rate in TRY for a given assetCode/description if available from ExchangeRates.
 */
export function getLiveAssetRateInTRY(
  rates: ExchangeRates | null,
  assetCode?: string,
  description?: string
): { unitRateInTRY: number | null; resolvedCode: string | null } {
  if (!rates) return { unitRateInTRY: null, resolvedCode: null };
  const resolvedCode = inferAssetCode(assetCode, description);
  if (!resolvedCode) return { unitRateInTRY: null, resolvedCode: null };

  switch (resolvedCode) {
    case 'XAU_GRAM':
      return { unitRateInTRY: rates.XAU_GRAM || null, resolvedCode };
    case 'XAU_QUARTER':
      return { unitRateInTRY: rates.XAU_GRAM ? Number((rates.XAU_GRAM * 1.63).toFixed(2)) : null, resolvedCode };
    case 'XAU_HALF':
      return { unitRateInTRY: rates.XAU_GRAM ? Number((rates.XAU_GRAM * 3.26).toFixed(2)) : null, resolvedCode };
    case 'XAU_FULL':
      return { unitRateInTRY: rates.XAU_GRAM ? Number((rates.XAU_GRAM * 6.52).toFixed(2)) : null, resolvedCode };
    case 'XAG_GRAM':
      return { unitRateInTRY: rates.XAG_GRAM || null, resolvedCode };
    case 'USD':
      return { unitRateInTRY: rates.USD || null, resolvedCode };
    case 'EUR':
      return { unitRateInTRY: rates.EUR || null, resolvedCode };
    case 'GBP':
      return { unitRateInTRY: rates.GBP || null, resolvedCode };
    case 'BTC':
      return { unitRateInTRY: rates.BTC || null, resolvedCode };
    case 'ETH':
      return { unitRateInTRY: rates.ETH || null, resolvedCode };
    case 'XRP':
      return { unitRateInTRY: rates.XRP || null, resolvedCode };
    default:
      return { unitRateInTRY: null, resolvedCode: null };
  }
}

