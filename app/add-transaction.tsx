import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { expenseCategories } from '@/constants/Categories';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

export default function AddTransactionScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [purchaseRate, setPurchaseRate] = useState('');
    const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);
    const [type, setType] = useState('expense');
    const [loading, setLoading] = useState(false);

    const styles = getStyles();

    useEffect(() => {
        setCategory('');
        setPurchaseRate('');
    }, [type]);

    const handleSaveTransaction = async () => {
        if (!user) {
            Alert.alert('Error', 'User not authenticated. Please try again.');
            return;
        }

        const isExpense = type === 'expense';

        const isSavings = isExpense && category === 'Savings';
        const savingsFieldsValid = !isSavings || (purchaseRate);

        if ((isExpense && !description) || !amount || !category || !savingsFieldsValid) {
            Alert.alert('Error', 'Please fill all fields.');
            return;
        }

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

        setLoading(true);

        try {
            const totalCost = isSavings ? numericAmount * numericPurchaseRate : numericAmount;

            const transactionData: any = {
                description: isExpense ? description : category,
                amount: isExpense ? -Math.abs(totalCost) : Math.abs(totalCost),
                category,
                currency: transactionCurrency.code, // İşlemin para birimini de kaydediyoruz.
                type,
                date: Timestamp.now(),
            };

            if (isSavings) {
                transactionData.purchaseRate = numericPurchaseRate;
                transactionData.assetQuantity = numericAmount;
            }

            await addDoc(collection(db, 'users', user.uid, 'transactions'), transactionData);

            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Transaction saved successfully.'
            });
            router.back();
        } catch (error) {
            console.error('Error adding document: ', error);
            Alert.alert('Error', 'An error occurred while saving the transaction.');
        } finally {
            setLoading(false);
        }
    };

    const handleAmountChange = (text: string) => {
        const numericRegex = /^\d*([.,])?\d*$/;
        if (numericRegex.test(text) || text === '') {
            setAmount(text);
        }
    };

    const handleRateChange = (text: string) => {
        const numericRegex = /^\d*([.,])?\d*$/;
        if (numericRegex.test(text) || text === '') {
            setPurchaseRate(text);
        }
    };

    const getTextColor = (isActive: boolean = false) => {
        if (isActive) {
            return Colors.background;
        }
        return Colors.text;
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
                    onChangeText={handleAmountChange}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholderTextColor="#8e8e93"
                />

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

                {type === 'expense' ? (
                    <View style={{ marginBottom: 15 }}>
                        <ThemedText style={styles.label}>Category</ThemedText>
                        <View style={styles.categoryContainer}>
                            {expenseCategories.map((cat) => {
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
                                                isLongText && styles.categoryButtonTextSmall,
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
        color: Colors.background,
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
        padding: 12,
        borderRadius: 10,
        backgroundColor: Colors.surface,
        marginRight: 10,
        marginBottom: 10,
        width: 80,
        height: 80,
    },
    categoryButtonActive: {
        backgroundColor: Colors.tint,
    },
    categoryButtonText: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
    },
    categoryButtonTextActive: {
        color: Colors.background,
    },
    categoryButtonTextSmall: {
        fontSize: 10,
    },
});