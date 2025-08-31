// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/(tabs)/index.tsx

import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, View, ListRenderItem } from 'react-native';

// Kendi oluşturduğumuz tema bileşenlerini import ediyoruz.
import { ThemedText } from '@/components/ThemedText';
import { Ticker } from '@/components/Ticker';
import { ThemedView } from '@/components/ThemedView';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { dateFilters } from '@/constants/DateFilters';
import { expenseCategories } from '@/constants/Categories';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';

// Veritabanından gelen işlem verileri için bir arayüz (interface) tanımlıyoruz.
interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  purchaseRate?: number; // Alım anındaki kur (örn: 1 gram altın = 2500 TL)
  assetQuantity?: number; // Alınan varlık miktarı (örn: 2 gram)
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB'; // Her işlemin kendi para birimi var.
  type: 'income' | 'expense';
  date: Date; // Firestore Timestamp'i Date objesine çevireceğiz.
}

// OPTİMİZASYON: Liste elemanını ayrı bir bileşen haline getiriyoruz.
// React.memo, bu bileşenin propları değişmediği sürece yeniden render edilmesini engeller.
const TransactionListItem = React.memo(({ item, onDelete, styles }: { item: Transaction, onDelete: (id: string) => void, styles: any }) => {
  // Her bir işlem için doğru para birimi sembolünü buluyoruz.
  const itemCurrency = currencies.find((c) => c.code === item.currency) || { symbol: item.currency };

  // Firestore Timestamp objesini "GG/AA\nSS:DD" formatında bir string'e çeviren fonksiyon.
  const formatDate = (timestamp: Date) => {
    if (!(timestamp instanceof Date)) return '';
    const day = String(timestamp.getDate()).padStart(2, '0');
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    return `${day}/${month}\n${hours}:${minutes}`;
  };

  return (
      <View style={styles.transactionItem}>
        <View style={styles.dateContainer}>
          <ThemedText style={styles.dateText}>{formatDate(item.date)}</ThemedText>
        </View>
        <View style={styles.transactionDetails}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <ThemedText style={styles.transactionDescription} numberOfLines={1}>{item.description}</ThemedText>
            <ThemedText style={styles.transactionCategory} numberOfLines={1}>{item.category}</ThemedText>
            {/* Eğer bu bir yatırım işlemiyse, miktar ve alım kurunu göster. */}
            {item.category === 'Savings' && item.purchaseRate != null && item.assetQuantity != null && (
                <View style={styles.assetInfoContainer}>
                  <ThemedText style={styles.assetInfoText}>
                    {`${item.assetQuantity} @ ${item.purchaseRate.toFixed(2)} ${itemCurrency.symbol}`}
                  </ThemedText>
                </View>
            )}
          </View>
          <ThemedText style={item.amount > 0 ? styles.incomeText : styles.expenseText}>{itemCurrency.symbol}{item.amount.toFixed(2)}</ThemedText>
        </View>
        <AnimatedPressable onPress={() => onDelete(item.id)} style={styles.deleteButton}><Ionicons name="trash-outline" size={22} color="#ff3b30" /></AnimatedPressable>
      </View>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme);

  // States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [tickerData, setTickerData] = useState<string[]>([]);
  const [isDateModalVisible, setDateModalVisible] = useState(false);

  // Seçilen zaman filtresine göre işlemleri filtreleyen bir useMemo.
  const dateFilteredTransactions = useMemo(() => {
    const now = new Date();
    if (selectedDateFilter === 'all') {
      return transactions;
    }
    let startDate: Date;
    switch (selectedDateFilter) {
      case 'thisWeek':
        startDate = new Date();
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case 'thisMonth':
        startDate = new Date();
        startDate.setDate(1);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return transactions;
    }
    startDate.setHours(0, 0, 0, 0);
    return transactions.filter((t) => t.date && t.date >= startDate);
  }, [transactions, selectedDateFilter]);

  // Bu useMemo hook'u, TÜM transactions dizisine göre özet değerleri hesaplar.
  // Bu sayede zaman filtresi, üstteki özet kartını etkilemez.
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    if (!rates) return { totalIncome: 0, totalExpense: 0, balance: 0 };
    return transactions.reduce(
        (acc, curr) => {
          // rates[curr.currency] bir birim yabancı paranın kaç TRY olduğunu tutar (örn: rates['USD'] = 32.5)
          const rate = rates[curr.currency] || 1;
          // İşlem tutarını TRY'ye çevirmek için çarpmalıyız.
          const amountInTRY = curr.amount * rate;
          if (curr.type === 'income') {
            acc.totalIncome += amountInTRY;
          } else {
            acc.totalExpense += amountInTRY; // Giderler zaten negatif olduğu için direkt ekliyoruz.
          }
          acc.balance = acc.totalIncome + acc.totalExpense;
          return acc;
        },
        { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [transactions, rates]);

  // Kur oranlarını çekmek için useEffect.
  useEffect(() => {
    const fetchRates = async () => {
        const fetchedRates = await getExchangeRates();
        setRates(fetchedRates);

        // Kayan bant için veriyi formatla
        if (fetchedRates) {
            const tickerItems = [
                { code: 'USD', name: 'Dolar' },
                { code: 'EUR', name: 'Euro' },
                { code: 'XAU', name: 'Altın (Ons)' },
                { code: 'XAG', name: 'Gümüş (Ons)' },
                { code: 'RUB', name: 'Ruble' },
                { code: 'BTC', name: 'Bitcoin' },
                { code: 'ETH', name: 'Ethereum' },
                { code: 'XRP', name: 'XRP' },
            ];

            const formattedTickerData = tickerItems
                .filter(item => fetchedRates[item.code]) // Sadece kuru mevcut olanları göster
                .map(item => {
                    const rate = fetchedRates[item.code];
                    // Sayıyı para birimi formatında (örn: 2.100.000,00 ₺) göster
                    const formattedRate = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate);
                    return `${item.name}: ${formattedRate} ₺`;
                });
            setTickerData(formattedTickerData);
        }
    };

    fetchRates();
    // Verileri her 1 dakikada bir yenilemek için bir interval kuruyoruz.
    const intervalId = setInterval(fetchRates, 60000);
    // Component kaldırıldığında interval'ı temizliyoruz.
    return () => clearInterval(intervalId);
  }, []);

  // Sabit gelirleri kontrol edip ekleyen useEffect.
  useEffect(() => {
    if (!user) return;
    const checkRecurringIncomes = async () => {
      const recurringQuery = query(collection(db, 'users', user.uid, 'recurringIncomes'));
      const querySnapshot = await getDocs(recurringQuery);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      for (const docSnap of querySnapshot.docs) {
        const recurring = docSnap.data();
        const lastAdded = recurring.lastAdded ? recurring.lastAdded.toDate() : null;
        const isDayDue = today.getDate() >= recurring.dayOfMonth;
        const notAddedThisMonth = !lastAdded || lastAdded.getMonth() !== currentMonth || lastAdded.getFullYear() !== currentYear;

        if (isDayDue && notAddedThisMonth) {
          const transactionDate = new Date(currentYear, currentMonth, recurring.dayOfMonth);
          await addDoc(collection(db, 'users', user.uid, 'transactions'), {
            amount: recurring.amount,
            category: recurring.category,
            currency: recurring.currency,
            description: `Recurring: ${recurring.category}`,
            type: 'income',
            date: Timestamp.fromDate(transactionDate),
          });
          await updateDoc(doc(db, 'users', user.uid, 'recurringIncomes', docSnap.id), {
            lastAdded: Timestamp.now(),
          });
        }
      }
    };
    const timeoutId = setTimeout(checkRecurringIncomes, 3000);
    return () => clearTimeout(timeoutId);
  }, [user]);

  // Bu useEffect hook'u, kullanıcıya özel işlemleri çeker.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({
          ...data, id: doc.id, date: data.date.toDate()
        } as Transaction);
      });
      setTransactions(transactionsData);
    });
    return () => unsubscribe();
  }, [user]);

  // Bir işlemi silmek için kullanılan fonksiyon.
  const handleDeleteTransaction = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
    } catch (error) {
      console.error("Error deleting document: ", error);
      Alert.alert("Error", "Could not delete the transaction.");
    }
  }, [user]);

  // Hem zaman hem de kategori filtresinden geçmiş nihai listeyi oluşturan useMemo.
  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) {
      return dateFilteredTransactions;
    }
    return dateFilteredTransactions.filter(
        (transaction) => transaction.type === 'income' || transaction.category === selectedCategory
    );
  }, [dateFilteredTransactions, selectedCategory]);

  // Seçili olan zaman filtresinin etiketini (label) buluyoruz.
  const selectedDateFilterLabel = dateFilters.find(f => f.key === selectedDateFilter)?.label || 'All';

  // OPTİMİZASYON: renderItem fonksiyonunu useCallback ile sarmalıyoruz.
  const renderTransaction: ListRenderItem<Transaction> = useCallback(({ item }) => (
      <TransactionListItem
          item={item}
          onDelete={handleDeleteTransaction}
          styles={styles}
      />
  ), [styles, handleDeleteTransaction]);

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
      // Ana içeriği ve modal'ı sarmalamak için bir View kullanıyoruz.
      <View style={{ flex: 1 }}>
        <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
          {/* Bu, ekranın en üstünde yer alan, estetik amaçlı, işlevsiz bir çubuktur. */}
          <View style={styles.topDecorationBar} />

          {/* Canlı Kur Bilgilerini Gösteren Kayan Bant */}
          <Ticker data={tickerData} />

          {/* Para Birimi Seçici */}
          <View style={styles.currencySelectorContainer}>
            {currencies.map((c) => (
                <AnimatedPressable
                    key={c.code}
                    onPress={() => setDisplayCurrency(c)}
                    style={[styles.currencyButton, displayCurrency.code === c.code && styles.currencyButtonActive]}>
                  <ThemedText style={[styles.currencyButtonText, displayCurrency.code === c.code && styles.currencyButtonTextActive]}>
                    {c.code}
                  </ThemedText>
                </AnimatedPressable>
            ))}
          </View>

          {/* Toplam Gelir, Gider ve Bakiye'yi gösteren özet barı */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <ThemedText style={styles.summaryLabel}>Income</ThemedText>
              {rates && (
                  <ThemedText style={styles.summaryAmountIncome}>
                    {/* Toplam gelir (TRY) / seçili para biriminin kuru */}
                    {displayCurrency.symbol}
                    {(totalIncome / (rates[displayCurrency.code] || 1)).toFixed(2)}
                  </ThemedText>
              )}
            </View>
            <View style={styles.summaryBox}>
              <ThemedText style={styles.summaryLabel}>Expenses</ThemedText>
              {rates && (
                  <ThemedText style={styles.summaryAmountExpense}>
                    {/* Toplam gider (TRY) / seçili para biriminin kuru */}
                    {displayCurrency.symbol}
                    {Math.abs(totalExpense / (rates[displayCurrency.code] || 1)).toFixed(2)}
                  </ThemedText>
              )}
            </View>
            <View style={styles.summaryBox}>
              <ThemedText style={styles.summaryLabel}>Balance</ThemedText>
              {rates && (
                  <ThemedText style={[styles.summaryAmountBalance, { color: balance >= 0 ? '#34c759' : '#ff3b30' }]}>
                    {/* Bakiye (TRY) / seçili para biriminin kuru */}
                    {displayCurrency.symbol}
                    {(balance / (rates[displayCurrency.code] || 1)).toFixed(2)}
                  </ThemedText>
              )}
            </View>
          </View>

          {/* Zaman Filtresi Açılır Listesi */}
          <View style={styles.dropdownContainer}>
            <AnimatedPressable style={styles.dropdownButton} onPress={() => setDateModalVisible(true)}>
              <ThemedText style={styles.dropdownButtonText}>{selectedDateFilterLabel}</ThemedText>
              <Ionicons name="chevron-down" size={20} color={Colors[colorScheme ?? 'light'].text} />
            </AnimatedPressable>
          </View>

          {/* Kategori Filtreleme Barı */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* 'All' butonu filtresiz durumu temsil eder. */}
              <AnimatedPressable
                  onPress={() => setSelectedCategory(null)}
                  style={[styles.filterButton, selectedCategory === null && styles.filterButtonActive]}>
                <ThemedText style={[styles.filterButtonText, selectedCategory === null && styles.filterButtonTextActive]}>
                  All
                </ThemedText>
              </AnimatedPressable>
              {/* Diğer harcama kategorileri için butonlar. */}
              {expenseCategories.map((cat) => (
                  <AnimatedPressable
                      key={cat.key}
                      onPress={() => setSelectedCategory(cat.label)}
                      style={[styles.filterButton, selectedCategory === cat.label && styles.filterButtonActive]}>
                    <ThemedText style={[styles.filterButtonText, selectedCategory === cat.label && styles.filterButtonTextActive]}>
                      {cat.label}
                    </ThemedText>
                  </AnimatedPressable>
              ))}
            </ScrollView>
          </View>

          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Recent Transactions</ThemedText>
          </ThemedView>

          {/* Gelir-Gider listesini göstermek için FlatList kullanıyoruz. */}
          <FlatList
              // data prop'u olarak artık filtrelenmiş listeyi kullanıyoruz.
              data={filteredTransactions}
              keyExtractor={keyExtractor}
              renderItem={renderTransaction}
              windowSize={10} // Performans için ek ayarlar
              initialNumToRender={10}
              // Eğer hiç işlem yoksa bu mesajı göster.
              ListEmptyComponent={
                <ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No transactions yet.</ThemedText>
              }
          />

          {/* Yeni işlem ekleme butonu. */}
          <Link href="/add-transaction" asChild>
            <AnimatedPressable style={styles.fab}>
              <Ionicons name="add" size={32} color="white" />
            </AnimatedPressable>
          </Link>
        </SafeAreaView>

        {/* Zaman Filtresi Seçeneklerini Gösteren Modal */}
        <Modal
            transparent={true}
            visible={isDateModalVisible}
            animationType="fade"
            onRequestClose={() => setDateModalVisible(false)} // Android'de geri tuşuna basıldığında modal'ı kapatır.
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#fff' }]}>
              <ThemedText type="subtitle" style={{ marginBottom: 20 }}>Select Time Range</ThemedText>
              {dateFilters.map((filter) => (
                  <AnimatedPressable
                      key={filter.key}
                      style={styles.modalOption}
                      onPress={() => {
                        setSelectedDateFilter(filter.key);
                        setDateModalVisible(false);
                      }}
                  >
                    <ThemedText
                        style={[
                          styles.modalOptionText,
                          selectedDateFilter === filter.key && styles.modalOptionTextActive
                        ]}
                    >
                      {filter.label}
                    </ThemedText>
                  </AnimatedPressable>
              ))}
            </View>
          </View>
        </Modal>
      </View>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
  },
  topDecorationBar: {
    top:-5,  
    height: 5,
    backgroundColor: '#48484a', // Koyu gri, ince bir çizgi
    marginHorizontal: 120, // Ortalamak için sağdan ve soldan boşluk
    marginTop: 8,
    borderRadius: 2.5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12, // Üstteki bar ile arasındaki boşluğu ayarlıyoruz
    marginBottom: 16,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
  },
  summaryBox: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8e8e93',
  },
  summaryAmountIncome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34c759', // green
    marginTop: 4,
  },
  summaryAmountExpense: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff3b30', // red
    marginTop: 4,
  },
  summaryAmountBalance: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  dropdownContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  dropdownButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 15,
  },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#48484a',
  },
  modalOptionText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalOptionTextActive: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  currencySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  currencyButton: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    backgroundColor: '#2c2c2e',
    borderRadius: 15,
  },
  currencyButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  currencyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  currencyButtonTextActive: {
    color: '#fff',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#2c2c2e',
    borderRadius: 20,
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#2c2c2e', // Koyu tema için liste elemanı rengi
    borderRadius: 10,
    overflow: 'hidden', // Kenar yuvarlaklığının iç elemanları da etkilemesini sağlar.
  },
  dateContainer: {
    backgroundColor: '#3a3a3c',
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#c7c7cc',
    textAlign: 'center',
    fontWeight: '600',
  },
  transactionDetails: { // Açıklama ve miktar için yeni konteyner
    flex: 1, // Mevcut alanın tamamını kapla
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionCategory: {
    fontSize: 14,
    color: '#8e8e93', // Kategori için daha soluk bir renk
    marginTop: 4,
  },
  assetInfoContainer: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#48484a',
    borderRadius: 6,
    alignSelf: 'flex-start', // Konteynerin metin kadar yer kaplamasını sağlar.
  },
  assetInfoText: {
    fontSize: 11,
    color: '#f2f2f7',
    fontWeight: '500',
  },
  incomeText: {
    fontSize: 16,
    color: '#34c759',
    fontWeight: '600',
  },
  expenseText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 16, // Butonun tıklama alanını genişletir
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    // Floating Action Button
    position: 'absolute',
    bottom: 90,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});