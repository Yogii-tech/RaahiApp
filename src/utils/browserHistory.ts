import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

let globalIsAuthenticated = false;

/**
 * Updates the global authentication status for browser history interception.
 */
export const setGlobalAuthenticated = (authenticated: boolean) => {
  globalIsAuthenticated = authenticated;
};

// Global interceptor for popstate events on Web to prevent React Navigation crashes
// when browser back button is pressed on root screens/tabs (like homepage).
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (globalIsAuthenticated) {
      const state = e.state;
      const isLoginState = state && typeof state === 'object' && typeof state.subView === 'string' && state.subView.includes('login');
      const isCustomSubView = state && typeof state === 'object' && 'subView' in state;
      const isReactNavigationState = state && typeof state === 'object' && ('key' in state || 'state' in state);

      if (isLoginState || (isCustomSubView && !isReactNavigationState)) {
        e.stopImmediatePropagation();
        window.history.forward();
      }
    }
  }, { capture: true });
}

/**
 * Pushes a sub-view entry to browser history on Web.
 */
export const pushSubViewHistory = (viewName: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
    if (window.history.state?.subView !== viewName) {
      const currentState = (typeof window.history.state === 'object' && window.history.state !== null) ? window.history.state : {};
      window.history.pushState({ ...currentState, subView: viewName, timestamp: Date.now() }, '', window.location.href);
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
export const useBrowserBack = (isSubViewActive: boolean, onBack: () => void, isEnabled: boolean = true) => {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePopState = (_e: PopStateEvent) => {
      if (isSubViewActive && isEnabled) {
        onBackRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSubViewActive, isEnabled]);
};

