import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { createTtlCache, TtlCache } from './ttlCache';
import { createRequestAbort } from './json';

export const DEFAULT_ADMIN_CACHE_TTL_MS = 30_000;
export const DEFAULT_ADMIN_REQUEST_TIMEOUT_MS = 12_000;
const MAX_ADMIN_CACHE_ENTRIES = 30;

export interface AdminFetchOptions {
    force?: boolean;
    timeoutMs?: number;
    timeoutMessage?: string;
}

export type AdminCachedLoader<T> = (signal: AbortSignal) => Promise<T>;

export interface AdminCacheContextValue {
    fetchCached: <T>(
        key: string,
        loader: AdminCachedLoader<T>,
        options?: AdminFetchOptions
    ) => Promise<T>;
    invalidate: (keys: string | string[]) => void;
    clear: () => void;
}

const AdminCacheContext = createContext<AdminCacheContextValue | null>(null);

/**
 * Runs a shared admin loader under a cache-owned timeout signal (linked only to the
 * enclosing session scope, never to a single tab view's unmount lifecycle) so switching
 * views mid-flight never aborts another view's joined inFlight request.
 */
async function executeScopedLoader<T>(
    loader: AdminCachedLoader<T>,
    options?: AdminFetchOptions,
    parentSignal?: AbortSignal | null
): Promise<T> {
    const { signal, didTimeout, cleanup } = createRequestAbort(
        options?.timeoutMs ?? DEFAULT_ADMIN_REQUEST_TIMEOUT_MS,
        parentSignal
    );
    try {
        return await loader(signal);
    } catch (err: any) {
        if (didTimeout() && err?.name === 'AbortError') {
            const timeoutError = new Error(options?.timeoutMessage ?? 'Request timed out');
            timeoutError.name = 'TimeoutError';
            throw timeoutError;
        }
        throw err;
    } finally {
        cleanup();
    }
}

/**
 * Provides a session-scoped 30s TTL + single-flight cache across Admin views
 * so navigating between Dashboard, Drivers, Vehicles, Rides, and Finance
 * avoids re-fetching identical full-collection endpoints on every tab click.
 */
export const AdminCacheProvider: React.FC<{
    scopeKey: string;
    ttlMs?: number;
    children: React.ReactNode;
}> = ({ scopeKey, ttlMs = DEFAULT_ADMIN_CACHE_TTL_MS, children }) => {
    const cacheRef = useRef<TtlCache<any> | null>(null);
    if (!cacheRef.current) {
        cacheRef.current = createTtlCache<any>({
            maxEntries: MAX_ADMIN_CACHE_ENTRIES,
            ttlMs,
        });
    }
    const prevScopeKeyRef = useRef(scopeKey);
    const scopeAbortRef = useRef<AbortController>(new AbortController());

    // Rotate scope synchronously during render so any child mounting/fetching in the
    // same commit (whose useEffect runs before this parent's) sees the fresh scope.
    if (prevScopeKeyRef.current !== scopeKey) {
        prevScopeKeyRef.current = scopeKey;
        scopeAbortRef.current.abort();
        scopeAbortRef.current = new AbortController();
        cacheRef.current.clear();
    }

    useEffect(() => {
        if (scopeAbortRef.current.signal.aborted) {
            scopeAbortRef.current = new AbortController();
        }
        return () => {
            scopeAbortRef.current.abort();
            cacheRef.current?.clear();
        };
    }, []);

    const fetchCached = useCallback(
        <T,>(
            key: string,
            loader: AdminCachedLoader<T>,
            options?: AdminFetchOptions
        ): Promise<T> => {
            const scopeSignal = scopeAbortRef.current.signal;
            return cacheRef.current!.getOrFetch(
                key,
                () => executeScopedLoader(loader, options, scopeSignal),
                {
                    force: options?.force,
                    shouldCache: (val) => val !== undefined && val !== null,
                }
            ) as Promise<T>;
        },
        []
    );

    const invalidate = useCallback((keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) {
            cacheRef.current?.invalidatePrefix(k);
        }
    }, []);

    const clear = useCallback(() => {
        scopeAbortRef.current.abort();
        scopeAbortRef.current = new AbortController();
        cacheRef.current?.clear();
    }, []);

    const value = useMemo<AdminCacheContextValue>(
        () => ({ fetchCached, invalidate, clear }),
        [fetchCached, invalidate, clear]
    );

    return (
        <AdminCacheContext.Provider value={value}>
            {children}
        </AdminCacheContext.Provider>
    );
};

const FALLBACK_CACHE_CONTEXT: AdminCacheContextValue = {
    fetchCached: (key, loader, options) => {
        void key;
        return executeScopedLoader(loader, options);
    },
    invalidate: () => {},
    clear: () => {},
};

/**
 * Accesses the enclosing AdminCacheProvider when mounted inside AdminDashboardScreen,
 * or safely runs uncached loaders directly in isolated/standalone renders.
 */
export function useAdminCache(): AdminCacheContextValue {
    return useContext(AdminCacheContext) ?? FALLBACK_CACHE_CONTEXT;
}
