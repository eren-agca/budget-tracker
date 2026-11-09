import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

export interface SubscriptionBrandMeta {
  family: 'ionicons' | 'mci' | 'monogram';
  iconName?: string;
  monogram?: string;
  color: string;
}

export function getSubscriptionBrandMeta(
  name?: string,
  fallbackIcon?: string,
  fallbackColor?: string
): SubscriptionBrandMeta {
  const lower = (name || '').toLowerCase().trim();

  if (lower.includes('netflix')) {
    return { family: 'mci', iconName: 'netflix', color: '#E50914' };
  }
  if (lower.includes('spotify')) {
    return { family: 'mci', iconName: 'spotify', color: '#1DB954' };
  }
  if (lower.includes('youtube')) {
    return { family: 'ionicons', iconName: 'logo-youtube', color: '#FF0000' };
  }
  if (lower.includes('chatgpt') || lower.includes('openai')) {
    return { family: 'mci', iconName: 'robot-outline', color: '#10A37F' };
  }
  if (lower.includes('icloud')) {
    return { family: 'mci', iconName: 'apple-icloud', color: '#007AFF' };
  }
  if (lower.includes('apple music') || lower.includes('apple tv') || lower === 'apple') {
    return { family: 'ionicons', iconName: 'logo-apple', color: '#FA243C' };
  }
  if (lower.includes('disney')) {
    return { family: 'monogram', monogram: 'D+', color: '#113CCF' };
  }
  if (lower.includes('amazon') || lower.includes('prime')) {
    return { family: 'ionicons', iconName: 'logo-amazon', color: '#00A8E1' };
  }
  if (lower.includes('blutv')) {
    return { family: 'monogram', monogram: 'blu', color: '#00D2D3' };
  }
  if (lower.includes('gain')) {
    return { family: 'monogram', monogram: 'G', color: '#D92546' };
  }
  if (lower.includes('google') || lower.includes('drive')) {
    return { family: 'ionicons', iconName: 'logo-google', color: '#4285F4' };
  }
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return { family: 'ionicons', iconName: 'sparkles', color: '#D97706' };
  }
  if (lower.includes('midjourney')) {
    return { family: 'ionicons', iconName: 'color-palette-outline', color: '#6366F1' };
  }
  if (lower.includes('github') || lower.includes('copilot')) {
    return { family: 'ionicons', iconName: 'logo-github', color: '#8957E5' };
  }
  if (lower.includes('playstation') || lower.includes('ps plus') || lower.includes('psn')) {
    return { family: 'ionicons', iconName: 'logo-playstation', color: '#00439C' };
  }
  if (lower.includes('xbox') || lower.includes('game pass')) {
    return { family: 'ionicons', iconName: 'logo-xbox', color: '#107C10' };
  }
  if (lower.includes('steam')) {
    return { family: 'ionicons', iconName: 'logo-steam', color: '#38BDF8' };
  }
  if (lower.includes('discord')) {
    return { family: 'ionicons', iconName: 'logo-discord', color: '#5865F2' };
  }
  if (lower.includes('twitch')) {
    return { family: 'ionicons', iconName: 'logo-twitch', color: '#9146FF' };
  }
  if (lower.includes('spor') || lower.includes('gym') || lower.includes('fitness')) {
    return { family: 'ionicons', iconName: 'fitness-outline', color: '#10B981' };
  }

  return {
    family: 'ionicons',
    iconName: fallbackIcon || 'play-circle-outline',
    color: fallbackColor || '#39FF14',
  };
}

export const SubscriptionBrandIcon: React.FC<{
  name?: string;
  fallbackIcon?: string;
  fallbackColor?: string;
  size?: number;
  colorOverride?: string;
}> = ({ name, fallbackIcon, fallbackColor, size = 18, colorOverride }) => {
  const meta = getSubscriptionBrandMeta(name, fallbackIcon, fallbackColor);
  const finalColor = colorOverride || meta.color;

  if (meta.family === 'mci') {
    return <MaterialCommunityIcons name={meta.iconName as any} size={size} color={finalColor} />;
  }
  if (meta.family === 'monogram') {
    return (
      <ThemedText
        style={[
          styles.monogramText,
          {
            color: finalColor,
            fontSize: Math.max(10, Math.round(size * 0.65)),
            lineHeight: Math.round(size * 0.9),
          },
        ]}>
        {meta.monogram}
      </ThemedText>
    );
  }
  return <Ionicons name={(meta.iconName as any) || 'play-circle-outline'} size={size} color={finalColor} />;
};

export interface BankBrandInfo {
  color: string;
  domain?: string;
  family: 'mci' | 'ionicons' | 'monogram';
  iconName?: string;
  monogram?: string;
}

