// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/add-transaction.tsx

// Importing necessary libraries and components.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

// Importing our custom theme and Firebase components.
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { expenseCategories } from '@/constants/Categories';
import { db } from '@/firebaseConfig';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function AddTransactionScreen() {
    // Get the router from Expo Router to navigate back after saving.
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';

    // States for the form fields.
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    // State to hold the transaction type: 'income' or 'expense'. Default is 'expense'.
    const [type, setType] = useState('expense');
    // State to show a loading indicator (spinner) during the save operation.
    const [loading, setLoading] = useState(false);

    // Adjusting colors for styles based on the theme.
    const styles = getStyles(colorScheme);

    // Save function
    const handleSaveTransaction = async () => {
        const isExpense = type === 'expense';

        // Validation: description and category for expenses, only category for income.
        if ((isExpense && !description) || !amount || !category) {
            Alert.alert('Error', 'Please fill all fields.');
            return;
        }

        // Miktarın geçerli bir sayı olup olmadığını kontrol et. Virgülü noktaya çeviriyoruz.
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount)) {
            Alert.alert('Error', 'Please enter a valid number for the amount.');
            return;
        }

        setLoading(true); // Start the loading animation

        try {
            // Firestore'a kaydedilecek veri objesini hazırlıyoruz.
            // For income, the description will be the same as the category.
            // If it's an expense, make the amount negative.
            const transactionData = {
                description: isExpense ? description : category,
                amount: isExpense ? -Math.abs(numericAmount) : Math.abs(numericAmount),
                category,
                type,
                date: Timestamp.now(), // Add the current time as the transaction date.
            };

            // 'transactions' koleksiyonuna yeni bir doküman ekliyoruz.
            await addDoc(collection(db, 'transactions'), transactionData);

            // Başarılı olursa kullanıcıyı bilgilendir ve ana ekrana (modal'ı kapatarak) geri dön.
            Alert.alert('Success', 'Transaction saved successfully.');
            router.back();
        } catch (error) {
            // If an error occurs, log it to the console and inform the user.
            console.error('Error adding document: ', error);
            Alert.alert('Error', 'An error occurred while saving the transaction.');
        } finally {
            setLoading(false); // Stop the loading animation
        }
    };

    return (
        <ThemedView style={styles.container}>
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

            {/* Form input fields */}
            {/* Only show description field if type is 'expense' */}
            {type === 'expense' && (
                <TextInput
                    placeholder="Description (e.g., Groceries)"
                    value={description}
                    onChangeText={setDescription}
                    style={styles.input}
                    placeholderTextColor="#8e8e93"
                />
            )}
            <TextInput
                placeholder="Amount (e.g., 150.75)"
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
                keyboardType="numeric"
                placeholderTextColor="#8e8e93"
            />

            {/* Category selection: Buttons for expense, text input for income. */}
            {type === 'expense' ? (
                <View style={{ marginBottom: 15 }}>
                    <ThemedText style={styles.label}>Category</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {expenseCategories.map((cat) => (
                            <Pressable
                                key={cat.key}
                                onPress={() => setCategory(cat.label)}
                                style={[styles.categoryButton, category === cat.label && styles.categoryButtonActive]}>
                                <Ionicons name={cat.icon} size={22} color={category === cat.label ? '#fff' : Colors[colorScheme].text} />
                                <ThemedText
                                  style={[styles.categoryButtonText, category === cat.label && styles.categoryButtonTextActive]}
                                  numberOfLines={1} // Ensures the text fits on one line
                                >{cat.label}</ThemedText>
                            </Pressable>
                        ))}
                    </ScrollView>
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
        </ThemedView>
    );
}

// Temaya göre (açık/koyu mod) dinamik stil oluşturan fonksiyon
const getStyles = (colorScheme: 'light' | 'dark') =>
    StyleSheet.create({
        container: {
            flex: 1,
            padding: 20,
        },
        typeSelector: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginBottom: 20,
            backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f0',
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
            backgroundColor: '#0a7ea4',
        },
        typeButtonText: {
            color: colorScheme === 'dark' ? '#fff' : '#000',
            fontWeight: '600',
        },
        typeButtonTextActive: {
            color: '#fff',
        },
        input: {
            backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f0',
            color: colorScheme === 'dark' ? '#fff' : '#000',
            padding: 15,
            borderRadius: 10,
            marginBottom: 15,
            fontSize: 16,
        },
        saveButton: {
            backgroundColor: '#0a7ea4',
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
            color: colorScheme === 'dark' ? '#aaa' : '#555',
        },
        categoryButton: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12, // Dikey ve yatay padding'i tek seferde ayarlıyoruz
            borderRadius: 10,
            backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f0',
            marginRight: 10,
            width: 80, // Genişliği küçültüyoruz
            height: 80, // Yüksekliği küçültüyoruz
        },
        categoryButtonActive: {
            backgroundColor: '#0a7ea4',
        },
        categoryButtonText: {
            marginTop: 6, // İkon ile metin arasındaki boşluğu azaltıyoruz
            fontSize: 12,
            fontWeight: '600',
            color: colorScheme === 'dark' ? '#fff' : '#000',
        },
        categoryButtonTextActive: {
            color: '#fff',
        },
    });