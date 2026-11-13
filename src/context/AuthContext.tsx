import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import { setGlobalAuthenticated } from '../utils/browserHistory';
import {
    bumpAuthSessionGeneration,
    getAuthSessionGeneration,
    normalizeHeaders,
    refreshAuthToken,
    registerAuthTokenListener,
} from '../utils/api';
import { unregisterFCM } from '../services/fcmService';

interface User {
    id: string;
    phone_number: string;
    name: string;
    role: string;
    language?: string;
    verification_status?: string; // 'pending' | 'verified' | 'rejected'
    rejection_reason?: string;
    vehicle?: {
        vehicle_name: string;
        vehicle_type: string;
        seats: number;
        vehicle_number: string;
        dl_url: string;
        rc_url: string;
        pollution_url: string;
        vehicle_image_url: string;
        ownership_url: string;
        seating_layout: string;
        rate_per_km?: number;
    };
}

interface AuthContextType {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
    setAuth: (token: string | null, refreshToken: string | null, user: User | null) => Promise<void>;
    isAuthenticated: boolean;
    logout: () => Promise<void>;
    isInitialLoading: boolean;
    tryRefreshToken: () => Promise<string | null>;
    fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({
    token: null,
    refreshToken: null,
    user: null,
    setAuth: async () => { },
    isAuthenticated: false,
    logout: async () => { },
    isInitialLoading: true,
    tryRefreshToken: async () => null,
    fetchWithAuth: async (url, options) => fetch(url, options),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const tokenRef = useRef<string | null>(null);
    tokenRef.current = token;
    const userRef = useRef<User | null>(null);
    userRef.current = user;
    const logoutPromiseRef = useRef<Promise<void> | null>(null);

    const clearStorageCredentials = async () => {
        await Promise.all([
            AsyncStorage.removeItem('auth_token'),
            AsyncStorage.removeItem('auth_refresh_token'),
            AsyncStorage.removeItem('auth_user'),
        ]);
    };

    // Load credentials on startup
    useEffect(() => {
        const loadCredentials = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('auth_token');
                const storedRefresh = await AsyncStorage.getItem('auth_refresh_token');
                const storedUser = await AsyncStorage.getItem('auth_user');

                // Only require token + user to restore session; refreshToken is optional
                if (storedToken && storedUser) {
                    const parsedUser = JSON.parse(storedUser);
                    setToken(storedToken);
                    if (storedRefresh) setRefreshToken(storedRefresh);
                    setUser(parsedUser);
                    setGlobalAuthenticated(true);
                } else if (storedToken || storedRefresh || storedUser) {
                    // Clean up partial/orphaned credentials
                    await clearStorageCredentials().catch(() => {});
                }
            } catch (e) {
                console.error('Failed to load credentials', e);
                await clearStorageCredentials().catch(() => {});
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadCredentials();
    }, []);

    // Keep React state in sync whenever apiRequest or uploadDocumentFile refreshes a token
    useEffect(() => {
        const unsubscribe = registerAuthTokenListener((newToken, newRefresh) => {
            // Only sync refreshed tokens if there is still an active session
            if (!tokenRef.current) return;
            if (newToken) {
                setToken(newToken);
                setGlobalAuthenticated(true);
            }
            if (newRefresh) {
                setRefreshToken(newRefresh);
            }
        });
        return unsubscribe;
    }, []);

    const setAuth = async (newToken: string | null, newRefresh: string | null, newUser: User | null) => {
        // Normalize partial-null states: a valid session requires both token and user.
        if (!newToken || !newUser) {
            bumpAuthSessionGeneration();
            tokenRef.current = null;
            userRef.current = null;
            setToken(null);
            setRefreshToken(null);
            setUser(null);
            setGlobalAuthenticated(false);
            await clearStorageCredentials();
            return;
        }

        // Bump generation when establishing a new session or switching users so
        // any refresh from a prior session cannot overwrite the new one.
        if (!tokenRef.current || (userRef.current?.id && newUser.id && userRef.current.id !== newUser.id)) {
            bumpAuthSessionGeneration();
        }

        tokenRef.current = newToken;
        userRef.current = newUser;
        setToken(newToken);
        setRefreshToken(newRefresh);
        setUser(newUser);
        setGlobalAuthenticated(true);

        await AsyncStorage.setItem('auth_token', newToken);
        if (newRefresh) {
            await AsyncStorage.setItem('auth_refresh_token', newRefresh);
        } else {
            await AsyncStorage.removeItem('auth_refresh_token');
        }
        await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
    };

    const logout = async () => {
        if (logoutPromiseRef.current) {
            return logoutPromiseRef.current;
        }

        const run = (async () => {
            // Invalidate any in-flight token refreshes immediately
            bumpAuthSessionGeneration();
            const currentToken = (await AsyncStorage.getItem('auth_token').catch(() => null)) || tokenRef.current;
            try {
                // Unregister FCM while the Bearer token is still valid and before clearing storage
                await unregisterFCM(currentToken || undefined);
            } catch (e) {
                console.warn('FCM unregister on logout failed:', e);
            }
            try {
                await fetch(`${API_BASE}/api/user/logout`, {
                    method: 'POST',
                    headers: {
                        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                });
            } catch (e) {
                console.error('Logout error:', e);
            }
            await setAuth(null, null, null);
        })().finally(() => {
            logoutPromiseRef.current = null;
        });

        logoutPromiseRef.current = run;
        return run;
    };

    // Try to get a new access token using the shared single-flight refresh mutex
    const tryRefreshToken = async (): Promise<string | null> => {
        return refreshAuthToken();
    };

    // A fetch wrapper that auto-refreshes token on 401 using the shared mutex
    const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
        const currentToken = await AsyncStorage.getItem('auth_token');
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const customHeaders = normalizeHeaders(options.headers);
        const headers: Record<string, string> = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...customHeaders,
        };
        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }

        let res = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (res.status === 401) {
            const requestGeneration = getAuthSessionGeneration();
            // Access token expired — check if another concurrent request already rotated it, else refresh
            const latestToken = await AsyncStorage.getItem('auth_token').catch(() => null);
            const newToken = (getAuthSessionGeneration() === requestGeneration && latestToken && latestToken !== currentToken)
                ? latestToken
                : await tryRefreshToken();
            if (newToken && getAuthSessionGeneration() === requestGeneration) {
                res = await fetch(url, {
                    ...options,
                    headers: { ...headers, Authorization: `Bearer ${newToken}` },
                    credentials: 'include',
                });
            }
            // If still 401 after retry or if refresh was not possible, run full logout cleanup
            if (res.status === 401 && getAuthSessionGeneration() === requestGeneration) {
                await logout();
            }
        }
        return res;
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                refreshToken,
                user,
                setAuth,
                isAuthenticated: !!(token && user),
                logout,
                isInitialLoading,
                tryRefreshToken,
                fetchWithAuth,
            }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