export function getBankBrandInfo(bankName?: string, lang: 'tr' | 'en' = 'tr'): BankBrandInfo {
  const lower = (bankName || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/\u0307/g, '')
    .trim();

  if (lower.includes('garanti')) {
    return { color: '#00A650', domain: 'garantibbva.com.tr', family: 'mci', iconName: 'clover' };
  }
  if (lower.includes('ziraat')) {
    return { color: '#E11D48', domain: 'ziraatbank.com.tr', family: 'mci', iconName: 'barley' };
  }
  if (lower.includes('iş bank') || lower.includes('is bank')) {
    return { color: '#2563EB', domain: 'isbank.com.tr', family: 'monogram', monogram: lang === 'tr' ? 'İŞ' : 'IS' };
  }
  if (lower.includes('yapı kredi') || lower.includes('yapi kredi')) {
    return { color: '#3B82F6', domain: 'yapikredi.com.tr', family: 'monogram', monogram: 'YK' };
  }
  if (lower.includes('akbank')) {
    return { color: '#EF4444', domain: 'akbank.com', family: 'monogram', monogram: 'AK' };
  }
  if (lower.includes('enpara')) {
    return { color: '#A855F7', domain: 'enpara.com', family: 'monogram', monogram: 'EN' };
  }
  if (lower.includes('qnb')) {
    return { color: '#6366F1', domain: 'qnb.com.tr', family: 'monogram', monogram: 'QNB' };
  }
  if (lower.includes('vakıf') || lower.includes('vakif')) {
    return { color: '#F59E0B', domain: 'vakifbank.com.tr', family: 'monogram', monogram: 'VB' };
  }
  if (lower.includes('halkbank')) {
    return { color: '#0EA5E9', domain: 'halkbank.com.tr', family: 'monogram', monogram: 'HB' };
  }
  if (lower.includes('denizbank')) {
    return { color: '#0284C7', domain: 'denizbank.com', family: 'mci', iconName: 'waves' };
  }
  if (lower.includes('teb')) {
    return { color: '#10B981', domain: 'teb.com.tr', family: 'monogram', monogram: 'TEB' };
  }
  if (lower.includes('kuveyt')) {
    return { color: '#14B8A6', domain: 'kuveytturk.com.tr', family: 'monogram', monogram: 'KT' };
  }
  if (lower.includes('ing')) {
    return { color: '#FF6200', domain: 'ing.com.tr', family: 'monogram', monogram: 'ING' };
  }
  if (lower.includes('hsbc')) {
    return { color: '#EF4444', domain: 'hsbc.com.tr', family: 'monogram', monogram: 'HS' };
  }
  if (lower.includes('papara')) {
    return { color: '#C084FC', domain: 'papara.com', family: 'monogram', monogram: 'P' };
  }
  if (lower.includes('paycell')) {
    return { color: '#38BDF8', domain: 'paycell.com.tr', family: 'monogram', monogram: 'PC' };
  }
  if (lower.includes('fibabanka')) {
    return { color: '#22C55E', domain: 'fibabanka.com.tr', family: 'monogram', monogram: 'FB' };
  }
  if (lower.includes('odeabank')) {
    return { color: '#F97316', domain: 'odeabank.com.tr', family: 'monogram', monogram: 'OD' };
  }
  if (lower.includes('şekerbank') || lower.includes('sekerbank')) {
    return { color: '#16A34A', domain: 'sekerbank.com.tr', family: 'monogram', monogram: lang === 'tr' ? 'ŞB' : 'SB' };
  }
  if (lower.includes('türkiye finans') || lower.includes('turkiye finans')) {
    return { color: '#0D9488', domain: 'turkiyefinans.com.tr', family: 'monogram', monogram: 'TF' };
  }
  if (lower.includes('albaraka')) {
    return { color: '#EA580C', domain: 'albaraka.com.tr', family: 'monogram', monogram: 'AT' };
  }
  if (lower.includes('anadolubank')) {
    return { color: '#3B82F6', domain: 'anadolubank.com.tr', family: 'monogram', monogram: 'AB' };
  }
  if (lower.includes('alternatif')) {
    return { color: '#E11D48', domain: 'alternatifbank.com.tr', family: 'monogram', monogram: 'AL' };
  }
  if (lower.includes('burgan')) {
    return { color: '#0284C7', domain: 'burgan.com.tr', family: 'monogram', monogram: 'BB' };
  }
  if (lower.includes('hayat')) {
    return { color: '#10B981', domain: 'hayatfinans.com.tr', family: 'monogram', monogram: 'HF' };
  }
  if (lower.includes('icbc')) {
    return { color: '#EF4444', domain: 'icbc.com.tr', family: 'monogram', monogram: 'IC' };
  }
  if (lower.includes('tom') || lower.includes('hadi')) {
    return { color: '#8B5CF6', domain: 'tombank.com.tr', family: 'monogram', monogram: 'TOM' };
  }
  if (lower.includes('nakit') || lower.includes('havale') || lower.includes('cash')) {
    return { color: '#10B981', family: 'ionicons', iconName: 'cash-outline' };
  }
  if (lower.includes('diğer') || lower.includes('diger') || lower.includes('other')) {
    return { color: '#94A3B8', family: 'ionicons', iconName: 'ellipsis-horizontal' };
  }

  return { color: '#64748B', family: 'ionicons', iconName: 'card-outline' };
}

