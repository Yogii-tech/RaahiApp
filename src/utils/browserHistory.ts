import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * ─── GoRaahi Browser History Manager ───────────────────────────────────────
 *
 * Architecture:
 *  - Each active overlay/sub-view registers a handler via useBrowserBack().
 *  - Handlers are stored in a LIFO stack. User browser-back fires the TOP handler only.
 *  - In-app back buttons ALWAYS change state directly (no gating on history) and call
 *    popSubViewHistory() to keep URL history in sync.
 *  - pendingProgrammaticPops tracks in-flight window.history.back() calls triggered by
 *    popSubViewHistory() so the resulting asynchronous `popstate` event never double-pops
 *    or triggers a parent handler on `handlerStack`.
 *  - isHandlingPopState prevents re-entrant popSubViewHistory() calls from inside a
 *    `popstate` callback.
 */

type BackHandler = () => void;
const handlerStack: BackHandler[] = [];
let pendingProgrammaticPops = 0;
let programmaticPopDecayTimer: ReturnType<typeof setTimeout> | null = null;
let isHandlingPopState = false;
let listenerAttached = false;

const registerHandler = (handler: BackHandler) => {
  if (!handlerStack.includes(handler)) {
    handlerStack.push(handler);
  }
};

const unregisterHandler = (handler: BackHandler) => {
  const idx = handlerStack.indexOf(handler);
  if (idx !== -1) handlerStack.splice(idx, 1);
};

const clearDecayTimer = () => {
  if (programmaticPopDecayTimer !== null) {
    clearTimeout(programmaticPopDecayTimer);
    programmaticPopDecayTimer = null;
  }
};

const onPopState = (_e: PopStateEvent) => {
  if (pendingProgrammaticPops > 0) {
    pendingProgrammaticPops -= 1;
    if (pendingProgrammaticPops === 0) {
      clearDecayTimer();
    }
    return;
  }

  if (handlerStack.length > 0) {
    const topHandler = handlerStack.pop();
    if (topHandler) {
      isHandlingPopState = true;
      try {
        topHandler();
      } finally {
        isHandlingPopState = false;
      }
    }
  }
};

const ensurePopstateListener = () => {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function' &&
    !listenerAttached
  ) {
    window.addEventListener('popstate', onPopState);
    listenerAttached = true;
  }
};

ensurePopstateListener();

/**
 * Push a history entry when navigating INTO a sub-view.
 * This ensures the browser back button has something to pop.
 */
export const pushSubViewHistory = (viewName: string) => {
  ensurePopstateListener();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.history?.pushState === 'function') {
    window.history.pushState(
      { subView: viewName, timestamp: Date.now() },
      '',
      window.location.href
    );
  }
};

/**
 * Replace the current sub-view history entry (or push if none is active).
 * Used when transitioning directly between sibling overlays (e.g. notifications -> chat)
 * so the browser history stack keeps a 1:1 depth with the active overlay.
 */
export const replaceSubViewHistory = (viewName: string) => {
  ensurePopstateListener();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history) {
    if (window.history.state?.subView && typeof window.history.replaceState === 'function') {
      window.history.replaceState(
        { subView: viewName, timestamp: Date.now() },
        '',
        window.location.href
      );
    } else {
      pushSubViewHistory(viewName);
    }
  }
};

/**
 * Call this as a SIDE-EFFECT after you have already changed state.
 * On web it goes back one entry to keep the URL tidy without firing parent handlers.
 * On native, or while already handling a browser `popstate`, it's a no-op.
 */
export const popSubViewHistory = () => {
  ensurePopstateListener();
  if (isHandlingPopState) {
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.history?.back === 'function') {
    if (window.history.state?.subView) {
      pendingProgrammaticPops += 1;
      clearDecayTimer();
      // Safety decay in case the browser suppresses popstate (e.g. no prior entry)
      programmaticPopDecayTimer = setTimeout(() => {
        pendingProgrammaticPops = 0;
        programmaticPopDecayTimer = null;
      }, 500);
      (programmaticPopDecayTimer as any)?.unref?.();
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
    ensurePopstateListener();
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
 * Test helpers — used only in unit tests to inspect/reset module state.
 */
export const _resetBrowserHistoryForTests = () => {
  handlerStack.length = 0;
  pendingProgrammaticPops = 0;
  isHandlingPopState = false;
  clearDecayTimer();
  if (listenerAttached && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
    window.removeEventListener('popstate', onPopState);
  }
  listenerAttached = false;
};

export const _getBrowserHistoryDebugState = () => ({
  stackLength: handlerStack.length,
  pendingProgrammaticPops,
  isHandlingPopState,
  listenerAttached,
});

/**
 * Legacy: kept for compatibility — previously set a global authenticated flag.
 * Now a no-op.
 */
export const setGlobalAuthenticated = (_authenticated: boolean) => {};
