// Bu dosya, harcamalar için önceden tanımlanmış kategorileri içerir.
// Sabit bir liste kullanmak, veri tutarlılığını sağlar ve kategorileri yönetmeyi kolaylaştırır.

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

// Ionicons'tan gelen ikon isimleri için bir tip tanımı yapıyoruz. Bu, tip güvenliği sağlar.
type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const expenseCategories: { key: string; label: string; icon: IoniconName }[] = [
  { key: 'food', label: 'Food', icon: 'fast-food-outline' },
  { key: 'transport', label: 'Transport', icon: 'train-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'cart-outline' },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline' },
  { key: 'entertainment', label: 'Entertainment', icon: 'film-outline' },
  { key: 'health', label: 'Health', icon: 'fitness-outline' },
  { key: 'other', label: 'Other', icon: 'apps-outline' },
];