export const BankBrandBadge: React.FC<{
  bankName?: string;
  size?: number;
  iconSize?: number;
  language?: 'tr' | 'en';
}> = ({ bankName, size = 28, iconSize = 15, language = 'tr' }) => {
  const info = getBankBrandInfo(bankName, language);
  const [imgError, setImgError] = useState(false);
  const logoUri = info.domain
    ? `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.${info.domain}&size=128`
    : null;

  return (
    <View
      style={[
        styles.bankBadgeCircle,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.34),
          backgroundColor: logoUri && !imgError ? '#FFFFFF' : `${info.color}20`,
          borderColor: `${info.color}48`,
          overflow: 'hidden',
        },
      ]}>
      {logoUri && !imgError ? (
        <Image
          source={{ uri: logoUri }}
          style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72), borderRadius: 3 }}
          resizeMode="contain"
          onLoad={(e) => {
            const w = e.nativeEvent?.source?.width;
            if (typeof w === 'number' && w > 0 && w <= 16) {
              setImgError(true);
            }
          }}
          onError={() => setImgError(true)}
        />
      ) : info.family === 'mci' ? (
        <MaterialCommunityIcons name={info.iconName as any} size={iconSize} color={info.color} />
      ) : info.family === 'ionicons' ? (
        <Ionicons name={(info.iconName as any) || 'card-outline'} size={iconSize} color={info.color} />
      ) : (
        <ThemedText
          style={[
            styles.bankMonogramText,
            {
              color: info.color,
              fontSize: (info.monogram?.length || 0) >= 3 ? Math.max(8.5, iconSize * 0.56) : Math.max(10, iconSize * 0.68),
              lineHeight: iconSize,
            },
          ]}>
          {info.monogram}
        </ThemedText>
      )}
    </View>
  );
};

export interface StockBrandInfo {
  symbol: string;
  color: string;
  domain?: string;
  family: 'ionicons' | 'mci' | 'monogram';
  iconName?: string;
  monogram?: string;
}

