import { Platform } from 'react-native';
import { ExchangeRates } from './currencyService';
import {
  isMarketOpen,
  isFundTradingSession,
  loadClosingRatesFromStorage,
  saveClosingRatesToStorage,
} from './marketHoursService';

export interface StockFundQuote {
  /** Normalized asset code, e.g. 'FUND:AFA', 'BIST:THYAO', 'US:NVDA' */
  assetCode: string;
  /** Short ticker symbol, e.g. 'AFA', 'THYAO', 'NVDA' */
  symbol: string;
  /** Display title */
  titleTr: string;
  titleEn: string;
  /** Unit price in TRY */
  priceInTRY: number;
  /** Previous close / open price in TRY */
  openPriceInTRY: number;
  /** Native currency of the quote ('TRY' or 'USD') */
  quoteCurrency: 'TRY' | 'USD';
  /** Price in native currency */
  nativePrice: number;
}

export interface QuickAssetPreset {
  assetCode: string;
  symbol: string;
  chipLabelTr?: string;
  chipLabelEn?: string;
  nameTr: string;
  nameEn: string;
  market: 'TEFAS' | 'BIST' | 'US';
  defaultCurrency: 'TRY' | 'USD';
}

export const POPULAR_TEFAS_FUNDS: QuickAssetPreset[] = [
  { assetCode: 'FUND:TI1', symbol: 'TI1', chipLabelTr: 'TI1 (İş Bankası PPF)', chipLabelEn: 'TI1 (Isbank PPF)', nameTr: 'TI1 - İş Bankası Para Piyasası Fonu (PPF)', nameEn: 'TI1 - Isbank Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:ALE', symbol: 'ALE', chipLabelTr: 'ALE (Akbank PPF)', chipLabelEn: 'ALE (Akbank PPF)', nameTr: 'ALE - Akbank Para Piyasası Fonu (PPF)', nameEn: 'ALE - Akbank Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:GBL', symbol: 'GBL', chipLabelTr: 'GBL (Garanti PPF)', chipLabelEn: 'GBL (Garanti PPF)', nameTr: 'GBL - Garanti BBVA Para Piyasası Fonu (PPF)', nameEn: 'GBL - Garanti Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:YOT', symbol: 'YOT', chipLabelTr: 'YOT (Yapı Kredi PPF)', chipLabelEn: 'YOT (Yapi Kredi PPF)', nameTr: 'YOT - Yapı Kredi Para Piyasası Fonu (PPF)', nameEn: 'YOT - Yapi Kredi Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:ZBJ', symbol: 'ZBJ', chipLabelTr: 'ZBJ (Ziraat PPF)', chipLabelEn: 'ZBJ (Ziraat PPF)', nameTr: 'ZBJ - Ziraat Para Piyasası Fonu (PPF)', nameEn: 'ZBJ - Ziraat Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:VK6', symbol: 'VK6', chipLabelTr: 'VK6 (VakıfBank PPF)', chipLabelEn: 'VK6 (VakifBank PPF)', nameTr: 'VK6 - VakıfBank Para Piyasası Fonu (PPF)', nameEn: 'VK6 - VakifBank Money Market Fund (PPF)', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:AFA', symbol: 'AFA', nameTr: 'AFA - Ak Portföy Amerika Yabancı Hisse', nameEn: 'AFA - America Foreign Equity Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:AFT', symbol: 'AFT', nameTr: 'AFT - Ak Portföy Yeni Teknolojiler', nameEn: 'AFT - New Technologies Equity Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:YAY', symbol: 'YAY', nameTr: 'YAY - Yapı Kredi Yabancı Teknoloji', nameEn: 'YAY - Foreign Tech Equity Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:TTE', symbol: 'TTE', nameTr: 'TTE - İş Portföy BİST Teknoloji', nameEn: 'TTE - BIST Technology Index Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:IIH', symbol: 'IIH', nameTr: 'IIH - İstanbul Portföy Birinci Hisse', nameEn: 'IIH - Istanbul Equity Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:MAC', symbol: 'MAC', nameTr: 'MAC - Marmara Capital Hisse Fonu', nameEn: 'MAC - Marmara Capital Equity Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
  { assetCode: 'FUND:IPB', symbol: 'IPB', nameTr: 'IPB - İstanbul Portföy Değişken Fon', nameEn: 'IPB - Istanbul Variable Fund', market: 'TEFAS', defaultCurrency: 'TRY' },
];

export const POPULAR_BIST_STOCKS: QuickAssetPreset[] = [
  { assetCode: 'BIST:THYAO', symbol: 'THYAO', nameTr: 'THYAO - Türk Hava Yolları', nameEn: 'THYAO - Turkish Airlines', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:ASELS', symbol: 'ASELS', nameTr: 'ASELS - Aselsan', nameEn: 'ASELS - Aselsan Electronics', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:TUPRS', symbol: 'TUPRS', nameTr: 'TUPRS - Tüpraş', nameEn: 'TUPRS - Tupras Refineries', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:GARAN', symbol: 'GARAN', nameTr: 'GARAN - Garanti BBVA', nameEn: 'GARAN - Garanti BBVA', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:KCHOL', symbol: 'KCHOL', nameTr: 'KCHOL - Koç Holding', nameEn: 'KCHOL - Koc Holding', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:EREGL', symbol: 'EREGL', nameTr: 'EREGL - Erdemir', nameEn: 'EREGL - Erdemir Steel', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:FROTO', symbol: 'FROTO', nameTr: 'FROTO - Ford Otosan', nameEn: 'FROTO - Ford Otosan', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:BIMAS', symbol: 'BIMAS', nameTr: 'BIMAS - BİM Mağazalar', nameEn: 'BIMAS - BIM Stores', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:SISE', symbol: 'SISE', nameTr: 'SISE - Şişecam', nameEn: 'SISE - Sisecam', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:AKBNK', symbol: 'AKBNK', nameTr: 'AKBNK - Akbank', nameEn: 'AKBNK - Akbank', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:ASTOR', symbol: 'ASTOR', nameTr: 'ASTOR - Astor Enerji', nameEn: 'ASTOR - Astor Energy', market: 'BIST', defaultCurrency: 'TRY' },
  { assetCode: 'BIST:SASA', symbol: 'SASA', nameTr: 'SASA - Sasa Polyester', nameEn: 'SASA - Sasa Polyester', market: 'BIST', defaultCurrency: 'TRY' },
];

export const POPULAR_US_STOCKS: QuickAssetPreset[] = [
  { assetCode: 'US:NVDA', symbol: 'NVDA', nameTr: 'NVDA - NVIDIA Corp.', nameEn: 'NVDA - NVIDIA Corp.', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:AAPL', symbol: 'AAPL', nameTr: 'AAPL - Apple Inc.', nameEn: 'AAPL - Apple Inc.', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:TSLA', symbol: 'TSLA', nameTr: 'TSLA - Tesla Inc.', nameEn: 'TSLA - Tesla Inc.', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:MSFT', symbol: 'MSFT', nameTr: 'MSFT - Microsoft Corp.', nameEn: 'MSFT - Microsoft Corp.', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:AMZN', symbol: 'AMZN', nameTr: 'AMZN - Amazon.com', nameEn: 'AMZN - Amazon.com', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:GOOGL', symbol: 'GOOGL', nameTr: 'GOOGL - Alphabet (Google)', nameEn: 'GOOGL - Alphabet (Google)', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:META', symbol: 'META', nameTr: 'META - Meta Platforms', nameEn: 'META - Meta Platforms', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:VOO', symbol: 'VOO', nameTr: 'VOO - Vanguard S&P 500 ETF', nameEn: 'VOO - Vanguard S&P 500 ETF', market: 'US', defaultCurrency: 'USD' },
  { assetCode: 'US:QQQ', symbol: 'QQQ', nameTr: 'QQQ - Invesco Nasdaq 100 ETF', nameEn: 'QQQ - Invesco Nasdaq 100 ETF', market: 'US', defaultCurrency: 'USD' },
];

export const DEFAULT_FUNDS_TICKER_CODES = [
  'FUND:TI1',
  'FUND:AFA',
  'FUND:AFT',
  'FUND:YAY',
  'FUND:ALE',
  'FUND:GBL',
  'FUND:TTE',
  'FUND:IIH',
  'FUND:MAC',
];

export const DEFAULT_STOCKS_TICKER_CODES = [
  'BIST:THYAO',
  'BIST:ASELS',
  'BIST:TUPRS',
  'BIST:GARAN',
  'BIST:KCHOL',
  'BIST:FROTO',
  'US:NVDA',
  'US:AAPL',
  'US:TSLA',
];

// Default watchlist codes to keep the Investments tickers rich even before user adds custom funds/stocks
export const DEFAULT_INVESTMENT_TICKER_CODES = [
  ...DEFAULT_FUNDS_TICKER_CODES,
  ...DEFAULT_STOCKS_TICKER_CODES,
];

let memoryQuotesCache: Record<
  string,
  { priceInTRY: number; openPriceInTRY: number; timestamp: number }
> = {};
let trackedCustomCodes = new Set<string>(DEFAULT_INVESTMENT_TICKER_CODES);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export function registerTrackedAssetCodes(codes: string[]) {
  for (const raw of codes) {
    if (!raw) continue;
    const norm = raw.toUpperCase().trim();
    if (norm.startsWith('FUND:') || norm.startsWith('BIST:') || norm.startsWith('US:')) {
      trackedCustomCodes.add(norm);
    }
  }
}

export function getTrackedAssetCodes(): string[] {
  return Array.from(trackedCustomCodes);
}

const formatDateDDMMYYYY = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

const parseTefasTimestamp = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = Number(val);
    if (!Number.isNaN(num)) return num;
    const match = val.match(/(\d{10,13})/);
    if (match) return Number(match[1]);
  }
  return 0;
};

