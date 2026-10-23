import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
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

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
  );
}

function RootLayoutNav() {
  const { user, setUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [authLoaded, setAuthLoaded] = useState(false);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthLoaded(true);
    });

    return () => unsubscribe(); // Clean up subscription
  }, []);

  useEffect(() => {
    if (!authLoaded || !loaded) return;

    const isAuthRoute = segments[0] === 'login' || segments[0] === 'signup';

    if (user && !user.isAnonymous && isAuthRoute) {
      router.replace('/(tabs)');
    }
    else if (!user && !isAuthRoute && segments[0] !== undefined) {
      router.replace('/login');
    }
    SplashScreen.hideAsync();
  }, [user, segments, authLoaded, loaded]);

  if (!authLoaded || !loaded) {
    return <View style={{ flex: 1, backgroundColor: '#121212' }} />;
  }

  return (
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: '#0E0E10' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="add-transaction" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />        
        <Toast />
      </ThemeProvider>
  );
}