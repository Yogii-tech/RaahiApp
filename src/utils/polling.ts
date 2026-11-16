import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type PollReason = 'mount' | 'interval' | 'resume' | 'manual';

export interface VisibilityPollingOptions {
    /** Whether this screen/component currently wants polling active. */
    enabled: boolean;
    /** Delay between consecutive settled polls in ms (or getter for adaptive delays). */
    intervalMs: number | (() => number);
    /** Minimum ms between automatic focus/visibility resume syncs. Default 5000ms. */
    resumeCooldownMs?: number;
    /** Poll callback; can return a Promise so overlapping ticks are deduplicated. */
    onPoll: (reason: PollReason) => void | Promise<unknown>;
    /** Invoked when polling pauses (hidden/backgrounded/disabled or unmounted). */
    onPause?: () => void;
}

export const DEFAULT_RESUME_COOLDOWN_MS = 5000;

/**
 * Returns true when the app or browser tab is currently in the foreground.
 */
export function isAppForegroundActive(): boolean {
    if (Platform.OS === 'web') {
        if (typeof document === 'undefined') return true;
        if (typeof document.visibilityState === 'string') {
            return document.visibilityState === 'visible';
        }
        return true;
    }
    const state = AppState.currentState;
    return typeof state !== 'string' || (state !== 'background' && state !== 'inactive');
}

/**
 * Visibility and AppState aware polling hook with single-flight deduplication
 * and focus/visibility resume cooldown gating so rapid tab switches never burst.
 */
export function useVisibilityPolling({
    enabled,
    intervalMs,
    resumeCooldownMs = DEFAULT_RESUME_COOLDOWN_MS,
    onPoll,
    onPause,
}: VisibilityPollingOptions): {
    isAppActive: boolean;
    triggerSync: () => Promise<void>;
    resetSchedule: () => void;
} {
    const [isAppActive, setIsAppActive] = useState<boolean>(() => isAppForegroundActive());

    const isMountedRef = useRef(true);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;
    const isAppActiveRef = useRef(isAppActive);
    isAppActiveRef.current = isAppActive;
    const intervalMsRef = useRef(intervalMs);
    intervalMsRef.current = intervalMs;
    const resumeCooldownMsRef = useRef(resumeCooldownMs);
    resumeCooldownMsRef.current = resumeCooldownMs;
    const onPollRef = useRef(onPoll);
    onPollRef.current = onPoll;
    const onPauseRef = useRef(onPause);
    onPauseRef.current = onPause;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = useRef(false);
    const hasCompletedInitialRunRef = useRef(false);
    const lastSyncAtRef = useRef(0);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const canRunNow = useCallback(() => {
        return isMountedRef.current && enabledRef.current && isAppForegroundActive();
    }, []);

    const scheduleNextRef = useRef<(delayOverrideMs?: number) => void>(() => {});
    const runCycleRef = useRef<(reason: PollReason) => Promise<void>>(async () => {});

    const getIntervalMs = useCallback(() => {
        const raw = typeof intervalMsRef.current === 'function'
            ? intervalMsRef.current()
            : intervalMsRef.current;
        return Math.max(250, raw);
    }, []);

    scheduleNextRef.current = (delayOverrideMs?: number) => {
        clearTimer();
        if (!isMountedRef.current || !enabledRef.current || !isAppActiveRef.current) {
            return;
        }
        const delay = Math.max(250, delayOverrideMs ?? getIntervalMs());
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (!canRunNow()) return;
            void runCycleRef.current('interval');
        }, delay);
    };

    runCycleRef.current = async (reason: PollReason) => {
        if (!canRunNow()) return;
        if (inFlightRef.current) return;

        clearTimer();
        inFlightRef.current = true;
        hasCompletedInitialRunRef.current = true;
        lastSyncAtRef.current = Date.now();
        try {
            await Promise.resolve(onPollRef.current(reason));
        } catch {
            // Callers handle/report their own fetch errors; keep schedule alive.
        } finally {
            inFlightRef.current = false;
            // Record completion time as well so slow responses don't re-trigger early on focus.
            lastSyncAtRef.current = Math.max(lastSyncAtRef.current, Date.now());
            if (isMountedRef.current && enabledRef.current && isAppActiveRef.current && isAppForegroundActive()) {
                scheduleNextRef.current();
            }
        }
    };

    const tryResumeSync = useCallback(() => {
        if (!canRunNow()) return;
        if (inFlightRef.current) return;
        const elapsed = Date.now() - lastSyncAtRef.current;
        if (!hasCompletedInitialRunRef.current || elapsed >= resumeCooldownMsRef.current) {
            void runCycleRef.current(hasCompletedInitialRunRef.current ? 'resume' : 'mount');
        }
    }, [canRunNow]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            clearTimer();
        };
    }, [clearTimer]);

    // Subscribe to browser visibility/focus or native AppState changes.
    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return;
            const handleVisibility = () => {
                const active = isAppForegroundActive();
                isAppActiveRef.current = active;
                setIsAppActive(active);
            };
            const handleWindowFocus = () => {
                const active = isAppForegroundActive();
                isAppActiveRef.current = active;
                setIsAppActive(active);
                if (active) {
                    tryResumeSync();
                }
            };
            document.addEventListener('visibilitychange', handleVisibility);
            if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                window.addEventListener('focus', handleWindowFocus);
            }
            return () => {
                document.removeEventListener('visibilitychange', handleVisibility);
                if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
                    window.removeEventListener('focus', handleWindowFocus);
                }
            };
        }

        const sub = AppState.addEventListener('change', (nextState) => {
            const active =
                typeof nextState !== 'string' ||
                (nextState !== 'background' && nextState !== 'inactive');
            isAppActiveRef.current = active;
            setIsAppActive(active);
        });
        return () => sub?.remove?.();
    }, [tryResumeSync]);

    // Drive active polling / cooldown-gated resume / pause cleanup.
    useEffect(() => {
        if (!enabled || !isAppActive) {
            clearTimer();
            onPauseRef.current?.();
            return;
        }

        if (!hasCompletedInitialRunRef.current) {
            void runCycleRef.current('mount');
        } else {
            const elapsed = Date.now() - lastSyncAtRef.current;
            if (elapsed >= resumeCooldownMsRef.current) {
                void runCycleRef.current('resume');
            } else {
                scheduleNextRef.current(getIntervalMs());
            }
        }

        return () => {
            clearTimer();
        };
    }, [enabled, isAppActive, clearTimer, getIntervalMs]);

    const triggerSync = useCallback(async () => {
        if (!isMountedRef.current) return;
        lastSyncAtRef.current = Date.now();
        clearTimer();
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        hasCompletedInitialRunRef.current = true;
        try {
            await Promise.resolve(onPollRef.current('manual'));
        } finally {
            inFlightRef.current = false;
            lastSyncAtRef.current = Math.max(lastSyncAtRef.current, Date.now());
            if (isMountedRef.current && enabledRef.current && isAppActiveRef.current && isAppForegroundActive()) {
                scheduleNextRef.current();
            }
        }
    }, [clearTimer]);

    const resetSchedule = useCallback(() => {
        if (!isMountedRef.current || !enabledRef.current || !isAppActiveRef.current) return;
        scheduleNextRef.current();
    }, []);

    return {
        isAppActive,
        triggerSync,
        resetSchedule,
    };
}
