import { Platform } from 'react-native';

const STORAGE_PREFIX = 'goraahi_draft_';

/**
 * Saves a key-value form draft in sessionStorage (web).
 */
export const saveFormDraft = (key: string, data: any) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save draft to sessionStorage:', e);
    }
  }
};

/**
 * Loads a key-value form draft from sessionStorage (web).
 */
export const loadFormDraft = <T>(key: string, fallback: T): T => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const item = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch (e) {
      console.warn('Failed to load draft from sessionStorage:', e);
    }
  }
  return fallback;
};

/**
 * Clears a key-value form draft from sessionStorage (web).
 */
export const clearFormDraft = (key: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (e) {
      console.warn('Failed to clear draft from sessionStorage:', e);
    }
  }
};
