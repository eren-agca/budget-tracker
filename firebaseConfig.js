// Bu dosya, Firebase projemizin yapılandırma bilgilerini tutar ve
// uygulamamızın Firebase servislerine bağlanmasını sağlar.

// Firebase kütüphanesinden gerekli fonksiyonları import ediyoruz.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase projesinden alınan yapılandırma bilgileri.
const firebaseConfig = {
  apiKey: "AIzaSyD0fUZTctMJx1Kx7P0_k8cSpyXkJLG-lO8",
  authDomain: "budget-tracker-17146.firebaseapp.com",
  projectId: "budget-tracker-17146",
  storageBucket: "budget-tracker-17146.appspot.com",
  messagingSenderId: "391846407420",
  appId: "1:391846407420:web:97ac3274b697c60cecfb79",
  measurementId: "G-MGZN2697LT"
};

// Firebase uygulamasını yapılandırma bilgileriyle başlatıyoruz.
const app = initializeApp(firebaseConfig);

// Google Analytics'i sadece desteklenen ortamlarda (tarayıcı gibi) başlatıyoruz.
// Bu, React Native ortamında gereksiz uyarıların önüne geçer.
isSupported().then(isAnalyticsSupported => {
  if (isAnalyticsSupported) {
    getAnalytics(app);
  }
});

// Firestore veritabanı servisine erişim sağlamak için bir referans oluşturup export ediyoruz.
export const db = getFirestore(app);