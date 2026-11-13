import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, LanguageKey } from '../translations';
import { useAuth } from './AuthContext';

export type LanguageType = 'en' | 'hi';

interface LanguageContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => Promise<void>;
  t: (key: LanguageKey | string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => typeof key === 'string' ? key : String(key),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageType>('en');
  const { user } = useAuth();
  const userLanguageAppliedRef = useRef(false);
  const explicitSelectionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loadLang = async () => {
      try {
        const stored = await AsyncStorage.getItem('@language_preference');
        if (
          !cancelled &&
          !userLanguageAppliedRef.current &&
          !explicitSelectionRef.current &&
          (stored === 'en' || stored === 'hi')
        ) {
          setLanguageState(stored as LanguageType);
        }
      } catch (e) {
        console.error('Failed to load language preference', e);
      }
    };
    loadLang();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user?.language && (user.language === 'en' || user.language === 'hi')) {
      userLanguageAppliedRef.current = true;
      setLanguageState(user.language as LanguageType);
      AsyncStorage.setItem('@language_preference', user.language).catch(() => {});
    }
  }, [user?.language]);

  const setLanguage = async (lang: LanguageType): Promise<void> => {
    try {
      explicitSelectionRef.current = true;
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
