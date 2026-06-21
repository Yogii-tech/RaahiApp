import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';

interface User {
    id: string;
    phone_number: string;
    name: string;
    role: string;
    language?: string;
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
                }
            } catch (e) {
                console.error('Failed to load credentials', e);
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadCredentials();
    }, []);

    const setAuth = async (newToken: string | null, newRefresh: string | null, newUser: User | null) => {
        setToken(newToken);
        setRefreshToken(newRefresh);
        setUser(newUser);

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
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (e) {
            console.error('Logout error:', e);
        }
        await setAuth(null, null, null);
    };

    // Try to get a new access token using the stored refresh token
    const tryRefreshToken = async (): Promise<string | null> => {
        const storedRefresh = await AsyncStorage.getItem('auth_refresh_token');
        if (!storedRefresh) return null;
        try {
            const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: storedRefresh }),
            });
            if (!res.ok) {
                // Refresh token itself is invalid/expired - force logout
                await setAuth(null, null, null);
                return null;
            }
            const data = await res.json();
            const newToken = data.token;
            setToken(newToken);
            await AsyncStorage.setItem('auth_token', newToken);
            return newToken;
        } catch (e) {
            console.error('Token refresh failed:', e);
            return null;
        }
    };

    // A fetch wrapper that auto-refreshes token on 401
    const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
        const currentToken = await AsyncStorage.getItem('auth_token');
        const headers = {
            ...options.headers,
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
        };
        let res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            // Access token expired — try to refresh silently
            const newToken = await tryRefreshToken();
            if (newToken) {
                res = await fetch(url, {
                    ...options,
                    headers: { ...headers, Authorization: `Bearer ${newToken}` },
                });
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
