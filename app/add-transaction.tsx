// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/add-transaction.tsx

// Importing necessary libraries and components.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

// Importing our custom theme and Firebase components.
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { expenseCategories } from '@/constants/Categories';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

export default function AddTransactionScreen() {
    // Get the router from Expo Router to navigate back after saving.
    const router = useRouter();
    const { user } = useAuth(); // Mevcut kullanıcıyı alıyoruz.

    // States for the form fields.
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [purchaseRate, setPurchaseRate] = useState('');
    // Kullanıcının bu işlem için seçtiği para birimini tutan state.
    const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);
    // State to hold the transaction type: 'income' or 'expense'. Default is 'expense'.
    const [type, setType] = useState('expense');
    // State to show a loading indicator (spinner) during the save operation.
    const [loading, setLoading] = useState(false);

    // Adjusting colors for styles based on the theme.
    const styles = getStyles();

    // Bu useEffect hook'u, 'type' state'i her değiştiğinde çalışır.
    // İşlem tipi değiştirildiğinde (örn: Gider'den Gelir'e geçildiğinde),
    // eski değerin taşınmasını önlemek için kategoriyi sıfırlıyoruz.
    useEffect(() => {
        setCategory('');
        setPurchaseRate('');
    }, [type]);

    // Save function
    const handleSaveTransaction = async () => {
        // GÜVENLİK KONTROLÜ: İşlemi kaydetmeden önce kullanıcının mevcut olduğundan emin oluyoruz.
        if (!user) {
            Alert.alert('Error', 'User not authenticated. Please try again.');
            return;
        }

        const isExpense = type === 'expense';

        // Validation: description and category for expenses, only category for income.
        const isSavings = isExpense && category === 'Savings';
        const savingsFieldsValid = !isSavings || (purchaseRate);

        if ((isExpense && !description) || !amount || !category || !savingsFieldsValid) {
            Alert.alert('Error', 'Please fill all fields.');
            return;
        }

        // Check if the amount is a valid number. We replace comma with a dot for float parsing.
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount)) {
            Alert.alert('Error', 'Please enter a valid number for the amount.');
            return;
        }

        const numericPurchaseRate = parseFloat(purchaseRate.replace(',', '.'));
        if (isSavings && isNaN(numericPurchaseRate)) {
            Alert.alert('Error', 'Please enter a valid number for the purchase rate.');
            return;
        }

        setLoading(true); // Start the loading animation

        try {
            // Prepare the data object to be saved to Firestore.
            // For savings, the amount is calculated from quantity * rate.
            // For income, the description will be the same as the category.
            // If it's an expense, make the amount negative.
            const totalCost = isSavings ? numericAmount * numericPurchaseRate : numericAmount;

            const transactionData: any = {
                description: isExpense ? description : category,
                amount: isExpense ? -Math.abs(totalCost) : Math.abs(totalCost),
                category,
                currency: transactionCurrency.code, // İşlemin para birimini de kaydediyoruz.
                type,
                date: Timestamp.now(), // Add the current time as the transaction date.
            };

            // Eğer bu bir "Savings" işlemiyse, yatırım bilgilerini de ekle.
            if (isSavings) {
                transactionData.purchaseRate = numericPurchaseRate;
                transactionData.assetQuantity = numericAmount; // Miktar (quantity) olarak kaydediyoruz.
            }

            // Add a new document to the 'transactions' collection.
            await addDoc(collection(db, 'users', user.uid, 'transactions'), transactionData);

            // If successful, inform the user and go back to the main screen (by closing the modal).
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Transaction saved successfully.'
            });
            router.back();
        } catch (error) {
            // If an error occurs, log it to the console and inform the user.
            console.error('Error adding document: ', error);
            Alert.alert('Error', 'An error occurred while saving the transaction.');
        } finally {
            setLoading(false); // Stop the loading animation
        }
    };

    // Amount alanına sadece sayısal değerlerin girilmesini sağlayan fonksiyon.
    const handleAmountChange = (text: string) => {
        // Bu regex, sadece rakamlara ve bir adet ondalık ayırıcıya (nokta veya virgül) izin verir.
        const numericRegex = /^\d*([.,])?\d*$/;
        // Eğer girilen metin bu kurala uyuyorsa veya boş ise, state'i güncelle.
        // Bu, kullanıcının harf veya özel karakter girmesini engeller.
        if (numericRegex.test(text) || text === '') {
            setAmount(text);
        }
    };

    // Purchase Rate alanına sadece sayısal değerlerin girilmesini sağlayan fonksiyon.
    const handleRateChange = (text: string) => {
        const numericRegex = /^\d*([.,])?\d*$/;
        if (numericRegex.test(text) || text === '') {
            setPurchaseRate(text);
        }
    };

    // Güvenli renk erişimi için yardımcı fonksiyon
    const getTextColor = (isActive: boolean = false) => {
        if (isActive) {
            return Colors.background; // Aktif butonun arka planı neon olacağı için, ikonun rengi kontrast yaratmalı.
        }
        return Colors.text; // Aktif değilse, standart metin rengi.
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Buttons for selecting Income/Expense */}
                <ThemedView style={styles.typeSelector}>
                    <Pressable
                        style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
                        onPress={() => setType('expense')}>
                        <ThemedText style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
                            Expense
                        </ThemedText>
                    </Pressable>
                    <Pressable
                        style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
                        onPress={() => setType('income')}>
                        <ThemedText style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
                            Income
                        </ThemedText>
                    </Pressable>
                </ThemedView>

                {/* İşlem Para Birimi Seçici */}
                <View style={{ marginBottom: 15 }}>
                    <ThemedText style={styles.label}>Currency</ThemedText>
                    <View style={styles.currencyContainer}>
                        {currencies.map((c) => (
                            <Pressable
                                key={c.code}
                                onPress={() => setTransactionCurrency(c)}
                                style={[styles.currencyButton, transactionCurrency.code === c.code && styles.currencyButtonActive]}>
                                <ThemedText style={[styles.currencyButtonText, transactionCurrency.code === c.code && styles.currencyButtonTextActive]}>{c.code}</ThemedText>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Form input fields */}
                {/* Only show description field if type is 'expense' */}
                {type === 'expense' && (
                    <TextInput
                        placeholder={category === 'Savings' ? "Asset Name (e.g., Gold, Silver)" : "Description (e.g., Groceries)"}
                        value={description}
                        onChangeText={setDescription}
                        style={styles.input}
                        placeholderTextColor="#8e8e93"
                    />
                )}
                <TextInput
                    placeholder={category === 'Savings' ? "Quantity (e.g., 2)" : "Amount (e.g., 150.75)"}
                    value={amount}
                    // onChangeText prop'unu artık doğrudan setAmount yerine kontrol fonksiyonumuza bağlıyoruz.
                    onChangeText={handleAmountChange}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholderTextColor="#8e8e93"
                />

                {/* Sadece "Savings" kategorisi seçildiğinde görünecek olan ek alanlar */}
                {type === 'expense' && category === 'Savings' && (
                    <TextInput
                        placeholder={`Purchase Rate (e.g., 1 Gram = 2500 ${transactionCurrency.symbol})`}
                        value={purchaseRate}
                        onChangeText={handleRateChange}
                        style={styles.input}
                        keyboardType="numeric"
                        placeholderTextColor="#8e8e93"
                    />
                )}

                {/* Category selection: Buttons for expense, text input for income. */}
                {type === 'expense' ? (
                    <View style={{ marginBottom: 15 }}>
                        <ThemedText style={styles.label}>Category</ThemedText>
                        {/* Kategorileri sarmalayan ve grid düzeni oluşturan View */}
                        <View style={styles.categoryContainer}>
                            {expenseCategories.map((cat) => {
                                // Uzun metinler için font boyutunu küçültmek amacıyla bir kontrol yapıyoruz.
                                const isLongText = cat.label.length > 10;
                                const isSelected = category === cat.label;

                                return (
                                    <Pressable
                                        key={cat.key}
                                        onPress={() => setCategory(cat.label)}
                                        style={[styles.categoryButton, isSelected && styles.categoryButtonActive]}>
                                        <Ionicons
                                            name={cat.icon}
                                            size={22}
                                            color={getTextColor(isSelected)}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.categoryButtonText,
                                                isLongText && styles.categoryButtonTextSmall, // Eğer metin uzunsa, küçük font stilini uygula
                                                isSelected && styles.categoryButtonTextActive,
                                            ]}
                                            numberOfLines={1}>{cat.label}</ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ) : (
                    <TextInput
                        placeholder="Income Source (e.g., Salary, Freelance)"
                        value={category}
                        onChangeText={setCategory}
                        style={styles.input}
                        placeholderTextColor="#8e8e93"
                    />
                )}

                {/* Save Button */}
                <Pressable style={styles.saveButton} onPress={handleSaveTransaction} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.saveButtonText}>Save</ThemedText>
                    )}
                </Pressable>
            </ScrollView>
        </ThemedView>
    );
}

