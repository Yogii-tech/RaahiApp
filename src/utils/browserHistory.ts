import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * ─── GoRaahi Browser History Manager ───────────────────────────────────────
 *
 * Architecture:
 *  - Each active overlay/sub-view registers a handler via useBrowserBack().
 *  - Handlers are stored in a stack. Browser back fires the TOP handler only.
 *  - In-app back buttons ALWAYS change state directly (no gating on history).
 *    They call popHistoryEntry() as a side-effect to keep URL history in sync.
 *  - No global interceptor — nothing fights popstate events.
 */

// ─── Handler Registry ────────────────────────────────────────────────────────

type BackHandler = () => void;
const handlerStack: BackHandler[] = [];

const registerHandler = (handler: BackHandler) => {
  // Avoid duplicate registrations
  if (!handlerStack.includes(handler)) {
    handlerStack.push(handler);
  }
};

const unregisterHandler = (handler: BackHandler) => {
  const idx = handlerStack.indexOf(handler);
  if (idx !== -1) handlerStack.splice(idx, 1);
};

// ─── Global popstate listener (single, non-capturing) ────────────────────────

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('popstate', (_e: PopStateEvent) => {
    // Fire the top-most registered handler (LIFO)
    if (handlerStack.length > 0) {
      const topHandler = handlerStack[handlerStack.length - 1];
      topHandler();
      // Re-push a history entry so browser back still works for the next pop
      // (The handler is responsible for un-registering itself via useBrowserBack cleanup)
      window.history.pushState(
        { subView: 'intercepted', timestamp: Date.now() },
        '',
        window.location.href
      );
    }
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Push a history entry when navigating INTO a sub-view.
 * This ensures the browser back button has something to pop.
 */
export const pushSubViewHistory = (viewName: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.pushState(
      { subView: viewName, timestamp: Date.now() },
      '',
      window.location.href
    );
  }
};

/**
 * Call this as a SIDE-EFFECT after you have already changed state.
 * On web it goes back one entry to keep the URL tidy.
 * On native it's a no-op.
 *
 * DO NOT use this to gate whether the state change happens — always
 * change state unconditionally, then call this.
 */
export const popSubViewHistory = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Only go back if there is a sub-view entry to consume
    if (window.history.state?.subView) {
      window.history.back();
    }
  }
};

/**
 * Hook: registers a back handler while a sub-view is active.
 *
 * @param isActive   True when the sub-view / overlay is open.
 * @param onBack     Called when browser back is pressed. Should change React state.
 * @param isEnabled  Optional guard (e.g. useIsFocused). Defaults to true.
 */
export const useBrowserBack = (
  isActive: boolean,
  onBack: () => void,
  isEnabled: boolean = true
) => {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Stable reference to avoid re-registering on every render
  const stableHandler = useRef<BackHandler>(() => {
    onBackRef.current();
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isActive || !isEnabled) {
      unregisterHandler(stableHandler.current);
      return;
    }
    registerHandler(stableHandler.current);
    return () => {
      unregisterHandler(stableHandler.current);
    };
  }, [isActive, isEnabled]);
};

/**
 * Legacy: kept for compatibility — previously set a global authenticated flag.
 * Now a no-op.
 */
export const setGlobalAuthenticated = (_authenticated: boolean) => {};
