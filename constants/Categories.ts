import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { AppLanguage } from '@/context/SettingsContext';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ExpenseCategory {
  key: string;
  label: string;
  labelTr: string;
  labelEn: string;
  icon: IoniconName;
}

export const expenseCategories: ExpenseCategory[] = [
  { key: 'housing', label: 'Housing', labelTr: 'Konut / Kira', labelEn: 'Housing', icon: 'home-outline' },
  { key: 'bills', label: 'Bills', labelTr: 'Faturalar', labelEn: 'Bills', icon: 'receipt-outline' },
  { key: 'groceries', label: 'Groceries', labelTr: 'Market & Gıda', labelEn: 'Groceries', icon: 'cart-outline' },
  { key: 'transport', label: 'Transport', labelTr: 'Ulaşım', labelEn: 'Transport', icon: 'bus-outline' },
  { key: 'dining_out', label: 'Dining Out', labelTr: 'Yeme & İçme', labelEn: 'Dining Out', icon: 'fast-food-outline' },
  { key: 'shopping', label: 'Shopping', labelTr: 'Alışveriş', labelEn: 'Shopping', icon: 'shirt-outline' },
  { key: 'subscriptions', label: 'Subscriptions', labelTr: 'Abonelikler', labelEn: 'Subscriptions', icon: 'play-circle-outline' },
  { key: 'personal_care', label: 'Personal Care', labelTr: 'Kişisel Bakım', labelEn: 'Personal Care', icon: 'sparkles-outline' },
  { key: 'health', label: 'Health', labelTr: 'Sağlık', labelEn: 'Health', icon: 'medkit-outline' },
  { key: 'entertainment', label: 'Entertainment', labelTr: 'Eğlence', labelEn: 'Entertainment', icon: 'film-outline' },
  { key: 'education', label: 'Education', labelTr: 'Eğitim', labelEn: 'Education', icon: 'school-outline' },
  { key: 'debt', label: 'Debt', labelTr: 'Borç / Taksit', labelEn: 'Debt', icon: 'card-outline' },
  { key: 'savings', label: 'Savings', labelTr: 'Birikim & Yatırım', labelEn: 'Savings', icon: 'wallet-outline' },
  { key: 'travel', label: 'Travel', labelTr: 'Seyahat', labelEn: 'Travel', icon: 'airplane-outline' },
  { key: 'home_goods', label: 'Home Goods', labelTr: 'Ev Eşyası', labelEn: 'Home Goods', icon: 'bed-outline' },
  { key: 'gifts', label: 'Gifts', labelTr: 'Hediye', labelEn: 'Gifts', icon: 'gift-outline' },
  { key: 'other', label: 'Other', labelTr: 'Diğer', labelEn: 'Other', icon: 'apps-outline' },
];

export const incomeCategories: { key: string; label: string; labelTr: string; labelEn: string; icon: IoniconName }[] = [
  { key: 'salary', label: 'Salary', labelTr: 'Maaş', labelEn: 'Salary', icon: 'cash-outline' },
  { key: 'freelance', label: 'Freelance', labelTr: 'Serbest Gelir', labelEn: 'Freelance', icon: 'laptop-outline' },
  { key: 'investment', label: 'Investment', labelTr: 'Yatırım Getirisi', labelEn: 'Investment', icon: 'trending-up-outline' },
  { key: 'gift', label: 'Gift', labelTr: 'Hediye / Bağış', labelEn: 'Gift', icon: 'gift-outline' },
  { key: 'rental', label: 'Rental', labelTr: 'Kira Geliri', labelEn: 'Rental', icon: 'key-outline' },
  { key: 'other', label: 'Other', labelTr: 'Diğer', labelEn: 'Other', icon: 'apps-outline' },
];

export const incomeCategoryFilter: ExpenseCategory = {
  key: 'incomes',
  label: 'Incomes',
  labelTr: 'Gelirler',
  labelEn: 'Incomes',
  icon: 'cash-outline',
};

export function getCategoryLabel(categoryOrKey?: string | null, lang: AppLanguage = 'tr'): string {
  if (!categoryOrKey) return '';
  const search = categoryOrKey.trim().toLowerCase();

  // Check general income filter
  if (search === 'income' || search === 'incomes' || search === 'gelir' || search === 'gelirler') {
    return lang === 'tr' ? 'Gelirler' : 'Incomes';
  }

  // Check expense categories
  const expenseMatch = expenseCategories.find(
    (c) =>
      c.key.toLowerCase() === search ||
      c.label.toLowerCase() === search ||
      c.labelTr.toLowerCase() === search ||
      c.labelEn.toLowerCase() === search
  );
  if (expenseMatch) {
    return lang === 'tr' ? expenseMatch.labelTr : expenseMatch.labelEn;
  }

  // Check income categories
  const incomeMatch = incomeCategories.find(
    (c) =>
      c.key.toLowerCase() === search ||
      c.label.toLowerCase() === search ||
      c.labelTr.toLowerCase() === search ||
      c.labelEn.toLowerCase() === search
  );
  if (incomeMatch) {
    return lang === 'tr' ? incomeMatch.labelTr : incomeMatch.labelEn;
  }

  return categoryOrKey;
}

export function isSavingsCategory(category?: string | null): boolean {
  if (!category) return false;
  const lower = category.toLowerCase();
  return lower === 'savings' || lower.includes('birikim') || lower.includes('yatırım');
}