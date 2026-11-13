import { API_BASE } from '../apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseJsonSafe } from './json';

/**
 * Enhanced fetch wrapper that handles:
 * 1. Automatic "Authorization: Bearer <token>" header (for compatibility)
 * 2. HttpOnly Cookies (for Web security)
 * 3. Single-flight token refresh mutex on 401 Unauthorized + context sync listeners
 * 4. Consistent error handling & FormData support
 */

export type AuthTokenListener = (newToken: string | null, newRefreshToken?: string | null) => void;

const authTokenListeners = new Set<AuthTokenListener>();
let refreshPromise: Promise<string | null> | null = null;
let authSessionGeneration = 0;

/**
 * Returns the current auth session generation. Incremented on logout/session reset
 * so an in-flight refresh can never resurrect tokens for a terminated session.
 */
export const getAuthSessionGeneration = (): number => authSessionGeneration;

/**
 * Bumps the auth session generation and drops any shared in-flight refresh promise.
 */
export const bumpAuthSessionGeneration = (): number => {
    authSessionGeneration += 1;
    refreshPromise = null;
    return authSessionGeneration;
};

export const registerAuthTokenListener = (listener: AuthTokenListener): (() => void) => {
    authTokenListeners.add(listener);
    return () => {
        authTokenListeners.delete(listener);
    };
};

const notifyAuthTokenListeners = (newToken: string | null, newRefreshToken?: string | null) => {
    authTokenListeners.forEach(listener => {
        try {
            listener(newToken, newRefreshToken);
        } catch (err) {
            console.error('Auth token listener error:', err);
        }
    });
};

export const normalizeHeaders = (headersInit?: HeadersInit): Record<string, string> => {
    const result: Record<string, string> = {};
    if (!headersInit) return result;
    if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
        headersInit.forEach((value, key) => {
            result[key] = value;
        });
    } else if (Array.isArray(headersInit)) {
        headersInit.forEach(([key, value]) => {
            result[key] = value;
        });
    } else {
        Object.assign(result, headersInit);
    }
    return result;
};

/**
 * Single-flight token refresh helper. Simultaneous 401 callers share the same
 * in-flight POST /api/auth/refresh promise and receive the same rotated token.
 */
export const refreshAuthToken = async (explicitRefreshToken?: string | null): Promise<string | null> => {
    if (refreshPromise) {
        return refreshPromise;
    }

    const startGeneration = authSessionGeneration;
    const currentRefreshPromise = (async (): Promise<string | null> => {
        let refreshToken = explicitRefreshToken ?? null;
        if (!refreshToken) {
            try {
                refreshToken = await AsyncStorage.getItem('auth_refresh_token');
            } catch {
                refreshToken = null;
            }
        }

        if (authSessionGeneration !== startGeneration) {
            return null;
        }

        try {
            // Note: Even if refreshToken is null in JS,
            // the server might find it in the cookie if we are on Web.
            const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
                credentials: 'include',
            });

            if (authSessionGeneration !== startGeneration || !refreshResponse.ok) {
                return null;
            }

            const data = await parseJsonSafe(refreshResponse);
            if (authSessionGeneration !== startGeneration || !data) {
                return null;
            }

            const newToken: string | null = data?.token || null;
            const rotatedRefresh: string | null = data?.refresh_token || null;

            if (newToken) {
                try {
                    await AsyncStorage.setItem('auth_token', newToken);
                    if (rotatedRefresh) {
                        await AsyncStorage.setItem('auth_refresh_token', rotatedRefresh);
                    }
                } catch {
                    // Ignore storage write failures; listeners still receive the new token
                }
                if (authSessionGeneration !== startGeneration) {
                    // Session was logged out while writing storage; clean up before returning
                    try {
                        await AsyncStorage.removeItem('auth_token');
                        await AsyncStorage.removeItem('auth_refresh_token');
                    } catch { /* ignore */ }
                    return null;
                }
                notifyAuthTokenListeners(newToken, rotatedRefresh ?? refreshToken);
            }

            return newToken;
        } catch (err) {
            console.error('Refresh token error:', err);
            return null;
        }
    })().finally(() => {
        if (refreshPromise === currentRefreshPromise) {
            refreshPromise = null;
        }
    });

    refreshPromise = currentRefreshPromise;
    return currentRefreshPromise;
};

export const apiRequest = async (
    endpoint: string,
    options: RequestInit = {},
    logoutCallback?: () => void
) => {
    const requestGeneration = authSessionGeneration;
    const token = await AsyncStorage.getItem('auth_token');
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const customHeaders = normalizeHeaders(options.headers);

    const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...customHeaders,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    // Handle 401 Unauthorized (Token expired) only if request belongs to the current auth session
    if (response.status === 401 && authSessionGeneration === requestGeneration) {
        const latestToken = await AsyncStorage.getItem('auth_token').catch(() => null);
        const newToken = (authSessionGeneration === requestGeneration && latestToken && latestToken !== token)
            ? latestToken
            : await refreshAuthToken();

        if (newToken && authSessionGeneration === requestGeneration) {
            // Retry original request with NEW token
            const retryHeaders = {
                ...headers,
                Authorization: `Bearer ${newToken}`,
            };

            response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: retryHeaders,
                credentials: 'include',
            });

            if (response.status === 401 && authSessionGeneration === requestGeneration && logoutCallback) {
                logoutCallback();
            }
        } else if (authSessionGeneration === requestGeneration) {
            // Refresh token also expired or revoked
            if (logoutCallback) logoutCallback();
        }
    }

    return response;
};
