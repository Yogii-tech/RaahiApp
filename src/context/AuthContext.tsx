import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import { setGlobalAuthenticated } from '../utils/browserHistory';
import { normalizeHeaders, refreshAuthToken, registerAuthTokenListener } from '../utils/api';
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

    // Load credentials on startup
    useEffect(() => {
        const loadCredentials = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('auth_token');
                const storedRefresh = await AsyncStorage.getItem('auth_refresh_token');
                const storedUser = await AsyncStorage.getItem('auth_user');

                // Only require token + user to restore session; refreshToken is optional
                if (storedToken && storedUser) {
                    setToken(storedToken);
                    if (storedRefresh) setRefreshToken(storedRefresh);
                    setUser(JSON.parse(storedUser));
                    setGlobalAuthenticated(true);
                }
            } catch (e) {
                console.error('Failed to load credentials', e);
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadCredentials();
    }, []);

    // Keep React state in sync whenever apiRequest or uploadDocumentFile refreshes a token
    useEffect(() => {
        const unsubscribe = registerAuthTokenListener((newToken, newRefresh) => {
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
        setToken(newToken);
        setRefreshToken(newRefresh);
        setUser(newUser);
        setGlobalAuthenticated(!!newToken);

        if (newToken && newUser) {
            await AsyncStorage.setItem('auth_token', newToken);
            if (newRefresh) {
                await AsyncStorage.setItem('auth_refresh_token', newRefresh);
            }
            await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
        } else if (!newToken && !newRefresh && !newUser) {
            // Explicit full logout — clear everything
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('auth_refresh_token');
            await AsyncStorage.removeItem('auth_user');
        }
    };

    const logout = async () => {
        const currentToken = (await AsyncStorage.getItem('auth_token').catch(() => null)) || token;
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
            // Access token expired — check if another concurrent request already rotated it, else refresh
            const latestToken = await AsyncStorage.getItem('auth_token').catch(() => null);
            const newToken = (latestToken && latestToken !== currentToken)
                ? latestToken
                : await tryRefreshToken();
            if (newToken) {
                res = await fetch(url, {
                    ...options,
                    headers: { ...headers, Authorization: `Bearer ${newToken}` },
                    credentials: 'include',
                });
            }
            // If still 401 after retry or if refresh was not possible, force logout
            if (res.status === 401) {
                await setAuth(null, null, null);
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
                isAuthenticated: !!token,
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
