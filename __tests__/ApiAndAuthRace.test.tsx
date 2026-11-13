import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

jest.mock('../src/utils/notify', () => ({
  notify: jest.fn(),
  confirmAction: jest.fn(),
}));

import {
  apiRequest,
  bumpAuthSessionGeneration,
  getAuthSessionGeneration,
} from '../src/utils/api';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { unregisterFCM } from '../src/services/fcmService';
import SignOutConfirmModal, { useSignOutConfirmation } from '../src/screens/admin/SignOutConfirmModal';
import { notify } from '../src/utils/notify';

describe('API Session Generation & SignOut Resilience', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    bumpAuthSessionGeneration();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('apiRequest captures session generation before fetch so late User A 401 never logs out or refreshes User B', async () => {
    const store: Record<string, string> = {
      auth_token: 'user-a-token',
      auth_refresh_token: 'user-a-refresh',
    };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);

    let resolveUserAReq!: (res: any) => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveUserAReq = resolve;
        })
    ) as any;

    const logoutCallback = jest.fn();
    const pendingReq = apiRequest('/api/rides/my', {}, logoutCallback);

    // Let AsyncStorage.getItem finish and fetch start
    await Promise.resolve();
    await Promise.resolve();

    // User A logs out and User B logs in while User A's request is in flight
    bumpAuthSessionGeneration();
    store.auth_token = 'user-b-token';
    store.auth_refresh_token = 'user-b-refresh';

    resolveUserAReq({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'expired' }),
    });

    const response = await pendingReq;

    expect(response.status).toBe(401);
    expect(logoutCallback).not.toHaveBeenCalled();
    // Only the initial /api/rides/my call ran; /api/auth/refresh was never triggered for stale User A
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(store.auth_token).toBe('user-b-token');
  });

  test('AuthContext.logout clears state synchronously and slow /api/user/logout never clobbers a subsequent login', async () => {
    const store: Record<string, string> = {};
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      store[k] = v;
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => {
      delete store[k];
    });

    let resolveLogoutFetch!: (res: any) => void;
    global.fetch = jest.fn(
      (url: string) =>
        new Promise((resolve) => {
          if (url.includes('/api/user/logout')) {
            resolveLogoutFetch = resolve;
          } else {
            resolve({ ok: true, status: 200, text: async () => '{}' } as any);
          }
        })
    ) as any;

    let authApi!: ReturnType<typeof useAuth>;
    function Consumer() {
      authApi = useAuth();
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(AuthProvider, null, React.createElement(Consumer))
      );
    });

    await act(async () => {
      await authApi.setAuth('tok-user-a', 'ref-user-a', {
        id: 'user-a',
        phone_number: '9999999991',
        name: 'User A',
        role: 'passenger',
      });
    });
    expect(authApi.isAuthenticated).toBe(true);

    const genBeforeLogout = getAuthSessionGeneration();
    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = authApi.logout();
      await Promise.resolve();
    });

    // Cleared immediately while network logout is still pending
    expect(getAuthSessionGeneration()).toBeGreaterThan(genBeforeLogout);
    expect(authApi.isAuthenticated).toBe(false);
    expect(authApi.token).toBeNull();
    expect(authApi.user).toBeNull();
    expect(unregisterFCM).toHaveBeenCalledWith('tok-user-a');

    // User B logs in before User A's /api/user/logout completes
    await act(async () => {
      await authApi.setAuth('tok-user-b', 'ref-user-b', {
        id: 'user-b',
        phone_number: '9999999992',
        name: 'User B',
        role: 'passenger',
      });
    });

    expect(authApi.isAuthenticated).toBe(true);
    expect(authApi.token).toBe('tok-user-b');

    // Finish delayed network logout for User A
    await act(async () => {
      resolveLogoutFetch({ ok: true, status: 200, text: async () => '{}' });
      await logoutPromise;
    });

    // User B remains authenticated and storage is intact
    expect(authApi.isAuthenticated).toBe(true);
    expect(authApi.token).toBe('tok-user-b');
    expect(authApi.user?.id).toBe('user-b');
    expect(store.auth_token).toBe('tok-user-b');

    await act(async () => {
      renderer.unmount();
    });
  });

  test('useSignOutConfirmation notifies and keeps modal open when logout() fails', async () => {
    const failingLogout = jest.fn(async () => {
      throw new Error('Logout API error');
    });

    function Harness() {
      const signOut = useSignOutConfirmation(failingLogout);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, {
          testID: 'open-btn',
          onPress: signOut.openConfirm,
        } as any),
        React.createElement(SignOutConfirmModal, {
          visible: signOut.visible,
          isSigningOut: signOut.isSigningOut,
          onCancel: signOut.cancelSignOut,
          onConfirm: signOut.confirmSignOut,
        })
      );
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(React.createElement(Harness));
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'open-btn' }).props.onPress();
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'admin-signout-confirm-btn' }).props.onPress();
    });

    expect(failingLogout).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Sign Out Failed', 'Logout API error');
    // Modal stays visible and enabled so admin knows sign out failed
    const confirmBtn = renderer.root.findByProps({ testID: 'admin-signout-confirm-btn' });
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.props.disabled).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });
});
