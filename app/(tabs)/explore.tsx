// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/(tabs)/explore.tsx

// Bu dosya, kullanıcıların harcamalarını ve gelirlerini grafiklerle gördüğü ekranı içerir.

// Gerekli kütüphaneleri ve bileşenleri import ediyoruz.
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Kendi oluşturduğumuz tema ve bileşenlerini import ediyoruz.
import { ExchangeRates, getExchangeRates } from '@/services/currencyService';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { analyzeTransactionsWithGemini } from '@/services/geminiService';

// Veritabanından gelen işlem verileri için arayüz (interface).
interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
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

export default function ExploreScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme);
  // Veritabanından gelen işlemleri ve yüklenme durumunu tutan state'ler.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  // Bu sayfanın gösterim para birimi için yerel bir state.
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null); // Kur oranlarını tutacak state.
  // Gemini analizi için state'ler
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Animasyonun ilerlemesini 0'dan 1'e kadar tutacak olan Reanimated değerleri.
  const pieAnimationProgress = useSharedValue(0);
  const barAnimationProgress = useSharedValue(0);

  // Firestore'dan verileri çekmek için useEffect.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(query(collection(db, 'users', user.uid, 'transactions')), (snapshot) => {
      const transactionsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        transactionsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(transactionsData);
      setLoading(false);
    });
    return () => unsubscribe(); // Clean up the listener
  }, [user]);

  // Kur oranlarını çekmek için useEffect.
  useEffect(() => {
    const fetchRates = async () => {
      const fetchedRates = await getExchangeRates();
      setRates(fetchedRates);
    };
    fetchRates();
  }, []);

  // Veritabanından gelen `transactions` değiştiğinde, pasta grafiğinin nihai verisini hesaplayan useMemo.
  const expenseChartData = useMemo((): PieChartData[] => {
    // Kur oranları veya işlemler yüklenmediyse, boş bir dizi döndür.
    if (!rates || transactions.length === 0) {
      return [];
    }

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
      // Her bir harcamayı, kendi para biriminden ana para birimimiz olan TRY'ye çevirerek topluyoruz.
      // rates[curr.currency] bir birim yabancı paranın kaç TRY olduğunu tutar (örn: rates['USD'] = 32.5)
      const rate = rates[curr.currency] || 1;
      const amountInTRY = Math.abs(curr.amount) * rate;
      acc[category] += amountInTRY;
      return acc;
    }, {} as Record<string, number>);

    // Grafik için renk paleti.
    const colorPalette = ['#60A5FA', '#F87171', '#4ADE80', '#FBBF24', '#A78BFA', '#2DD4BF'];

    // Veriyi react-native-chart-kit'in beklediği formata dönüştür.
    return Object.keys(expenseByCategory).map((category, index) => {
      const totalInCategoryInTRY = expenseByCategory[category];
      // Toplam TRY tutarını, seçili gösterim para birimine çeviriyoruz (bölerek).
      const totalInDisplayCurrency = totalInCategoryInTRY / (rates[displayCurrency.code] || 1);
      return {
        name: `${displayCurrency.symbol}${totalInDisplayCurrency.toFixed(0)} ${category}`,
        population: totalInDisplayCurrency,
        color: colorPalette[index % colorPalette.length], // Renk paletini tekrarla
        legendFontColor: Colors[colorScheme].text,
        legendFontSize: 14,
      };
    });
  }, [transactions, rates, displayCurrency, colorScheme]);

  // Veritabanından gelen `transactions` değiştiğinde, gelir grafiğinin nihai verisini hesaplayan useMemo.
  const incomeChartData = useMemo((): PieChartData[] => {
    // Kur oranları veya işlemler yüklenmediyse, boş bir dizi döndür.
    if (!rates || transactions.length === 0) {
      return [];
    }

    // Sadece gelirleri (income) filtrele.
    const incomes = transactions.filter((t) => t.type === 'income');
    if (incomes.length === 0) {
      return [];
    }

    // Gelirleri kategoriye göre grupla ve toplamlarını hesapla.
    const incomeByCategory = incomes.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      // Her bir geliri, kendi para biriminden ana para birimimiz olan TRY'ye çevirerek topluyoruz.
      // rates[curr.currency] bir birim yabancı paranın kaç TRY olduğunu tutar (örn: rates['USD'] = 32.5)
      const rate = rates[curr.currency] || 1;
      const amountInTRY = curr.amount * rate;
      acc[category] += amountInTRY;
      return acc;
    }, {} as Record<string, number>);

    // Gelir grafiği için farklı bir renk paleti.
    const colorPalette = ['#34C759', '#52D769', '#28A745', '#84E198', '#A3E9B3'];

    return Object.keys(incomeByCategory).map((category, index) => {
      const totalInCategoryInTRY = incomeByCategory[category];
      // Toplam TRY tutarını, seçili gösterim para birimine çeviriyoruz (bölerek).
      const totalInDisplayCurrency = totalInCategoryInTRY / (rates[displayCurrency.code] || 1);
      return {
        name: `${displayCurrency.symbol}${totalInDisplayCurrency.toFixed(0)} ${category}`,
        population: totalInDisplayCurrency,
        color: colorPalette[index % colorPalette.length],
        legendFontColor: Colors[colorScheme].text,
        legendFontSize: 14,
      };
    });
  }, [transactions, rates, displayCurrency, colorScheme]);

  // Yüklenme durumu bittiğinde ve veri mevcut olduğunda animasyonları tetikliyoruz.
  useEffect(() => {
    if (!loading) {
      pieAnimationProgress.value = withTiming(expenseChartData.length > 0 ? 1 : 0, { duration: 600 });
      barAnimationProgress.value = withTiming(incomeChartData.length > 0 ? 1 : 0, { duration: 600 });
    }
  }, [loading, expenseChartData, incomeChartData]);

  // Pasta grafiği için animasyonlu stil.
  const animatedPieStyle = useAnimatedStyle(() => ({
    opacity: pieAnimationProgress.value,
    transform: [{ scale: pieAnimationProgress.value }],
  }));

  // Gelir grafiği için animasyonlu stil.
  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: barAnimationProgress.value,
    transform: [{ scale: barAnimationProgress.value }],
  }));

  // Grafik için yapılandırma ayarları.
  const chartConfig = {
    backgroundGradientFrom: Colors[colorScheme].background,
    backgroundGradientTo: Colors[colorScheme].background,
    // Dilimlerin üzerindeki tüm etiketleri gizlemek için rengi şeffaf yapıyoruz.
    color: (opacity = 1) => `rgba(255, 255, 255, 0)`,
  };

  // Gemini analizini başlatan fonksiyon.
  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    const result = await analyzeTransactionsWithGemini(transactions);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  // Yükleme sırasında gösterilecek placeholder bileşeni.
  const ChartPlaceholder = () => (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme].text} />
      </View>
  );

  return (
      // Sayfayı tekrar kaydırılabilir yaparak grafiklere daha fazla alan tanıyoruz.
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <ScrollView>
          {/* Ana sayfadakiyle aynı, estetik amaçlı çubuk. */}
          <View style={styles.topDecorationBar} />

          {/* Para Birimi Seçici */}
          <View style={styles.titleContainer}>
            <ThemedText type="subtitle">Display Currency</ThemedText>
          </View>
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
                    width={Dimensions.get('window').width}
                    height={220} // Grafik yüksekliğini artırıyoruz
                    chartConfig={chartConfig}
                    accessor={'population'}
                    backgroundColor={'transparent'}
                    paddingLeft={'15'}
                    center={[10, 0]}
                    hasLegend={false} // Varsayılan legend'ı gizliyoruz.
                />
              </Animated.View>
          ) : (
              <View style={styles.emptyContainer}>
                <ThemedText>No expense data to display a chart.</ThemedText>
              </View>
          )}

          {/* Kendi oluşturduğumuz, metinleri saran özel legend */}
          {expenseChartData.length > 0 && (
              <View style={styles.legendContainer}>
                {expenseChartData.map((item) => (
                    <View key={`expense-${item.name}`} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                      <ThemedText style={styles.legendText} numberOfLines={2}>{item.name}</ThemedText>
                    </View>
                ))}
              </View>
          )}

          {/* Gelir Grafiği Bölümü */}
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Income Breakdown</ThemedText>
          </ThemedView>

          {loading ? ( // Yüklenirken placeholder göster.
              <ChartPlaceholder />
          ) : incomeChartData.length > 0 ? ( // Veri varsa, animasyonlu grafiği göster.
              <Animated.View style={animatedBarStyle}>
                <PieChart
                    data={incomeChartData}
                    width={Dimensions.get('window').width}
                    height={220} // Grafik yüksekliğini artırıyoruz
                    chartConfig={chartConfig}
                    accessor={'population'}
                    backgroundColor={'transparent'}
                    paddingLeft={'15'}
                    center={[10, 0]}
                    hasLegend={false} // Varsayılan legend'ı gizliyoruz.
                />
              </Animated.View>
          ) : ( // Veri yoksa, boş mesajı göster.
              <View style={styles.emptyContainer}>
                <ThemedText>No income data to display a chart.</ThemedText>
              </View>
          )}

          {/* Kendi oluşturduğumuz, metinleri saran özel legend */}
          {incomeChartData.length > 0 && (
              <View style={styles.legendContainer}>
                {incomeChartData.map((item) => (
                    <View key={`income-${item.name}`} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                      <ThemedText style={styles.legendText} numberOfLines={2}>{item.name}</ThemedText>
                    </View>
                ))}
              </View>
          )}

          {/* Gemini Analiz Bölümü */}
          <View style={styles.analysisContainer}>
            <AnimatedPressable style={styles.analysisButton} onPress={handleAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <ThemedText style={styles.analysisButtonText}>Analyze My Spending</ThemedText>
              )}
            </AnimatedPressable>

            {analysis && (
                <View style={styles.analysisResultBox}>
                  <ThemedText>{analysis}</ThemedText>
                </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8, // Dikey padding'i azaltıyoruz
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  currencySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4, // Dikey padding'i azaltıyoruz
    paddingHorizontal: 16,
    gap: 12,
  },
    topDecorationBar: {
        top:-5,
        height: 5,
        backgroundColor: '#48484a', // Koyu gri, ince bir çizgi
        marginHorizontal: 120, // Ortalamak için sağdan ve soldan boşluk
        marginTop: 8,
        borderRadius: 2.5,
    },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Bu, elemanların alt satıra geçmesini sağlar.
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 12, // Üst boşluğu artırıyoruz
    marginBottom: 24, // Alt boşluğu artırıyoruz
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%', // Her bir elemanın genişliği %50 olacak (iki sütun).
    marginBottom: 8, // Elemanlar arası dikey boşluğu artırıyoruz
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12, // Font boyutunu tekrar büyütüyoruz
    flexShrink: 1, // Metnin, verilen alana sığmak için küçülmesine izin verir.
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
    color: '#fff', // Aktif durumdaki metin rengi aynı kalabilir, stilin var olması hatayı çözer.
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    minHeight: 220, // Grafik yüksekliğine uyacak şekilde artırıyoruz
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  analysisContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 48,
  },
  analysisButton: {
    backgroundColor: '#5856d6', // Mor bir renk
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  analysisButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analysisResultBox: {
    color:'black',  
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors[colorScheme].tint,
    borderRadius: 10,
  },
});