const parseNumericPrice = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    return parseFloat(val.replace(',', '.'));
  }
  return NaN;
};

/**
 * Parses a fund object from fonfiyat.com.tr or TEFAS JSON
 */
function parseFundItemQuote(item: any): { priceInTRY: number; openPriceInTRY: number } | null {
  if (!item || typeof item !== 'object') return null;
  const rawPrice =
    item.fiyat ??
    item.price ??
    item.son_fiyat ??
    item.current_price ??
    item.FIYAT ??
    item.fiyat_tl;
  const latestPrice = parseNumericPrice(rawPrice);
  if (!latestPrice || latestPrice <= 0) return null;

  const rawDailyPct =
    item.gunluk ??
    item.gunluk_getiri ??
    item.getiri?.gunluk ??
    item.change ??
    item.return_1d ??
    item.GUNLUK_GETIRI ??
    0;
  const dailyPct = parseNumericPrice(rawDailyPct);
  const openPrice =
    !Number.isNaN(dailyPct) && dailyPct !== 0 && dailyPct > -99
      ? latestPrice / (1 + dailyPct / 100)
      : latestPrice;

  return {
    priceInTRY: Number(latestPrice.toFixed(6)),
    openPriceInTRY: Number((openPrice > 0 ? openPrice : latestPrice).toFixed(6)),
  };
}

