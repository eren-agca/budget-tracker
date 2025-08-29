// Bu dosya, harcamalar için önceden tanımlanmış kategorileri içerir.
// Sabit bir liste kullanmak, veri tutarlılığını sağlar ve kategorileri yönetmeyi kolaylaştırır.

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Ionicons'tan gelen ikon isimleri için bir tip tanımı yapıyoruz. Bu, tip güvenliği sağlar.
type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const expenseCategories: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'housing', label: 'Housing', icon: 'home-outline' },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline' },
  { key: 'groceries', label: 'Groceries', icon: 'cart-outline' },
  { key: 'transport', label: 'Transport', icon: 'bus-outline' },
  { key: 'dining_out', label: 'Dining Out', icon: 'fast-food-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'shirt-outline' },
  { key: 'personal_care', label: 'Personal Care', icon: 'sparkles-outline' },
  { key: 'health', label: 'Health', icon: 'medkit-outline' },
  { key: 'entertainment', label: 'Entertainment', icon: 'film-outline' },
  { key: 'education', label: 'Education', icon: 'school-outline' },
  { key: 'debt', label: 'Debt', icon: 'card-outline' },
  { key: 'savings', label: 'Savings', icon: 'wallet-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { key: 'home_goods', label: 'Home Goods', icon: 'bed-outline' },
  { key: 'gifts', label: 'Gifts', icon: 'gift-outline' },
  { key: 'other', label: 'Other', icon: 'apps-outline' },
];