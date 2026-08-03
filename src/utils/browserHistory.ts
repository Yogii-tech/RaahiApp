import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Pushes a sub-view entry to browser history on Web.
 */
export const pushSubViewHistory = (viewName: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
    if (window.history.state?.subView !== viewName) {
      window.history.pushState({ subView: viewName, timestamp: Date.now() }, '', window.location.href);
    }
  }
};

/**
 * Safely navigates back in browser history if a sub-view state is active.
 */
export const popSubViewHistory = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
    if (window.history.state?.subView) {
      window.history.back();
      return true;
    }
  }
  return false;
};

/**
 * Hook to handle browser back button (popstate) for sub-views / screens.
 * @param isSubViewActive Whether a non-default sub-view or step is active
 * @param onBack Callback function to revert view/step
 */
export const useBrowserBack = (isSubViewActive: boolean, onBack: () => void) => {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePopState = (_e: PopStateEvent) => {
      if (isSubViewActive) {
        onBackRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSubViewActive]);
};
