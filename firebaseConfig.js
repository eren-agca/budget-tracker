// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/firebaseConfig.js

// Bu dosya, Firebase projemizin yapılandırma bilgilerini tutar ve
// uygulamamızın Firebase servislerine bağlanmasını sağlar.

// Firebase kütüphanesinden gerekli fonksiyonları import ediyoruz.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Firebase projesinden alınan yapılandırma bilgileri.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebase uygulamasını yapılandırma bilgileriyle başlatıyoruz.
const app = initializeApp(firebaseConfig);

// Auth'u AsyncStorage ile kalıcı olacak şekilde başlatıyoruz.
// Bu, kullanıcı oturumunun uygulama kapatılıp açıldığında kaybolmamasını sağlar.
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Google Analytics'i sadece desteklenen ortamlarda (tarayıcı gibi) başlatıyoruz.
isSupported().then(isAnalyticsSupported => {
  if (isAnalyticsSupported) {
    getAnalytics(app);
  }
});

// Firestore ve Auth servislerini diğer dosyalarda kullanmak üzere export ediyoruz.
export const db = getFirestore(app);
export { auth };