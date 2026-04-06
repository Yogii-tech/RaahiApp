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
}

const AuthContext = createContext<AuthContextType>({
    token: null,
    refreshToken: null,
    user: null,
    setAuth: async () => { },
    isAuthenticated: false,
    logout: async () => { },
    isInitialLoading: true,
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

                if (storedToken && storedRefresh && storedUser) {
                    setToken(storedToken);
                    setRefreshToken(storedRefresh);
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

        if (newToken && newRefresh && newUser) {
            await AsyncStorage.setItem('auth_token', newToken);
            await AsyncStorage.setItem('auth_refresh_token', newRefresh);
            await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
        } else {
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
            }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
