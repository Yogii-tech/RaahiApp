import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  refreshAuthToken,
  bumpAuthSessionGeneration,
  getAuthSessionGeneration,
  registerAuthTokenListener,
} from '../src/utils/api';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { unregisterFCM } from '../src/services/fcmService';
import { loginStepReducer } from '../src/screens/LoginScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  clear: jest.fn(async () => undefined),
}));

jest.mock('../src/services/fcmService', () => ({
  registerFCM: jest.fn(async () => undefined),
  unregisterFCM: jest.fn(async () => undefined),
}));

jest.mock('../src/utils/documentUpload', () => ({
  pickAndUploadDocument: jest.fn(async () => null),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

describe('Auth Session & Login FSM Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    bumpAuthSessionGeneration();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('refreshAuthToken does not resurrect credentials if session generation bumps mid-flight', async () => {
    let resolveFetch!: (res: any) => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    ) as any;

    const listener = jest.fn();
    const unsubscribe = registerAuthTokenListener(listener);

    const startGen = getAuthSessionGeneration();
    const refreshPromise = refreshAuthToken('old-refresh');

    // Simulate logout mid-flight
    const newGen = bumpAuthSessionGeneration();
    expect(newGen).toBeGreaterThan(startGen);

    resolveFetch({
      ok: true,
      json: async () => ({ token: 'resurrected-token', refresh_token: 'new-refresh' }),
    });

    const result = await refreshPromise;
    unsubscribe();

    expect(result).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('auth_token', 'resurrected-token');
    expect(listener).not.toHaveBeenCalled();
  });

  test('AuthContext setAuth clears partial null and fetchWithAuth 401 triggers logout + unregisterFCM', async () => {
    const store: Record<string, string> = {};
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      store[k] = v;
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => {
      delete store[k];
    });

    let authApi!: ReturnType<typeof useAuth>;
    function Consumer() {
      authApi = useAuth();
      return null;
    }

    await act(async () => {
      ReactTestRenderer.create(
        React.createElement(AuthProvider, null, React.createElement(Consumer))
      );
    });

    await act(async () => {
      await authApi.setAuth('tok-1', 'ref-1', {
        id: 'u1',
        phone_number: '9999999999',
        name: 'Asha',
        role: 'passenger',
      });
    });

    expect(authApi.isAuthenticated).toBe(true);
    expect(store.auth_token).toBe('tok-1');
    expect(store.auth_refresh_token).toBe('ref-1');

    // Partial null clears everything
    await act(async () => {
      await authApi.setAuth('tok-only', null, null);
    });
    expect(authApi.isAuthenticated).toBe(false);
    expect(store.auth_token).toBeUndefined();
    expect(store.auth_refresh_token).toBeUndefined();
    expect(store.auth_user).toBeUndefined();

    // Restore session and test 401 -> failed refresh -> logout
    await act(async () => {
      await authApi.setAuth('tok-2', 'ref-2', {
        id: 'u1',
        phone_number: '9999999999',
        name: 'Asha',
        role: 'passenger',
      });
    });

    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/api/auth/refresh')) {
        return { ok: false, status: 401, json: async () => ({}) } as any;
      }
      if (url.includes('/api/user/logout')) {
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }
      return { ok: false, status: 401, json: async () => ({ error: 'expired' }) } as any;
    }) as any;

    let res!: Response;
    await act(async () => {
      res = await authApi.fetchWithAuth('/api/rides/bookings');
    });

    expect(res.status).toBe(401);
    expect(authApi.isAuthenticated).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/user/logout'), expect.any(Object));
    expect(unregisterFCM).toHaveBeenCalledWith('tok-2');
    expect(store.auth_token).toBeUndefined();
    expect(store.auth_refresh_token).toBeUndefined();
    expect(store.auth_user).toBeUndefined();
  });

  test('loginStepReducer enforces explicit transitions, rejects invalid jumps, and maps BACK targets', () => {
    expect(loginStepReducer('phone', { type: 'TRANSITION', to: 'otp' })).toBe('otp');
    // Invalid jump rejected
    expect(loginStepReducer('phone', { type: 'TRANSITION', to: 'vehicle' })).toBe('phone');
    expect(loginStepReducer('otp', { type: 'TRANSITION', to: 'role' })).toBe('otp');

    // Valid onboarding chain
    let step = loginStepReducer('otp', { type: 'TRANSITION', to: 'name' });
    step = loginStepReducer(step, { type: 'TRANSITION', to: 'consent' });
    step = loginStepReducer(step, { type: 'TRANSITION', to: 'role' });
    step = loginStepReducer(step, { type: 'TRANSITION', to: 'driver_consent' });
    step = loginStepReducer(step, { type: 'TRANSITION', to: 'vehicle' });
    expect(step).toBe('vehicle');

    // Explicit BACK chain
    expect(loginStepReducer('vehicle', { type: 'BACK' })).toBe('driver_consent');
    expect(loginStepReducer('driver_consent', { type: 'BACK' })).toBe('role');
    expect(loginStepReducer('role', { type: 'BACK' })).toBe('consent');
    expect(loginStepReducer('consent', { type: 'BACK' })).toBe('name');
    expect(loginStepReducer('name', { type: 'BACK' })).toBe('phone');
    expect(loginStepReducer('admin_secret', { type: 'BACK' })).toBe('admin_phone');
  });
});