const STOCK_BRAND_MAP: Record<string, Omit<StockBrandInfo, 'symbol'>> = {
  // BIST Stocks
  THYAO: { color: '#E30A17', domain: 'turkishairlines.com', family: 'ionicons', iconName: 'airplane' },
  ASELS: { color: '#2563EB', domain: 'aselsan.com.tr', family: 'ionicons', iconName: 'shield-checkmark' },
  TUPRS: { color: '#EA580C', domain: 'tupras.com.tr', family: 'ionicons', iconName: 'flame' },
  GARAN: { color: '#00A650', domain: 'garantibbva.com.tr', family: 'mci', iconName: 'clover' },
  KCHOL: { color: '#E11D48', domain: 'koctas.com.tr', family: 'monogram', monogram: 'KOÇ' },
  EREGL: { color: '#F97316', domain: 'erdemir.com.tr', family: 'monogram', monogram: 'ER' },
  FROTO: { color: '#0284C7', domain: 'ford.com', family: 'ionicons', iconName: 'car-sport' },
  BIMAS: { color: '#E11D48', domain: 'bim.com.tr', family: 'monogram', monogram: 'BİM' },
  SISE: { color: '#0EA5E9', domain: 'sisecam.com.tr', family: 'monogram', monogram: 'ŞİŞ' },
  AKBNK: { color: '#EF4444', domain: 'akbank.com', family: 'monogram', monogram: 'AK' },
  ASTOR: { color: '#3B82F6', domain: 'astoras.com.tr', family: 'ionicons', iconName: 'flash' },
  SASA: { color: '#0284C7', domain: 'sasa.com.tr', family: 'monogram', monogram: 'SA' },
  // US Stocks & ETFs
  NVDA: { color: '#76B900', domain: 'nvidia.com', family: 'ionicons', iconName: 'hardware-chip' },
  AAPL: { color: '#A1A1AA', domain: 'apple.com', family: 'ionicons', iconName: 'logo-apple' },
  TSLA: { color: '#E82127', domain: 'tesla.com', family: 'monogram', monogram: 'T' },
  MSFT: { color: '#00A4EF', domain: 'microsoft.com', family: 'ionicons', iconName: 'logo-microsoft' },
  AMZN: { color: '#FF9900', domain: 'amazon.com', family: 'ionicons', iconName: 'logo-amazon' },
  GOOGL: { color: '#4285F4', domain: 'google.com', family: 'ionicons', iconName: 'logo-google' },
  META: { color: '#0668E1', domain: 'meta.com', family: 'mci', iconName: 'infinity' },
  VOO: { color: '#DC2626', domain: 'vanguard.com', family: 'monogram', monogram: 'VOO' },
  QQQ: { color: '#3B82F6', domain: 'invesco.com', family: 'monogram', monogram: 'QQQ' },
  // TEFAS Funds
  TI1: { color: '#2563EB', domain: 'isbank.com.tr', family: 'monogram', monogram: 'İŞ' },
  TTE: { color: '#2563EB', domain: 'isbank.com.tr', family: 'monogram', monogram: 'İŞ' },
  ALE: { color: '#EF4444', domain: 'akbank.com', family: 'monogram', monogram: 'AK' },
  AFA: { color: '#EF4444', domain: 'akbank.com', family: 'monogram', monogram: 'AK' },
  AFT: { color: '#EF4444', domain: 'akbank.com', family: 'monogram', monogram: 'AK' },
  GBL: { color: '#00A650', domain: 'garantibbva.com.tr', family: 'mci', iconName: 'clover' },
  YOT: { color: '#3B82F6', domain: 'yapikredi.com.tr', family: 'monogram', monogram: 'YK' },
  YAY: { color: '#3B82F6', domain: 'yapikredi.com.tr', family: 'monogram', monogram: 'YK' },
  ZBJ: { color: '#E11D48', domain: 'ziraatbank.com.tr', family: 'mci', iconName: 'barley' },
  VK6: { color: '#F59E0B', domain: 'vakifbank.com.tr', family: 'monogram', monogram: 'VB' },
  IIH: { color: '#10B981', family: 'monogram', monogram: 'IIH' },
  IPB: { color: '#10B981', family: 'monogram', monogram: 'IPB' },
  MAC: { color: '#8B5CF6', family: 'monogram', monogram: 'MAC' },
};

export function getStockBrandInfo(rawSymbol?: string): StockBrandInfo {
  const clean = (rawSymbol || '')
    .toUpperCase()
    .replace(/^(FUND:|BIST:|US:)/, '')
    .replace(/\.IS$/, '')
    .trim();

  const match = STOCK_BRAND_MAP[clean];
  if (match) {
    return { symbol: clean, ...match };
  }

  return {
    symbol: clean || '?',
    color: '#39FF14',
    family: 'monogram',
    monogram: (clean || '?').slice(0, 3),
  };
}

export const StockBrandBadge: React.FC<{
  symbol?: string;
  size?: number;
  iconSize?: number;
}> = ({ symbol, size = 24, iconSize = 14 }) => {
  const info = getStockBrandInfo(symbol);
  const [imgError, setImgError] = useState(false);
  const logoUri = info.domain
    ? `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.${info.domain}&size=128`
    : null;

  return (
    <View
      style={[
        styles.bankBadgeCircle,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.34),
          backgroundColor: logoUri && !imgError ? '#FFFFFF' : `${info.color}22`,
          borderColor: `${info.color}55`,
          overflow: 'hidden',
        },
      ]}>
      {logoUri && !imgError ? (
        <Image
          source={{ uri: logoUri }}
          style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72), borderRadius: 3 }}
          resizeMode="contain"
          onLoad={(e) => {
            const w = e.nativeEvent?.source?.width;
            if (typeof w === 'number' && w > 0 && w <= 16) {
              setImgError(true);
            }
          }}
          onError={() => setImgError(true)}
        />
      ) : info.family === 'mci' ? (
        <MaterialCommunityIcons name={info.iconName as any} size={iconSize} color={info.color} />
      ) : info.family === 'ionicons' ? (
        <Ionicons name={(info.iconName as any) || 'Trending-up'} size={iconSize} color={info.color} />
      ) : (
        <ThemedText
          style={[
            styles.bankMonogramText,
            {
              color: info.color,
              fontSize:
                (info.monogram?.length || 0) >= 3
                  ? Math.max(8, iconSize * 0.54)
                  : Math.max(9.5, iconSize * 0.66),
              lineHeight: iconSize,
            },
          ]}>
          {info.monogram}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  monogramText: {
    fontWeight: '900',
    letterSpacing: -0.4,
    includeFontPadding: false,
    textAlign: 'center',
  },
  bankBadgeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bankMonogramText: {
    fontWeight: '900',
    letterSpacing: -0.3,
    includeFontPadding: false,
    textAlign: 'center',
  },
});

