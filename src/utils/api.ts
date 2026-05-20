import { API_BASE } from '../apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Enhanced fetch wrapper that handles:
 * 1. Automatic "Authorization: Bearer <token>" header (for compatibility)
 * 2. HttpOnly Cookies (for Web security)
 * 3. Token refresh logic on 401 Unauthorized
 * 4. Consistent error handling
 */

export const apiRequest = async (
    endpoint: string,
    options: RequestInit = {},
    logoutCallback?: () => void
) => {
    let token = await AsyncStorage.getItem('auth_token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    } as any;

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    // Handle 401 Unauthorized (Token expired)
    if (response.status === 401) {
        const refreshToken = await AsyncStorage.getItem('auth_refresh_token');

        try {
            // Note: Even if refreshToken is null in JS, 
            // the server might find it in the cookie if we are on Web.
            const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
                credentials: 'include',
            });

            if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                const newToken = data.token;

                // Save new token (for Native apps, browser ignores this if it's in cookie)
                if (newToken) {
                    await AsyncStorage.setItem('auth_token', newToken);
                }

                // Retry original request with NEW token
                const retryHeaders = { ...headers };
                if (newToken) {
                    retryHeaders['Authorization'] = `Bearer ${newToken}`;
                }

                response = await fetch(`${API_BASE}${endpoint}`, {
                    ...options,
                    headers: retryHeaders,
                    credentials: 'include',
                });
            } else {
                // Refresh token also expired or revoked
                if (logoutCallback) logoutCallback();
            }
        } catch (err) {
            console.error('Refresh token error:', err);
            if (logoutCallback) logoutCallback();
        }
    }

    return response;
};
