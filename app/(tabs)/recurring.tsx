import React, { useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, FlatList, Alert, TextInput, Pressable, SafeAreaView } from 'react-native';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Currency, currencies, defaultCurrency } from '@/constants/Currencies';
import { Colors } from '@/constants/Colors';

interface RecurringIncome {
    id: string;
    amount: number;
    category: string;
    currency: 'TRY' | 'USD' | 'EUR' | 'RUB';
    dayOfMonth: number;
}

export default function RecurringScreen() {
    const { user } = useAuth();
    const styles = useMemo(() => getStyles(), []);

    const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [dayOfMonth, setDayOfMonth] = useState('');
    const [transactionCurrency, setTransactionCurrency] = useState<Currency>(defaultCurrency);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'recurringIncomes'), (snapshot) => {
            const incomes: RecurringIncome[] = [];
            snapshot.forEach((doc) => {
                incomes.push({ id: doc.id, ...doc.data() } as RecurringIncome);
            });
            setRecurringIncomes(incomes);
        });
        return () => unsubscribe();
    }, [user]);

    const handleAddRecurringIncome = async () => {
        const numericAmount = parseFloat(amount);
        const numericDay = parseInt(dayOfMonth, 10);

        if (!category || isNaN(numericAmount) || isNaN(numericDay) || numericDay < 1 || numericDay > 31) {
            Alert.alert('Error', 'Please fill all fields correctly. Day must be between 1 and 31.');
            return;
        }

        try {
            if (!user) throw new Error("User not authenticated");

            await addDoc(collection(db, 'users', user.uid, 'recurringIncomes'), {
                amount: numericAmount,
                category,
                currency: transactionCurrency.code,
                dayOfMonth: numericDay,
                lastAdded: null,
            });
            setAmount('');
            setCategory('');
            setDayOfMonth('');
            setTransactionCurrency(defaultCurrency);
        } catch (error) {
            console.error("Error adding recurring income: ", error);
            Alert.alert('Error', 'Could not save the recurring income.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            if (!user) throw new Error("User not authenticated");

            await deleteDoc(doc(db, 'users', user.uid, 'recurringIncomes', id));
        } catch (error) {
            console.error("Error deleting recurring income: ", error);
            Alert.alert('Error', 'Could not delete the recurring income.');
        }
    };

    const handleAmountChange = (text: string) => {
        const numericRegex = /^\d*([.,])?\d*$/;
        if (numericRegex.test(text) || text === '') {
            setAmount(text);
        }
    };

    const ListHeader = () => (
        <>
            <View style={styles.topDecorationBar} />
            <ThemedText type="title" style={styles.header}>Add Recurring Income</ThemedText>
            <View style={styles.formContainer}>
                <TextInput
                    placeholder="Source (e.g., Salary)"
                    value={category}
                    onChangeText={setCategory}
                    style={styles.input}
                    placeholderTextColor="#8e8e93"
                />
                <TextInput
                    placeholder="Amount"
                    value={amount}
                    onChangeText={handleAmountChange}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholderTextColor="#8e8e93"
                />
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
                <TextInput
                    placeholder="Day of Month (1-31)"
                    value={dayOfMonth}
                    onChangeText={setDayOfMonth}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor="#8e8e93"
                />
                <AnimatedPressable style={styles.addButton} onPress={handleAddRecurringIncome}>
                    <ThemedText style={styles.addButtonText}>Add</ThemedText>
                </AnimatedPressable>
            </View>

            <ThemedText type="title" style={styles.header}>Saved Incomes</ThemedText>
        </>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
            <FlatList
                data={recurringIncomes}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={ListHeader}
                renderItem={({ item }) => {
                    const itemCurrency = currencies.find(c => c.code === item.currency) || { symbol: item.currency };
                    return (
                        <View style={styles.listItem}>
                            <View>
                                <ThemedText style={styles.listItemText}>{item.category}</ThemedText>
                                <ThemedText style={styles.listItemSubText}>
                                    {`On day ${item.dayOfMonth} of each month`}
                                </ThemedText>
                            </View>
                            <View style={styles.rightContainer}>
                                <ThemedText style={styles.listItemAmount}>
                                    {itemCurrency.symbol}{item.amount}
                                </ThemedText>
                                <AnimatedPressable onPress={() => handleDelete(item.id)}>
                                    <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                                </AnimatedPressable>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No recurring incomes saved.</ThemedText>}
            />
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: { flex: 1 },
    topDecorationBar: {
        top:-5,
        height: 5,
        backgroundColor: '#48484a',
        marginHorizontal: 120,
        marginTop: 25,
        borderRadius: 2.5,
    },
    header: {
        paddingHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
    },
    formContainer: { padding: 16, backgroundColor: Colors.surface, borderRadius: 10, marginBottom: 24, marginHorizontal: 16 },
    input: { backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
    currencyContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, padding: 4, marginBottom: 15 },
    currencyButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    currencyButtonActive: { backgroundColor: Colors.tint },
    currencyButtonText: { fontWeight: 'bold', color: Colors.text },
    currencyButtonTextActive: {
        color: '#fff',
    },
    addButton: { backgroundColor: Colors.success, padding: 15, borderRadius: 10, alignItems: 'center' },
    addButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: Colors.surface, borderRadius: 10, marginBottom: 12, marginHorizontal: 16 },
    listItemText: { fontSize: 16, fontWeight: '600', color: Colors.text },
    listItemSubText: { fontSize: 12, color: '#8e8e93', marginTop: 4 },
    listItemAmount: { fontSize: 16, fontWeight: 'bold', color: Colors.success, marginRight: 16 },
    rightContainer: { flexDirection: 'row', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#8e8e93' },
});