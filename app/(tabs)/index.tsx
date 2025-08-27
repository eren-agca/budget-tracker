import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

// Kendi oluşturduğumuz tema bileşenlerini import ediyoruz.
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
// Firebase veritabanı bağlantımızı import ediyoruz.
// `@/` sembolü projenin kök dizinini temsil eder, bu ayar `tsconfig.json` dosyasında yapılmıştır.
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';

// Veritabanından gelen işlem verileri için bir arayüz (interface) tanımlıyoruz.
// Bu, kodumuzda type safety (tip güvenliği) sağlar.
interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  date: any; // Firestore Timestamp
}

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  // İşlemleri (transactions) saklamak için bir state oluşturuyoruz.
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Bu useMemo hook'u, transactions dizisi her değiştiğinde özet değerleri hesaplar.
  // Bu sayede her render'da yeniden hesaplama yapılmaz, performansı artırır.
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return transactions.reduce(
      (acc, curr) => {
        if (curr.type === 'income') {
          acc.totalIncome += curr.amount;
        } else {
          acc.totalExpense += curr.amount;
        }
        acc.balance = acc.totalIncome + acc.totalExpense;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [transactions]);

  // Bu useEffect hook'u, bileşen ekrana ilk yüklendiğinde çalışır.
  // Firestore'daki 'transactions' koleksiyonunu dinlemeye başlar.
  useEffect(() => {
    // 'transactions' koleksiyonuna bir referans oluşturuyoruz.
    // Verileri 'date' alanına göre azalan sırada (en yeni en üstte) getirmek için bir sorgu (query) oluşturuyoruz.
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));

    // onSnapshot, koleksiyonda herhangi bir değişiklik olduğunda (ekleme, silme, güncelleme)
    // otomatik olarak yeniden çalışır ve bize güncel veriyi sağlar. Bu sayede uygulama her zaman güncel kalır.
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        // Her bir dokümandan gelen veriyi ve dokümanın ID'sini bir objeye koyup diziye ekliyoruz.
        transactionsData.push({ ...doc.data(), id: doc.id } as Transaction);
      });
      // Topladığımız verileri state'e aktarıyoruz.
      setTransactions(transactionsData);
    });

    // Bu cleanup fonksiyonu, bileşen ekrandan kaldırıldığında çalışır.
    // Firestore dinleyicisini kapatarak gereksiz kaynak kullanımını ve hafıza sızıntılarını önler.
    return () => unsubscribe();
  }, []); // Boş dependency array [], bu useEffect'in sadece bir kez çalışmasını sağlar.

  return (
    // SafeAreaView, içeriğin telefonun status bar'ı gibi alanlarının arkasında kalmasını engeller.
    // Arka plan rengini de temanın rengine göre ayarlıyoruz.
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      {/* Toplam Gelir, Gider ve Bakiye'yi gösteren özet barı */}
      <View style={styles.topDecorationBar} />
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <ThemedText style={styles.summaryLabel}>Income</ThemedText>
          <ThemedText style={styles.summaryAmountIncome}>${totalIncome.toFixed(2)}</ThemedText>
        </View>
        <View style={styles.summaryBox}>
          <ThemedText style={styles.summaryLabel}>Expenses</ThemedText>
          <ThemedText style={styles.summaryAmountExpense}>
            ${Math.abs(totalExpense).toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.summaryBox}>
          <ThemedText style={styles.summaryLabel}>Balance</ThemedText>
          <ThemedText style={[styles.summaryAmountBalance, { color: balance >= 0 ? '#34c759' : '#ff3b30' }]}>
            ${balance.toFixed(2)}
          </ThemedText>
        </View>
      </View>

      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Recent Transactions</ThemedText>
      </ThemedView>

      {/* Gelir-Gider listesini göstermek için FlatList kullanıyoruz. */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.transactionItem}>
            <View>
              <ThemedText style={styles.transactionDescription}>{item.description}</ThemedText>
              <ThemedText style={styles.transactionCategory}>{item.category}</ThemedText>
            </View>
            <ThemedText style={item.amount > 0 ? styles.incomeText : styles.expenseText}>
              ${item.amount.toFixed(2)}
            </ThemedText>
          </View>
        )}
        // Eğer hiç işlem yoksa bu mesajı göster.
        ListEmptyComponent={
          <ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No transactions yet.</ThemedText>
        }
      />

      {/* Yeni işlem ekleme butonu. Expo Router'ın Link bileşenini kullanıyoruz. */}
      {/* Bu Link, bizi 'app/add-transaction.tsx' dosyasına yönlendirecek. */}
      <Link href="/add-transaction" asChild>
        <Pressable style={styles.fab}>
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}

const styles= StyleSheet.create({
  container: {
    flex: 1,
  },
  topDecorationBar: {
    height: 5,
    backgroundColor: '#48484a', // Koyu gri, ince bir çizgi
    marginHorizontal: 120, // Ortalamak için sağdan ve soldan boşluk
    marginTop: 8,
    borderRadius: 2.5,
  },
  summaryContainer: {
    
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
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
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#2c2c2e', // Koyu tema için liste elemanı rengi
    borderRadius: 10,
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
  fab: {
    // Floating Action Button
    position: 'absolute',
    bottom: 30,
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
