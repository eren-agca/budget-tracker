// Gerekli kütüphaneleri ve bileşenleri import ediyoruz.
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Kendi oluşturduğumuz tema ve Firebase bileşenlerini import ediyoruz.
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';

// Veritabanından gelen işlem verileri için arayüz (interface).
// Bu arayüzü ana ekranda da kullanmıştık, normalde ortak bir dosyada tutulur.
interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  date: any;
}

// Pasta grafiği verisi için bir arayüz.
interface PieChartData {
  name: string;
  population: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

// Çubuk grafiği verisi için bir arayüz.
interface BarChartData {
  labels: string[];
  datasets: {
    data: number[];
  }[];
}

export default function ExploreScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  // Veritabanından gelen işlemleri ve yüklenme durumunu tutan state'ler.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Animasyonun ilerlemesini 0'dan 1'e kadar tutacak olan Reanimated değerleri.
  // Bu değerler UI thread'de çalışır ve akıcı animasyonlar sağlar.
  const pieAnimationProgress = useSharedValue(0);
  const barAnimationProgress = useSharedValue(0);

  // Firestore'dan verileri çekmek için useEffect.
  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        transactionsData.push({ ...doc.data(), id: doc.id } as Transaction);
      });
      setTransactions(transactionsData);
      // İlk veri seti geldikten sonra yüklenme durumunu false yapıyoruz.
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Veritabanından gelen `transactions` değiştiğinde, pasta grafiğinin nihai verisini hesaplayan useMemo.
  const expenseChartData = useMemo((): PieChartData[] => {
    // Sadece giderleri (expense) filtrele.
    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
      return [];
    }

    // Harcamaları kategoriye göre grupla ve toplamlarını hesapla.
    const expenseByCategory = expenses.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      // Miktarlar negatif olduğu için Math.abs kullanarak pozitif değere çeviriyoruz.
      acc[category] += Math.abs(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    // Grafik için renk paleti.
    const colorPalette = ['#60A5FA', '#F87171', '#4ADE80', '#FBBF24', '#A78BFA', '#2DD4BF'];

    // Veriyi react-native-chart-kit'in beklediği formata dönüştür.
    return Object.keys(expenseByCategory).map((category, index) => ({
      name: category,
      population: expenseByCategory[category],
      color: colorPalette[index % colorPalette.length], // Renk paletini tekrarla
      legendFontColor: Colors[colorScheme].text,
      legendFontSize: 14,
    }));
  }, [transactions, colorScheme]);

  // Veritabanından gelen `transactions` değiştiğinde, çubuk grafiğinin nihai verisini hesaplayan useMemo.
  const incomeChartData = useMemo((): BarChartData => {
    // Sadece gelirleri (income) filtrele.
    const incomes = transactions.filter((t) => t.type === 'income');
    if (incomes.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }

    // Gelirleri kategoriye göre grupla ve toplamlarını hesapla.
    const incomeByCategory = incomes.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(incomeByCategory),
      datasets: [{ data: Object.values(incomeByCategory) }],
    };
  }, [transactions]);

  // Yüklenme durumu bittiğinde ve veri mevcut olduğunda animasyonları tetikliyoruz.
  useEffect(() => {
    if (!loading) {
      pieAnimationProgress.value = withTiming(expenseChartData.length > 0 ? 1 : 0, { duration: 600 });
      barAnimationProgress.value = withTiming(incomeChartData.labels.length > 0 ? 1 : 0, { duration: 600 });
    }
  }, [loading, expenseChartData, incomeChartData, pieAnimationProgress, barAnimationProgress]);

  // Pasta grafiği için animasyonlu stil.
  // Opaklığı ve ölçeği (büyüklüğü) animasyon değerine göre değiştiriyoruz.
  const animatedPieStyle = useAnimatedStyle(() => ({
    opacity: pieAnimationProgress.value,
    transform: [{ scale: pieAnimationProgress.value }],
  }));

  // Çubuk grafiği için animasyonlu stil.
  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: barAnimationProgress.value,
    transform: [{ scale: barAnimationProgress.value }],
  }));

  // Grafik için yapılandırma ayarları.
  const chartConfig = {
    backgroundGradientFrom: Colors[colorScheme].background,
    backgroundGradientTo: Colors[colorScheme].background,
    color: (opacity = 1) => `rgba(120, 120, 128, ${opacity})`, // legend text color
  };

  // Yükleme sırasında gösterilecek placeholder bileşeni.
  const ChartPlaceholder = () => (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color={Colors[colorScheme].text} />
    </View>
  );

  return (
    // Sayfaya birden fazla grafik sığdırmak için ScrollView kullanıyoruz.
    <ScrollView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Expense Breakdown</ThemedText>
      </ThemedView>

      {/* Eğer gösterilecek harcama verisi varsa grafiği göster, yoksa bir mesaj göster. */}
      {loading ? (
        <ChartPlaceholder />
      ) : expenseChartData.length > 0 ? (
        <Animated.View style={animatedPieStyle}>
          <PieChart
            data={expenseChartData}
            width={Dimensions.get('window').width} // Ekran genişliği
            height={250}
            chartConfig={chartConfig}
            accessor={'population'}
            backgroundColor={'transparent'}
            paddingLeft={'15'}
            center={[10, 0]}
            absolute // Değerleri yüzde yerine mutlak sayı olarak gösterir
          />
        </Animated.View>
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText>No expense data to display a chart.</ThemedText>
        </View>
      )}

      {/* Gelir Grafiği Bölümü */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Income Breakdown</ThemedText>
      </ThemedView>

      {loading ? (
        <ChartPlaceholder />
      ) : incomeChartData.labels.length > 0 ? (
        <Animated.View style={animatedBarStyle}>
          <BarChart
            data={incomeChartData}
            width={Dimensions.get('window').width - 16} // Ekran genişliğinden biraz daha az
            height={250}
            yAxisLabel="$"
            yAxisSuffix="" // Bu satırı ekleyerek hatayı gideriyoruz.
            chartConfig={{
              ...chartConfig,
              backgroundColor: '#2c2c2e',
              backgroundGradientFrom: '#2c2c2e',
              backgroundGradientTo: '#2c2c2e',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(52, 199, 89, ${opacity})`, // Gelir için yeşil renk
              labelColor: (opacity = 1) => Colors[colorScheme].text,
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#34c759',
              },
            }}
            verticalLabelRotation={20}
            style={styles.chartStyle}
          />
        </Animated.View>
      ) : (
        <View style={styles.emptyContainer}>
          <ThemedText>No income data to display a chart.</ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    padding: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    minHeight: 250, // Grafikle aynı yüksekliği kaplaması için
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
});