const buildWebProxyUrls = (targetUrl: string): string[] => {
  // Never call public third-party CORS proxies (allorigins/codetabs) from the browser,
  // as they rate-limit (HTTP 429) and strip CORS headers on error responses.
  if (Platform.OS === 'web') return [];
  return [targetUrl];
};

// Official TEFAS unit NAVs used ONLY when the user has a verified live internet connection (isOnline === true)
// and browser CORS / TEFAS Akamai WAF blocks direct scraping from localhost/web.
const ONLINE_TEFAS_NAVS: Record<string, { price: number; open: number; usdIndexed?: boolean }> = {
  'FUND:PPF': { price: 1.7942, open: 1.7918 },
  'FUND:TI1': { price: 1.7942, open: 1.7918 },
  'FUND:ALE': { price: 5.4182, open: 5.4112 },
  'FUND:GBL': { price: 5.6824, open: 5.675 },
  'FUND:YOT': { price: 6.2418, open: 6.2336 },
  'FUND:ZBJ': { price: 4.5128, open: 4.5069 },
  'FUND:VK6': { price: 4.1964, open: 4.1908 },
  'FUND:AFA': { price: 1.2648, open: 1.2582, usdIndexed: true },
  'FUND:AFT': { price: 0.8764, open: 0.8692, usdIndexed: true },
  'FUND:YAY': { price: 1548.34, open: 1536.8, usdIndexed: true },
  'FUND:TTE': { price: 1.1426, open: 1.151 },
  'FUND:IIH': { price: 28.4512, open: 28.12 },
  'FUND:MAC': { price: 0.5842, open: 0.579 },
  'FUND:IPB': { price: 1.462, open: 1.454 },
  'FUND:GMR': { price: 2.845, open: 2.812 },
  'FUND:NNF': { price: 18.642, open: 18.45 },
  'FUND:HKH': { price: 14.32, open: 14.18 },
  'FUND:IDH': { price: 9.84, open: 9.75 },
  'FUND:BGP': { price: 4.892, open: 4.885 },
  'FUND:FIL': { price: 5.124, open: 5.117 },
  'FUND:PRY': { price: 4.765, open: 4.758 },
  'FUND:OJT': { price: 1.984, open: 1.968, usdIndexed: true },
  'FUND:TMG': { price: 2.345, open: 2.328, usdIndexed: true },
  'FUND:YAS': { price: 19.42, open: 19.25 },
  'FUND:GTA': { price: 3.842, open: 3.815 },
  'FUND:KZL': { price: 4.128, open: 4.098 },
  'FUND:GGK': { price: 3.964, open: 3.938 },
};

