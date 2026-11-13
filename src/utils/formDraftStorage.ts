import { Platform } from 'react-native';

const STORAGE_PREFIX = 'goraahi_draft_';

const buildDraftKey = (key: string, scope?: string | null): string => {
  const safeScope = scope ? `${scope.trim()}_` : '';
  return `${STORAGE_PREFIX}${safeScope}${key}`;
};

export const getTodayDisplayDate = (): string => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const parseDisplayDate = (displayDate: string): Date | null => {
  const parts = (displayDate || '').trim().split('/');
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy) || yyyy < 2000) {
    return null;
  }
  const parsed = new Date(yyyy, mm - 1, dd);
  if (
    parsed.getFullYear() !== yyyy ||
    parsed.getMonth() !== mm - 1 ||
    parsed.getDate() !== dd
  ) {
    return null;
  }
  return parsed;
};

export const isTodayOrFutureDisplayDate = (displayDate: string): boolean => {
  const parsed = parseDisplayDate(displayDate);
  if (!parsed) return false;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed >= todayMidnight;
};

export const resolveDraftDate = (rawDate: string | null | undefined, fallback?: string): string => {
  const defaultDate = fallback || getTodayDisplayDate();
  if (!rawDate || !isTodayOrFutureDisplayDate(rawDate)) {
    return defaultDate;
  }
  return rawDate;
};

/**
 * Saves a key-value form draft in sessionStorage (web), optionally scoped to a user ID.
 */
export const saveFormDraft = (key: string, data: any, scope?: string | null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(buildDraftKey(key, scope), JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save draft to sessionStorage:', e);
    }
  }
};

/**
 * Loads a key-value form draft from sessionStorage (web), optionally scoped to a user ID.
 */
export const loadFormDraft = <T>(key: string, fallback: T, scope?: string | null): T => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const item = window.sessionStorage.getItem(buildDraftKey(key, scope));
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
 * Clears a key-value form draft from sessionStorage (web), optionally scoped to a user ID.
 */
export const clearFormDraft = (key: string, scope?: string | null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(buildDraftKey(key, scope));
    } catch (e) {
      console.warn('Failed to clear draft from sessionStorage:', e);
    }
  }
};
