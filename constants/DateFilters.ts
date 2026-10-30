import { AppLanguage } from '@/context/SettingsContext';

export interface DateFilterItem {
  key: string;
  label: string;
  labelTr: string;
  labelEn: string;
}

export const dateFilters: DateFilterItem[] = [
  { key: 'all', label: 'All', labelTr: 'Tümü', labelEn: 'All' },
  { key: 'thisWeek', label: 'This Week', labelTr: 'Bu Hafta', labelEn: 'This Week' },
  { key: 'thisMonth', label: 'This Month', labelTr: 'Bu Ay', labelEn: 'This Month' },
  { key: 'last3Months', label: 'Last 3 Months', labelTr: 'Son 3 Ay', labelEn: 'Last 3 Months' },
  { key: 'last6Months', label: 'Last 6 Months', labelTr: 'Son 6 Ay', labelEn: 'Last 6 Months' },
  { key: 'thisYear', label: 'This Year', labelTr: 'Bu Yıl', labelEn: 'This Year' },
];

export function getDateFilters(lang: AppLanguage = 'tr') {
  return dateFilters.map((f) => ({
    key: f.key,
    label: lang === 'tr' ? f.labelTr : f.labelEn,
  }));
}

export function getDateFilterLabel(key: string, lang: AppLanguage = 'tr'): string {
  const match = dateFilters.find((f) => f.key === key);
  if (!match) return key;
  return lang === 'tr' ? match.labelTr : match.labelEn;
}