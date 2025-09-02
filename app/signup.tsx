import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import {
    EmailAuthProvider,
    linkWithCredential,
    createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Colors } from '@/constants/Colors';

const getStyles = () => StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 16, textAlign: 'center', color: '#8e8e93', marginBottom: 40 },
    input: { backgroundColor: Colors.surface, color: Colors.text, padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
    button: { backgroundColor: Colors.tint, padding: 18, borderRadius: 10, alignItems: 'center' },
    buttonText: { color: Colors.background, fontSize: 18, fontWeight: 'bold' },
});

export default function SignUpScreen() {
    const router = useRouter();
    const styles = getStyles();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Missing Information',
                text2: 'Please fill in all fields.',
            });
            return;
        }
        if (password !== confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Password Mismatch',
                text2: 'The passwords you entered do not match.',
            });
            return;
        }

        setLoading(true);
        try {
            const currentUser = auth.currentUser;

            if (currentUser && currentUser.isAnonymous) {
                const credential = EmailAuthProvider.credential(email, password);
                await linkWithCredential(currentUser, credential);

                await setDoc(doc(db, 'users', currentUser.uid), {
                    email: email,
                    createdAt: Timestamp.now(),
                }, { merge: true });

                Toast.show({
                    type: 'success',
                    text1: 'Account Upgraded!',
                    text2: 'Your data is now saved to your new account.'
                });
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;

                await setDoc(doc(db, 'users', newUser.uid), {
                    email: newUser.email,
                    createdAt: Timestamp.now(),
                });
                Toast.show({
                    type: 'success',
                    text1: 'Welcome!',
                    text2: 'Your account has been created successfully.'
                });
            }

            if (router.canGoBack()) {
                router.back();
            }

        } catch (error: any) {
            let errorMessage = 'An unexpected error occurred. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email address is already in use by another account.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'The password must be at least 6 characters long.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            Toast.show({
                type: 'error',
                text1: 'Sign Up Failed',
                text2: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
                <ThemedText style={styles.subtitle}>Save your data and access it anywhere.</ThemedText>
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#8e8e93"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholderTextColor="#8e8e93"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholderTextColor="#8e8e93"
                />
                <AnimatedPressable style={styles.button} onPress={handleSignUp} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={Colors.background} />
                    ) : (
                        <ThemedText style={styles.buttonText}>Sign Up and Save Data</ThemedText>
                    )}
                </AnimatedPressable>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}