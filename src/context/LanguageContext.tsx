import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, LanguageKey } from '../translations';
import { useAuth } from './AuthContext';

export type LanguageType = 'en' | 'hi';

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (key: LanguageKey | string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => typeof key === 'string' ? key : String(key),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>('en');

  useEffect(() => {
    const loadLang = async () => {
      try {
        const stored = await AsyncStorage.getItem('@language_preference');
        if (stored === 'en' || stored === 'hi') {
          setLanguageState(stored as LanguageType);
        }
      } catch (e) {
        console.error('Failed to load language preference', e);
      }
    };
    loadLang();
  }, []);

  const { user } = useAuth();
  
  useEffect(() => {
    if (user?.language && (user.language === 'en' || user.language === 'hi')) {
      setLanguageState(user.language as LanguageType);
      AsyncStorage.setItem('@language_preference', user.language);
    }
  }, [user?.language]);

  const setLanguage = async (lang: LanguageType) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem('@language_preference', lang);
    } catch (e) {
      console.error('Failed to save language preference', e);
    }
  };

  const t = (key: LanguageKey | string): string => {
    const langDict = translations[language] as Record<string, string>;
    const defaultDict = translations.en as Record<string, string>;
    
    if (langDict[key]) return langDict[key];
    if (defaultDict[key]) return defaultDict[key];
    return key as string; // Fallback to raw key
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
