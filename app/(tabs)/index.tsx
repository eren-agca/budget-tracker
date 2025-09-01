// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/(tabs)/index.tsx

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, getDocs, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, View, ListRenderItem, Pressable } from 'react-native';

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
import { db, auth } from '@/firebaseConfig';
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
        <AnimatedPressable onPress={() => onDelete(item.id)} style={styles.deleteButton}><Ionicons name="trash-outline" size={22} color={Colors.danger} /></AnimatedPressable>
      </View>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  // OPTİMİZASYON: Stillerin her render'da yeniden oluşturulmasını önlemek için useMemo kullanıyoruz.
  const styles = useMemo(() => getStyles(), []);

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
          const rate = rates[curr.currency] || 1;
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

  // Kur oranlarını çekmek ve kayan bant verisini formatlamak için useEffect.
  useEffect(() => {
    const fetchRates = async () => {
      const fetchedRates = await getExchangeRates();
      setRates(fetchedRates);

      if (fetchedRates) {
        const tickerItems = [
          { code: 'USD', name: 'Dolar' },
          { code: 'EUR', name: 'Euro' },
          { code: 'XAU_GRAM', name: 'Altın/Gr' },
          { code: 'XAG_GRAM', name: 'Gümüş/Gr' },
          { code: 'RUB', name: 'Ruble' },
          { code: 'BTC', name: 'Bitcoin' },
          { code: 'ETH', name: 'Ethereum' },
          { code: 'XRP', name: 'XRP' },
        ];

        const formattedTickerData = tickerItems
            .filter(item => fetchedRates[item.code]) // Sadece kuru mevcut olanları göster
            .map(item => {
              const rate = fetchedRates[item.code];
              const formattedRate = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate);
              return `${item.name}: ${formattedRate} ₺`;
            });
        setTickerData(formattedTickerData);
      }
    };

    fetchRates();
    const intervalId = setInterval(fetchRates, 60000);
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Yönlendirme, ana layout (_layout.tsx) tarafından otomatik olarak yapılacak.
    } catch (error) {
      console.error('Error logging out: ', error);
      Alert.alert('Error', 'Could not log out. Please try again.');
    }
  };

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
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.background, paddingTop: 10 }]}>
          <View style={styles.topDecorationBar} />
          {/* Canlı Kur Bilgilerini Gösteren Kayan Bant - Arka planı Ticker.tsx içinde ayarlandı */}
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
                    {displayCurrency.symbol}
                    {(totalIncome / (rates[displayCurrency.code] || 1)).toFixed(2)}
                  </ThemedText>
              )}
            </View>
            <View style={styles.summaryBox}>
              <ThemedText style={styles.summaryLabel}>Expenses</ThemedText>
              {rates && (
                  <ThemedText style={styles.summaryAmountExpense}>
                    {displayCurrency.symbol}
                    {Math.abs(totalExpense / (rates[displayCurrency.code] || 1)).toFixed(2)}
                  </ThemedText>
              )}
            </View>
            <View style={styles.summaryBox}>
              <ThemedText style={styles.summaryLabel}>Balance</ThemedText>
              {rates && (
                  <ThemedText style={[styles.summaryAmountBalance, { color: balance >= 0 ? Colors.success : Colors.danger }]}>
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
              <Ionicons name="chevron-down" size={20} color={Colors.text} />
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

          <View style={styles.titleContainer}>
            <ThemedText type="title" style={styles.sectionTitle}>Recent Transactions</ThemedText>
          </View>

          {/* Gelir-Gider listesini göstermek için FlatList kullanıyoruz. */}
          <FlatList
              data={filteredTransactions}
              keyExtractor={keyExtractor}
              renderItem={renderTransaction}
              windowSize={10} // Performans için ek ayarlar
              initialNumToRender={10}
              ListEmptyComponent={
                <ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No transactions yet.</ThemedText>
              }
          />

          {/* Yeni işlem ekleme butonu. */}
          <AnimatedPressable style={styles.fab} onPress={() => router.push('/add-transaction')}>
            <Ionicons name="add" size={32} color="white" />
          </AnimatedPressable>

          {/* DÜZELTME: Giriş/Çıkış butonunu ekranın sol üst köşesine taşıyoruz. */}
          <View style={styles.authButtonContainer}>
            {user && (
                user.isAnonymous ? (
                  <AnimatedPressable onPress={() => router.push('/login')} style={styles.authButtonGreen} hitSlop={10}>
                    <Ionicons name="log-in-outline" size={24} color="#fff" />
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable onPress={handleLogout} style={styles.authButtonRed} hitSlop={10}>
                    <Ionicons name="log-out-outline" size={24} color="#fff" />
                  </AnimatedPressable>
                )
            )}
          </View>
        </SafeAreaView>

        {/* Zaman Filtresi Seçeneklerini Gösteren Modal */}
        <Modal
            transparent={true}
            visible={isDateModalVisible}
            animationType="fade"
            onRequestClose={() => setDateModalVisible(false)} // Android'de geri tuşuna basıldığında modal'ı kapatır.
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
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
                          selectedDateFilter === filter.key && styles.modalOptionTextActive,
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

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
  },
  topDecorationBar: {
    top:-5,
    height: 5,
    backgroundColor: '#48484a', // Koyu gri, ince bir çizgi
    marginHorizontal: 120, // Ortalamak için sağdan ve soldan boşluk
    marginTop: 25,
    borderRadius: 2.5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.surface,
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
    color: Colors.success,
    marginTop: 4,
  },
  summaryAmountExpense: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.danger,
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
    backgroundColor: Colors.surface,
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
    padding: 24,
    borderRadius: 15,
    backgroundColor: Colors.surface,
  },
  modalOption: {
    paddingVertical: 16,
  },
  modalOptionText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalOptionTextActive: {
    color: Colors.tint,
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
    backgroundColor: Colors.surface,
    borderRadius: 15,
  },
  currencyButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.tint,
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
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.tint,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 24, // Varsayılan başlık boyutunu (32) küçülttük.
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateContainer: {
    backgroundColor: Colors.background,
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
  transactionDetails: {
    flex: 1,
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
    color: '#8e8e93',
    marginTop: 4,
  },
  assetInfoContainer: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  assetInfoText: {
    fontSize: 11,
    color: '#f2f2f7',
    fontWeight: '500',
  },
  incomeText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '600',
  },
  expenseText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 25, // Butonu ekranın sağ üst köşesine taşıdık
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 10,
  },
  authButtonGreen: {
    backgroundColor: Colors.success,
    width: 40,
    height: 40,
    borderRadius: 20, // Dairesel yapmak için
    justifyContent: 'center',
    alignItems: 'center',
  },
  authButtonRed: {
    backgroundColor: Colors.danger,
    width: 40,
    height: 40,
    borderRadius: 20, // Dairesel yapmak için
    justifyContent: 'center',
    alignItems: 'center',
  },
  authButtonContainer: {
    position: 'absolute',
    top: 55,
    left: 20,
    zIndex: 10,
  },
});