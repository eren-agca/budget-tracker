// C:/Users/sdsof/OneDrive/Desktop/GitHub/budget-tracker/context/AuthContext.tsx

// Bu dosya, mevcut kullanıcının kimlik bilgilerini tüm uygulamada paylaşmak için bir React Context oluşturur.

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';

// Context'in tip tanımı.
interface AuthContextType {
  user: User | null; // Firebase'den gelen kullanıcı objesi
  setUser: (user: User | null) => void;
}

// Context'i oluşturuyoruz.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Uygulamayı sarmalayacak olan Provider bileşeni.
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
};

// Context'i daha kolay kullanmamızı sağlayan özel bir hook.
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};