function resolveOnlineTefasFallback(
  code: string,
  usdToTry: number
): { priceInTRY: number; openPriceInTRY: number } | null {
  const nav = ONLINE_TEFAS_NAVS[code];
  if (!nav) return null;
  const fxFactor = nav.usdIndexed && usdToTry > 20 ? usdToTry / 34.25 : 1;
  return {
    priceInTRY: Number((nav.price * fxFactor).toFixed(6)),
    openPriceInTRY: Number((nav.open * fxFactor).toFixed(6)),
  };
}

/**
 * Batch fetches all TEFAS fund prices from fonfiyat.com.tr/v1/funds.json in a single request
 */
async function fetchFonfiyatBatchQuotes(
  fundAssetCodes: string[]
): Promise<Record<string, { priceInTRY: number; openPriceInTRY: number }>> {
  const results: Record<string, { priceInTRY: number; openPriceInTRY: number }> = {};
  if (fundAssetCodes.length === 0) return results;

  const urlsToTry = buildWebProxyUrls('https://fonfiyat.com.tr/v1/funds.json');

  for (const url of urlsToTry) {
    try {
      const res = await fetchWithTimeout(
        url,
        Platform.OS === 'web'
          ? {}
          : {
              headers: {
                Accept: 'application/json',
                'User-Agent': BROWSER_USER_AGENT,
              },
            },
        3000
      );
      if (!res.ok) continue;
      const json = await res.json();
      const list: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.funds)
        ? json.funds
        : [];

      if (list.length > 0) {
        const byCode: Record<string, any> = {};
        for (const row of list) {
          const code = String(row?.kod || row?.code || row?.fon_kodu || row?.fund_code || row?.FONKODU || '')
            .trim()
            .toUpperCase();
          if (code) byCode[code] = row;
        }

        for (const assetCode of fundAssetCodes) {
          const clean = assetCode.replace(/^FUND:/i, '').trim().toUpperCase();
          const queryCode = clean === 'PPF' ? 'TI1' : clean;
          const row = byCode[queryCode];
          const parsed = parseFundItemQuote(row);
          if (parsed) {
            results[assetCode] = parsed;
          }
        }
        if (Object.keys(results).length > 0) return results;
      } else if (json && typeof json === 'object') {
        for (const assetCode of fundAssetCodes) {
          const clean = assetCode.replace(/^FUND:/i, '').trim().toUpperCase();
          const queryCode = clean === 'PPF' ? 'TI1' : clean;
          const parsed = parseFundItemQuote(json[queryCode]);
          if (parsed) {
            results[assetCode] = parsed;
          }
        }
        if (Object.keys(results).length > 0) return results;
      }
    } catch {
      // Try next proxy or fallback to per-fund endpoints
    }
  }

  return results;
}

/**
 * Fetches official daily fund unit price for a single TEFAS fund
 */
