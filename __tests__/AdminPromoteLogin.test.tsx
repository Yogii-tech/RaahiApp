import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Text } from 'react-native';

const mockSignInWithPhoneNumber = jest.fn();
const mockRecaptchaClear = jest.fn();
const mockConfirm = jest.fn();

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component: any) => component,
  captureException: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  clear: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => null),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(async () => null),
  onTokenRefresh: jest.fn(() => jest.fn()),
  requestPermission: jest.fn(async () => 1),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock('../src/services/fcmService', () => ({
  registerFCM: jest.fn(async () => ({ permission: 'granted', tokenUploaded: true })),
  unregisterFCM: jest.fn(async () => undefined),
  getWebNotificationPermission: jest.fn(() => 'granted'),
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => (typeof children === 'function' ? children({}) : children || null),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  },
}));

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));

jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
  AnimatedRegion: jest.fn(),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

jest.mock('maplibre-gl', () => ({
  Map: jest.fn(() => ({
    on: jest.fn(),
    remove: jest.fn(),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    fitBounds: jest.fn(),
  })),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
  })),
}), { virtual: true });

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}), { virtual: true });

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: '[DEFAULT]' })),
  getApps: jest.fn(() => [{ name: '[DEFAULT]' }]),
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  RecaptchaVerifier: jest.fn(() => ({ clear: mockRecaptchaClear })),
  signInWithPhoneNumber: (...args: any[]) => mockSignInWithPhoneNumber(...args),
}));

jest.mock('../src/screens/MapScreen', () => () => null);
jest.mock('../src/components/TripTrackingMap', () => () => null);

jest.mock('../src/screens/WelcomeScreen', () => {
  const ReactLocal = require('react');
  const { TouchableOpacity, Text: Txt } = require('react-native');
  return function MockWelcomeScreen(props: { onGetStarted: () => void }) {
    return ReactLocal.createElement(
      TouchableOpacity,
      { testID: 'mock-welcome-get-started', onPress: props.onGetStarted },
      ReactLocal.createElement(Txt, null, 'Get Started')
    );
  };
});

jest.mock('../src/screens/admin/AdminDashboardScreen', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  const { useAuth } = require('../src/context/AuthContext');
  return function MockAdminDashboardScreen() {
    const { user } = useAuth();
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-admin-dashboard' },
      `AdminDashboard:${user?.role || ''}:${user?.name || ''}`
    );
  };
});

import App, { resolveRootRoute } from '../App';

const findByTestId = (root: ReactTestRenderer.ReactTestInstance, testID: string) => {
  const matches = root.findAll((n) => n.props?.testID === testID);
  if (matches.length === 0) {
    throw new Error(`No node found with testID="${testID}"`);
  }
  return matches[0];
};

const findPressableByTestId = (root: ReactTestRenderer.ReactTestInstance, testID: string) => {
  const matches = root.findAll(
    (n) => n.props?.testID === testID && typeof n.props?.onPress === 'function'
  );
  if (matches.length === 0) {
    throw new Error(`No pressable node found with testID="${testID}"`);
  }
  return matches[0];
};

const queryByTestId = (root: ReactTestRenderer.ReactTestInstance, testID: string) =>
  root.findAll((n) => n.props?.testID === testID);

const collectText = (root: ReactTestRenderer.ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => {
      const ch = node.props.children;
      if (Array.isArray(ch)) return ch.join('');
      return ch == null ? '' : String(ch);
    })
    .join(' ');