// Temaya göre (açık/koyu mod) dinamik stil oluşturan fonksiyon
const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContainer: {
        padding: 20,
    },
    typeSelector: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        backgroundColor: Colors.surface,
        borderRadius: 10,
        padding: 4,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: Colors.tint,
    },
    typeButtonText: {
        color: Colors.text,
        fontWeight: '600',
    },
    typeButtonTextActive: {
        color: Colors.background, // Neon yeşil üzerinde koyu renk daha iyi okunur.
    },
    input: {
        backgroundColor: Colors.surface,
        color: Colors.text,
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: Colors.tint,
        padding: 18,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    label: {
        marginBottom: 10,
        fontSize: 16,
        color: Colors.icon,
    },
    currencyContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderRadius: 10,
        padding: 4,
    },
    currencyButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    currencyButtonActive: {
        backgroundColor: Colors.tint,
    },
    currencyButtonText: {
        fontWeight: 'bold',
        color: Colors.text,
    },
    currencyButtonTextActive: {
        color: '#fff',
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    categoryButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12, // Dikey ve yatay padding'i tek seferde ayarlıyoruz
        borderRadius: 10,
        backgroundColor: Colors.surface,
        marginRight: 10, // Butonlar arası yatay boşluk
        marginBottom: 10, // Butonlar arası dikey boşluk
        width: 80, // Genişliği küçültüyoruz
        height: 80, // Yüksekliği küçültüyoruz
    },
    categoryButtonActive: {
        backgroundColor: Colors.tint,
    },
    categoryButtonText: {
        marginTop: 6, // İkon ile metin arasındaki boşluğu azaltıyoruz
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
    },
    categoryButtonTextActive: {
        color: Colors.background, // Neon yeşil üzerinde koyu renk daha iyi okunur.
    },
    categoryButtonTextSmall: {
        fontSize: 10, // Uzun metinler için daha küçük font boyutu
    },
});