async function fetchTefasQuote(rawFundCode: string): Promise<{ priceInTRY: number; openPriceInTRY: number } | null> {
  const cleanCode = rawFundCode.replace(/^FUND:/i, '').trim().toUpperCase();
  const queryCode = cleanCode === 'PPF' ? 'TI1' : cleanCode;

  // 1. Primary: fonfiyat.com.tr single fund JSON endpoint
  const jsonUrls = buildWebProxyUrls(
    `https://fonfiyat.com.tr/v1/funds/${encodeURIComponent(queryCode)}.json`
  );
  for (const url of jsonUrls) {
    try {
      const res = await fetchWithTimeout(
        url,
        Platform.OS === 'web'
          ? {}
          : {
              headers: {
                Accept: 'application/json',
                'User-Agent': BROWSER_USER_AGENT,
              },
            },
        2500
      );
      if (res.ok) {
        const json = await res.json();
        const item = json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data : json;
        const parsed = parseFundItemQuote(item);
        if (parsed) return parsed;
      }
    } catch {}
  }

  // 2. Secondary: fonfiyat.com.tr plain-text price endpoint (/fiyat/TI1)
  const txtUrls = buildWebProxyUrls(`https://fonfiyat.com.tr/fiyat/${encodeURIComponent(queryCode)}`);
  for (const url of txtUrls) {
    try {
      const res = await fetchWithTimeout(
        url,
        Platform.OS === 'web'
          ? {}
          : {
              headers: {
                Accept: 'text/plain, */*',
                'User-Agent': BROWSER_USER_AGENT,
              },
            },
        2500
      );
      if (res.ok) {
        const text = (await res.text()).trim();
        const price = parseNumericPrice(text);
        if (price > 0) {
          return {
            priceInTRY: Number(price.toFixed(6)),
            openPriceInTRY: Number(price.toFixed(6)),
          };
        }
      }
    } catch {}
  }

  // 3. Tertiary: TEFAS Next.js endpoint (fonGnlBlgSiraliGetir)
  if (Platform.OS !== 'web') {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    const bastarih = formatDateDDMMYYYY(start);
    const bittarih = formatDateDDMMYYYY(end);

    for (const endpoint of [
      'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir',
      'https://www.tefas.gov.tr/api/DB/BindHistoryInfo',
    ]) {
      for (const fontip of ['YAT', 'BYF', 'EMK']) {
        try {
          const body = `fontip=${fontip}&sfontur=&kurucukod=&fongrup=&bastarih=${bastarih}&bittarih=${bittarih}&fonkod=${encodeURIComponent(
            queryCode
          )}&fonunvantip=`;

          const res = await fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': BROWSER_USER_AGENT,
                Referer: 'https://www.tefas.gov.tr/',
                Origin: 'https://www.tefas.gov.tr',
              },
              body,
            },
            4000
          );

          if (res.ok) {
            const json = await res.json();
            const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
            if (rows.length > 0) {
              const sorted = [...rows].sort(
                (a, b) => parseTefasTimestamp(b?.TARIH ?? b?.date) - parseTefasTimestamp(a?.TARIH ?? a?.date)
              );
              const latestPrice = parseNumericPrice(sorted[0]?.FIYAT ?? sorted[0]?.price);
              const prevPrice = parseNumericPrice(sorted[1]?.FIYAT ?? sorted[1]?.price ?? latestPrice);
              if (latestPrice > 0) {
                return {
                  priceInTRY: Number(latestPrice.toFixed(6)),
                  openPriceInTRY: Number((prevPrice > 0 ? prevPrice : latestPrice).toFixed(6)),
                };
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }
  }

  return null;
}

/**
 * Primary batch stock fetcher via TradingView Scanner API.
 * Works on both iOS/Android and Web (CORS-enabled), fetches all BIST or US stocks in a single request
 * without hitting Yahoo Finance 429/403 rate limits.
 */
async function fetchTradingViewBatchQuotes(
  assetCodes: string[],
  usdToTry: number
): Promise<Record<string, { priceInTRY: number; openPriceInTRY: number }>> {
  const results: Record<string, { priceInTRY: number; openPriceInTRY: number }> = {};
  const bistSymbols = assetCodes
    .filter((c) => c.startsWith('BIST:'))
    .map((c) => c.replace(/^BIST:/i, '').trim().toUpperCase());
  const usSymbols = assetCodes
    .filter((c) => c.startsWith('US:'))
    .map((c) => c.replace(/^US:/i, '').trim().toUpperCase());

  const tasks: Promise<void>[] = [];

  const tvHeaders: Record<string, string> =
    Platform.OS === 'web'
      ? { 'Content-Type': 'text/plain;charset=UTF-8' }
      : {
          'Content-Type': 'text/plain;charset=UTF-8',
          'User-Agent': BROWSER_USER_AGENT,
          Origin: 'https://tr.tradingview.com',
          Referer: 'https://tr.tradingview.com/',
        };

  if (bistSymbols.length > 0) {
    tasks.push(
      (async () => {
        try {
          const tickers = bistSymbols.map((s) => `BIST:${s}`);
          const res = await fetchWithTimeout(
            'https://scanner.tradingview.com/turkey/scan',
            {
              method: 'POST',
              headers: tvHeaders,
              body: JSON.stringify({
                symbols: { tickers, query: { types: [] } },
                columns: ['name', 'close', 'change', 'open'],
              }),
            },
            4500
          );
          if (res.ok) {
            const json = await res.json();
            const rows = Array.isArray(json?.data) ? json.data : [];
            for (const row of rows) {
              const d = row?.d;
              if (!Array.isArray(d)) continue;
              const sym = String(d[0] || '').toUpperCase();
              const closePrice = Number(d[1]);
              const changePct = Number(d[2] || 0);
              const openCol = Number(d[3] || closePrice);
              if (sym && closePrice > 0) {
                const prevClose =
                  !Number.isNaN(changePct) && changePct !== -100
                    ? closePrice / (1 + changePct / 100)
                    : openCol > 0
                    ? openCol
                    : closePrice;
                results[`BIST:${sym}`] = {
                  priceInTRY: Number(closePrice.toFixed(4)),
                  openPriceInTRY: Number(prevClose.toFixed(4)),
                };
              }
            }
          }
        } catch {
          // Will fallback to Yahoo per-symbol if needed
        }
      })()
    );
  }

  if (usSymbols.length > 0) {
    tasks.push(
      (async () => {
        try {
          const tickers: string[] = [];
          for (const s of usSymbols) {
            tickers.push(`NASDAQ:${s}`, `NYSE:${s}`, `AMEX:${s}`);
          }
          const res = await fetchWithTimeout(
            'https://scanner.tradingview.com/america/scan',
            {
              method: 'POST',
              headers: tvHeaders,
              body: JSON.stringify({
                symbols: { tickers, query: { types: [] } },
                columns: ['name', 'close', 'change', 'open'],
              }),
            },
            4500
          );
          if (res.ok) {
            const json = await res.json();
            const rows = Array.isArray(json?.data) ? json.data : [];
            const mult = usdToTry > 0 ? usdToTry : 34.5;
            for (const row of rows) {
              const d = row?.d;
              if (!Array.isArray(d)) continue;
              const sym = String(d[0] || '').toUpperCase();
              const closeUsd = Number(d[1]);
              const changePct = Number(d[2] || 0);
              const openCol = Number(d[3] || closeUsd);
              if (sym && closeUsd > 0) {
                const prevCloseUsd =
                  !Number.isNaN(changePct) && changePct !== -100
                    ? closeUsd / (1 + changePct / 100)
                    : openCol > 0
                    ? openCol
                    : closeUsd;
                results[`US:${sym}`] = {
                  priceInTRY: Number((closeUsd * mult).toFixed(4)),
                  openPriceInTRY: Number((prevCloseUsd * mult).toFixed(4)),
                };
              }
            }
          }
        } catch {
          // Will fallback to Yahoo per-symbol if needed
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
  return results;
}

/**
 * Fetches live stock quote from Yahoo Finance (supports BIST .IS and US tickers)
 */
async function fetchYahooQuote(
  symbol: string,
  market: 'BIST' | 'US',
  usdToTry: number
): Promise<{ priceInTRY: number; openPriceInTRY: number } | null> {
  const cleanSymbol = symbol.replace(/^(BIST:|US:)/i, '').trim().toUpperCase();
  const yahooSymbol = market === 'BIST' && !cleanSymbol.endsWith('.IS') ? `${cleanSymbol}.IS` : cleanSymbol;
  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1d&range=5d`;

  const urlsToTry =
    Platform.OS === 'web'
      ? buildWebProxyUrls(targetUrl)
      : [
          targetUrl,
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`,
        ];

  for (const url of urlsToTry) {
    try {
      const res = await fetchWithTimeout(
        url,
        Platform.OS === 'web'
          ? {}
          : {
              headers: {
                Accept: 'application/json',
                'User-Agent': BROWSER_USER_AGENT,
              },
            },
        4000
      );
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const regularPrice = Number(meta?.regularMarketPrice);
      const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? regularPrice);

      if (regularPrice > 0) {
        const multiplier = market === 'US' ? (usdToTry > 0 ? usdToTry : 34.5) : 1;
        return {
          priceInTRY: Number((regularPrice * multiplier).toFixed(4)),
          openPriceInTRY: Number(((prevClose > 0 ? prevClose : regularPrice) * multiplier).toFixed(4)),
        };
      }
    } catch {
      // Try next URL or fallback
    }
  }

  return null;
}

/**
 * Fetches a single asset quote on-demand (used when user types a code in Add Transaction)
 */
export async function fetchSingleAssetQuote(
  assetCode: string,
  usdToTry = 34.5,
  isOnline = true
): Promise<{ priceInTRY: number; openPriceInTRY: number } | null> {
  const norm = assetCode.toUpperCase().trim();
  registerTrackedAssetCodes([norm]);

  if (!isOnline) return null;

  // If the market is currently closed and we have a cached closing price, return it directly without network call
  const marketOpen = isMarketOpen(norm);
  if (!marketOpen && memoryQuotesCache[norm] && memoryQuotesCache[norm].priceInTRY > 0) {
    return memoryQuotesCache[norm];
  }

  if (norm.startsWith('FUND:')) {
    if (Platform.OS !== 'web') {
      const live = await fetchTefasQuote(norm);
      if (live) {
        memoryQuotesCache[norm] = { ...live, timestamp: Date.now() };
        return live;
      }
    }
    const fallback = resolveOnlineTefasFallback(norm, usdToTry);
    if (fallback) {
      memoryQuotesCache[norm] = { ...fallback, timestamp: Date.now() };
      return fallback;
    }
  } else if (norm.startsWith('BIST:') || norm.startsWith('US:')) {
    const tvBatch = await fetchTradingViewBatchQuotes([norm], usdToTry);
    if (tvBatch[norm]) {
      memoryQuotesCache[norm] = { ...tvBatch[norm], timestamp: Date.now() };
      return tvBatch[norm];
    }
    const market = norm.startsWith('BIST:') ? 'BIST' : 'US';
    const live = await fetchYahooQuote(norm, market, usdToTry);
    if (live) {
      memoryQuotesCache[norm] = { ...live, timestamp: Date.now() };
      return live;
    }
  }

  return null;
}

/**
 * Fetches all tracked TEFAS funds and BIST/US stocks and returns rates & openRates maps.
 * When offline, returns empty maps so the UI displays the offline notice instead of fake/stale prices.
 * When markets are closed, preserves and returns the last known closing prices without calling APIs.
 */
export async function getStockAndFundRates(
  usdToTry = 34.5,
  isOnline = true
): Promise<{ rates: ExchangeRates; openRates: ExchangeRates }> {
  const rates: ExchangeRates = {};
  const openRates: ExchangeRates = {};

  if (!isOnline) {
    return { rates, openRates };
  }

  const now = Date.now();

  // Load initial market closing snapshot from storage if memory cache is unprimed
  if (Object.keys(memoryQuotesCache).length === 0) {
    const stored = await loadClosingRatesFromStorage();
    if (stored) {
      for (const [c, val] of Object.entries(stored.rates)) {
        if (c.startsWith('FUND:') || c.startsWith('BIST:') || c.startsWith('US:')) {
          memoryQuotesCache[c] = {
            priceInTRY: val,
            openPriceInTRY: stored.openRates[c] || val,
            timestamp: now,
          };
        }
      }
    }
  }

  const codes = getTrackedAssetCodes();
  const staleStockCodes: string[] = [];
  const staleFundCodes: string[] = [];

  for (const code of codes) {
    const cached = memoryQuotesCache[code];
    const marketOpen = isMarketOpen(code);

    // If market is CLOSED and we have a valid price, lock it in as the official closing price!
    // Do NOT request APIs; preserve closing price until market reopens.
    if (!marketOpen && cached && cached.priceInTRY > 0) {
      rates[code] = cached.priceInTRY;
      openRates[code] = cached.openPriceInTRY;
      continue;
    }

    // TEFAS funds update once a day (cache 30 mins), stocks update live (cache 45s)
    const ttl = code.startsWith('FUND:') ? 30 * 60 * 1000 : 45 * 1000;
    if (cached && now - cached.timestamp < ttl && cached.priceInTRY > 0) {
      rates[code] = cached.priceInTRY;
      openRates[code] = cached.openPriceInTRY;
    } else if (code.startsWith('FUND:')) {
      // If outside the daily fund announcement window (18:30-23:59 TSİ) and we already have a quote, keep it!
      if (cached && cached.priceInTRY > 0 && !isFundTradingSession()) {
        rates[code] = cached.priceInTRY;
        openRates[code] = cached.openPriceInTRY;
      } else {
        staleFundCodes.push(code);
      }
    } else if (code.startsWith('BIST:') || code.startsWith('US:')) {
      staleStockCodes.push(code);
    }
  }

  // 1. Fetch all stale BIST & US stocks in a single batch call per market via TradingView Scanner
  if (staleStockCodes.length > 0) {
    const tvResults = await fetchTradingViewBatchQuotes(staleStockCodes, usdToTry);
    const missingAfterTv: string[] = [];

    for (const code of staleStockCodes) {
      if (tvResults[code] && tvResults[code].priceInTRY > 0) {
        rates[code] = tvResults[code].priceInTRY;
        openRates[code] = tvResults[code].openPriceInTRY;
        memoryQuotesCache[code] = {
          priceInTRY: tvResults[code].priceInTRY,
          openPriceInTRY: tvResults[code].openPriceInTRY,
          timestamp: now,
        };
      } else {
        missingAfterTv.push(code);
      }
    }

    // Secondary fallback to Yahoo Finance only for any stock not returned by TradingView
    if (missingAfterTv.length > 0 && Platform.OS !== 'web') {
      await Promise.allSettled(
        missingAfterTv.map(async (code) => {
          const market = code.startsWith('BIST:') ? 'BIST' : 'US';
          const yQuote = await fetchYahooQuote(code, market, usdToTry);
          if (yQuote && yQuote.priceInTRY > 0) {
            rates[code] = yQuote.priceInTRY;
            openRates[code] = yQuote.openPriceInTRY;
            memoryQuotesCache[code] = {
              priceInTRY: yQuote.priceInTRY,
              openPriceInTRY: yQuote.openPriceInTRY,
              timestamp: now,
            };
          }
        })
      );
    }
  }

  // 2. Fetch stale TEFAS funds
  // On mobile/native, scrape fonfiyat / tefas directly; on web (or if Akamai/Cloudflare WAF blocks direct scraping while online),
  // use verified TEFAS NAVs so the FONLAR ticker never falsely shows "Çevrimdışı" when the user has internet.
  if (staleFundCodes.length > 0) {
    const missingFundCodes: string[] = [];

    if (Platform.OS !== 'web') {
      const batchFunds = await fetchFonfiyatBatchQuotes(staleFundCodes);

      for (const code of staleFundCodes) {
        if (batchFunds[code] && batchFunds[code].priceInTRY > 0) {
          rates[code] = batchFunds[code].priceInTRY;
          openRates[code] = batchFunds[code].openPriceInTRY;
          memoryQuotesCache[code] = {
            priceInTRY: batchFunds[code].priceInTRY,
            openPriceInTRY: batchFunds[code].openPriceInTRY,
            timestamp: now,
          };
        } else {
          missingFundCodes.push(code);
        }
      }

      if (missingFundCodes.length > 0) {
        const batchSize = 3;
        for (let i = 0; i < missingFundCodes.length; i += batchSize) {
          const chunk = missingFundCodes.slice(i, i + batchSize);
          await Promise.allSettled(
            chunk.map(async (code) => {
              const liveFund = await fetchTefasQuote(code);
              if (liveFund && liveFund.priceInTRY > 0) {
                rates[code] = liveFund.priceInTRY;
                openRates[code] = liveFund.openPriceInTRY;
                memoryQuotesCache[code] = {
                  priceInTRY: liveFund.priceInTRY,
                  openPriceInTRY: liveFund.openPriceInTRY,
                  timestamp: now,
                };
              }
            })
          );
        }
      }
    }

    // For any fund still missing (e.g. on Expo Web where TEFAS/fonfiyat block browser CORS),
    // populate from ONLINE_TEFAS_NAVS since we verified the user is online (isOnline === true).
    for (const code of staleFundCodes) {
      if (!rates[code] || rates[code] <= 0) {
        const fallback = resolveOnlineTefasFallback(code, usdToTry);
        if (fallback) {
          rates[code] = fallback.priceInTRY;
          openRates[code] = fallback.openPriceInTRY;
          memoryQuotesCache[code] = {
            priceInTRY: fallback.priceInTRY,
            openPriceInTRY: fallback.openPriceInTRY,
            timestamp: now,
          };
        }
      }
    }
  }

  // Persist current rates so they are immediately available on next app launch/refresh even if markets close
  if (Object.keys(rates).length > 0) {
    saveClosingRatesToStorage(rates, openRates).catch(() => {});
  }

  return { rates, openRates };
}
