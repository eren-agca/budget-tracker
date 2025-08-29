// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/app/_layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/firebaseConfig'; // getAuth yerine doğrudan auth'u import ediyoruz.
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
  const { setUser } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Kullanıcının oturum durumundaki değişiklikleri dinle.
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      if (authenticatedUser) {
        // Eğer bir kullanıcı varsa, global state'i güncelle.
        setUser(authenticatedUser);
      } else {
        // Eğer kullanıcı yoksa (ilk açılış veya çıkış yapılmışsa), anonim olarak oturum aç.
        signInAnonymously(auth);
      }
    });

    if (loaded) {
      SplashScreen.hideAsync();
    }

    return () => unsubscribe(); // Clean up subscription
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal', title: 'New Transaction' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
  );
}