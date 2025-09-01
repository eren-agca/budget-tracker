// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/_layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; // getAuth yerine doğrudan auth'u import ediyoruz.
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// 1. AuthProvider'ı en dış sarmalayıcı olarak kullanıyoruz.
export default function RootLayout() {
  return (
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
  );
}

// 2. Ana navigasyon ve kimlik doğrulama mantığını ayrı bir bileşene taşıyoruz.
// Bu bileşen artık AuthProvider'ın içinde olduğu için useAuth() kancasını güvenle kullanabilir.
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, setUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [authLoaded, setAuthLoaded] = useState(false);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Kullanıcının oturum durumundaki değişiklikleri dinle.
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthLoaded(true);
    });

    return () => unsubscribe(); // Clean up subscription
  }, []);

  useEffect(() => {
    if (!authLoaded || !loaded) return;

    const isAuthRoute = segments[0] === 'login' || segments[0] === 'signup';

    // Eğer kullanıcı e-posta ile giriş yapmışsa ve bir auth rotasındaysa, ana sayfaya yönlendir.
    // Bu, anonim kullanıcının kayıt sayfasına erişmesine izin verir.
    if (user && !user.isAnonymous && isAuthRoute) {
      router.replace('/(tabs)');
    }
    // Eğer kullanıcı yoksa ve giriş/kayıt ekranında değilse, giriş ekranına yönlendir.
    else if (!user && !isAuthRoute && segments[0] !== undefined) { // `undefined` check to prevent redirect on initial load
      router.replace('/login');
    }
    SplashScreen.hideAsync();
  }, [user, segments, authLoaded, loaded]);

  if (!authLoaded || !loaded) {
    return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }} />;
  }

  return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ presentation: 'modal', title: 'Create Account' }} />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal', title: 'New Transaction' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        {/* Toast bildirimlerinin tüm uygulamanın üzerinde görünmesini sağlar. */}
        <Toast />
      </ThemeProvider>
  );
}