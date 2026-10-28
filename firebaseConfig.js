import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
  console.warn('[Firebase] EXPO_PUBLIC_FIREBASE_API_KEY bulunamadı. Lütfen .env dosyanızı doldurun.');
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSy-placeholder-fill-in-env',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'budget-tracker',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

isSupported().then(isAnalyticsSupported => {
  if (isAnalyticsSupported) {
    getAnalytics(app);
  }
}).catch(() => {
  // Analytics desteklenmeyen ortamlarda sessizce geç
});

export const db = getFirestore(app);
export { auth };