describe('Admin ?admin=true Secret Promotion & Root Routing', () => {
  const originalOS = Platform.OS;
  const originalFetch = global.fetch;
  const originalWindow = (global as any).window;
  const originalDocument = (global as any).document;
  let store: Record<string, string> = {};
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  const setupWebEnv = (search = '?admin=true') => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    (global as any).window = {
      location: {
        search,
        pathname: '/',
        href: `https://goraahi.in/${search}`,
        hostname: 'goraahi.in',
      },
      history: {
        state: null,
        pushState: jest.fn((state: any) => {
          (global as any).window.history.state = state;
        }),
        replaceState: jest.fn((state: any) => {
          (global as any).window.history.state = state;
        }),
        back: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (global as any).document = {
      title: 'GoRaahi',
      getElementById: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      createElement: jest.fn(() => ({ id: '', innerHTML: '' })),
      head: { appendChild: jest.fn() },
      body: { appendChild: jest.fn() },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = {};
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store[k] ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      store[k] = v;
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (k: string) => {
      delete store[k];
    });
    (AsyncStorage.clear as jest.Mock).mockImplementation(async () => {
      store = {};
    });

    mockConfirm.mockResolvedValue({
      user: { getIdToken: async () => 'fb-id-token-123' },
    });
    mockSignInWithPhoneNumber.mockResolvedValue({
      confirm: mockConfirm,
    });
  });

  afterEach(async () => {
    if (activeRenderer) {
      const toUnmount = activeRenderer;
      activeRenderer = null;
      await act(async () => {
        toUnmount.unmount();
      });
    }
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    global.fetch = originalFetch;
    (global as any).window = originalWindow;
    (global as any).document = originalDocument;
  });

  test('resolveRootRoute routes authenticated admins directly to AdminDashboard even when user.name is empty', () => {
    expect(
      resolveRootRoute({
        isInitialLoading: false,
        isAuthenticated: true,
        welcomeDone: false,
        user: { name: '', role: 'admin' },
      })
    ).toBe('admin');

    expect(
      resolveRootRoute({
        isInitialLoading: false,
        isAuthenticated: true,
        welcomeDone: true,
        user: { name: '', role: 'passenger' },
      })
    ).toBe('login');

    expect(
      resolveRootRoute({
        isInitialLoading: false,
        isAuthenticated: true,
        welcomeDone: true,
        user: { name: 'Asha', role: '' },
      })
    ).toBe('login');

    expect(
      resolveRootRoute({
        isInitialLoading: false,
        isAuthenticated: true,
        welcomeDone: true,
        user: { name: 'Asha', role: 'passenger' },
      })
    ).toBe('main');
  });

  test('brand-new phone completes ?admin=true Step 1 -> Step 2 -> Step 3 promote-admin and enters AdminDashboardScreen', async () => {
    setupWebEnv('?admin=true');
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/firebase-verify')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              token: 'temp-jwt-new-user',
              refresh_token: 'temp-refresh-new-user',
              user: { id: 'u-new-1', phone_number: '9876543210', name: '', role: '' },
            }),
        } as any;
      }
      if (url.includes('/api/auth/promote-admin')) {
        const parsed = JSON.parse(String(init?.body || '{}'));
        if (parsed.secret_key !== 'right-secret') {
          return {
            ok: false,
            status: 401,
            text: async () => JSON.stringify({ error: 'Invalid admin secret key' }),
          } as any;
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'Successfully promoted to admin' }),
        } as any;
      }
      return { ok: true, status: 200, text: async () => '{}' } as any;
    }) as any;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      activeRenderer = renderer;
    });

    // Welcome -> LoginScreen (which immediately enters admin_phone due to ?admin=true)
    await act(async () => {
      findPressableByTestId(renderer.root, 'mock-welcome-get-started').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-phone-input').length).toBeGreaterThan(0);

    // Step 1: Enter phone & request OTP
    await act(async () => {
      findByTestId(renderer.root, 'admin-phone-input').props.onChangeText('9876543210');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-send-otp-btn').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-otp-input-0').length).toBeGreaterThan(0);

    // Step 2: Enter 6-digit OTP & verify
    await act(async () => {
      findByTestId(renderer.root, 'admin-otp-input-0').props.onChangeText('123456');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-verify-otp-btn').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-secret-input').length).toBeGreaterThan(0);

    // Wrong secret key shows backend error and stays on Step 3
    await act(async () => {
      findByTestId(renderer.root, 'admin-secret-input').props.onChangeText('wrong-key');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-promote-submit-btn').props.onPress();
    });
    expect(collectText(renderer.root)).toContain('Invalid admin secret key');
    expect(queryByTestId(renderer.root, 'mock-admin-dashboard')).toHaveLength(0);

    // Valid secret key transitions immediately to AdminDashboardScreen
    await act(async () => {
      findByTestId(renderer.root, 'admin-secret-input').props.onChangeText('right-secret');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-promote-submit-btn').props.onPress();
    });

    expect(queryByTestId(renderer.root, 'admin-secret-input')).toHaveLength(0);
    expect(collectText(findByTestId(renderer.root, 'mock-admin-dashboard'))).toBe(
      'AdminDashboard:admin:Admin'
    );
    expect(store.auth_token).toBe('temp-jwt-new-user');
    expect(JSON.parse(store.auth_user).role).toBe('admin');

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('promote-admin response with refreshed tokens/user updates stored session and enters AdminDashboardScreen', async () => {
    setupWebEnv('?admin=true');
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/api/auth/firebase-verify')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              token: 'initial-jwt',
              refresh_token: 'initial-refresh',
              user: { id: 'u-existing', phone_number: '9999988888', name: 'Existing User', role: 'passenger' },
            }),
        } as any;
      }
      if (url.includes('/api/auth/promote-admin')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              message: 'Successfully promoted to admin',
              token: 'promoted-admin-jwt',
              refresh_token: 'promoted-admin-refresh',
              user: { id: 'u-existing', phone_number: '9999988888', name: 'Existing User', role: 'admin' },
            }),
        } as any;
      }
      return { ok: true, status: 200, text: async () => '{}' } as any;
    }) as any;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      activeRenderer = renderer;
    });

    await act(async () => {
      findPressableByTestId(renderer.root, 'mock-welcome-get-started').props.onPress();
    });
    await act(async () => {
      findByTestId(renderer.root, 'admin-phone-input').props.onChangeText('9999988888');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-send-otp-btn').props.onPress();
    });
    await act(async () => {
      findByTestId(renderer.root, 'admin-otp-input-0').props.onChangeText('654321');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-verify-otp-btn').props.onPress();
    });
    await act(async () => {
      findByTestId(renderer.root, 'admin-secret-input').props.onChangeText('right-secret');
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-promote-submit-btn').props.onPress();
    });

    expect(collectText(findByTestId(renderer.root, 'mock-admin-dashboard'))).toBe(
      'AdminDashboard:admin:Existing User'
    );
    expect(store.auth_token).toBe('promoted-admin-jwt');
    expect(store.auth_refresh_token).toBe('promoted-admin-refresh');

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('restored persisted admin session with empty name enters AdminDashboardScreen directly on reload', async () => {
    setupWebEnv('?admin=true');
    store.auth_token = 'saved-admin-jwt';
    store.auth_refresh_token = 'saved-admin-refresh';
    store.auth_user = JSON.stringify({
      id: 'u-admin-empty-name',
      phone_number: '9811112222',
      name: '',
      role: 'admin',
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      activeRenderer = renderer;
    });

    expect(collectText(findByTestId(renderer.root, 'mock-admin-dashboard'))).toBe(
      'AdminDashboard:admin:'
    );

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });
});
