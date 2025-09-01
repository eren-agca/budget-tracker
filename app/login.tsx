// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/login.tsx

import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import {
    signInWithEmailAndPassword,
    signInAnonymously,
} from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { Link } from 'expo-router';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const { user } = useAuth(); // Mevcut kullanıcı durumunu alıyoruz.
    const styles = getStyles(colorScheme);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Yönlendirme, ana layout tarafından otomatik olarak yapılacak.
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnonymousSignIn = async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
            // Yönlendirme, ana layout tarafından otomatik olarak yapılacak.
        } catch (error: any) {
            Alert.alert('Anonymous Sign-In Failed', error.message);
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
                <ThemedText type="title" style={styles.title}>Welcome Back</ThemedText>
                <ThemedText style={styles.subtitle}>Log in to access your budget.</ThemedText>

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
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholderTextColor="#8e8e93"
                />
                <AnimatedPressable style={styles.button} onPress={handleLogin} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.buttonText}>Login</ThemedText>
                    )}
                </AnimatedPressable>

                <View style={styles.footer}>
                    <ThemedText>Don't have an account? </ThemedText>
                    <Link href="/signup" asChild>
                        <Pressable>
                            <ThemedText style={styles.link}>Sign Up</ThemedText>
                        </Pressable>
                    </Link>
                </View>

                {/* Eğer mevcut bir kullanıcı yoksa (yani uygulama ilk kez açılıyorsa), anonim giriş seçeneğini göster. */}
                {!user && (
                    <>
                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <ThemedText style={styles.dividerText}>OR</ThemedText>
                            <View style={styles.divider} />
                        </View>

                        <AnimatedPressable style={[styles.button, styles.anonymousButton]} onPress={handleAnonymousSignIn} disabled={loading}>
                            <ThemedText style={styles.buttonText}>Continue Anonymously</ThemedText>
                        </AnimatedPressable>
                    </>
                )}

            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
    StyleSheet.create({
        container: { flex: 1 },
        content: { flex: 1, justifyContent: 'center', padding: 20 },
        title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
        subtitle: { fontSize: 16, textAlign: 'center', color: '#8e8e93', marginBottom: 40 },
        input: { backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f0', color: colorScheme === 'dark' ? '#fff' : '#000', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
        button: { backgroundColor: '#0a7ea4', padding: 18, borderRadius: 10, alignItems: 'center' },
        buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
        footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
        link: { color: '#0a7ea4', fontWeight: 'bold' },
        dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
        divider: { flex: 1, height: 1, backgroundColor: '#48484a' },
        dividerText: { marginHorizontal: 10, color: '#8e8e93' },
        anonymousButton: { backgroundColor: '#555' },
    });