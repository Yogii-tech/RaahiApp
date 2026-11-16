import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockApiRequest = jest.fn<Promise<any>, any[]>(async () => ({
    ok: true,
    status: 200,
    text: async () => '[]',
    json: async () => [],
}));

let mockTabStateHandler: ((e: any) => void) | undefined;
let mockHomeProps: any = {};

jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    wrap: (component: any) => component,
    captureException: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => 'token-1'),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: any) => children,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: () => ({
        Navigator: ({ children, screenListeners }: any) => {
            mockTabStateHandler = screenListeners?.state;
            return children;
        },
        Screen: ({ name, children }: any) => {
            if (name === 'Home' && typeof children === 'function') {
                return children({});
            }
            return null;
        },
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

jest.mock('react-native-screens', () => ({ enableScreens: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

jest.mock('../src/services/fcmService', () => ({
    registerFCM: jest.fn(async () => ({ permission: 'granted', tokenUploaded: true })),
    unregisterFCM: jest.fn(async () => undefined),
}));

jest.mock('../src/context/AuthContext', () => ({
    AuthProvider: ({ children }: any) => children,
    useAuth: () => ({
        token: 'token-1',
        refreshToken: 'refresh-1',
        user: { id: 'u1', name: 'Asha', role: 'passenger' },
        isAuthenticated: true,
        isInitialLoading: false,
        logout: jest.fn(async () => {}),
    }),
}));

jest.mock('../src/context/ThemeContext', () => ({
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({
        isDark: false,
        toggleTheme: jest.fn(),
        colors: {
            background: '#FFF',
            cardColor: '#FFF',
            borderColor: '#EEE',
            textColor: '#111',
            subtextColor: '#666',
            primary: '#5B4FFF',
        },
    }),
}));

jest.mock('../src/context/LanguageContext', () => ({
    LanguageProvider: ({ children }: any) => children,
    useLanguage: () => ({ t: (k: string) => k }),
}));

jest.mock('../src/utils/api', () => ({
    apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.mock('../src/screens/HomeScreen', () => {
    const ReactLocal = require('react');
    return function MockHomeScreen(props: any) {
        mockHomeProps = props;
        return ReactLocal.createElement('View', { testID: 'mock-home' });
    };
});

jest.mock('../src/screens/TripsScreen', () => () => null);
jest.mock('../src/screens/AccountScreen', () => () => null);
jest.mock('../src/screens/LoginScreen', () => () => null);
jest.mock('../src/screens/WelcomeScreen', () => () => null);
jest.mock('../src/screens/admin/AdminDashboardScreen', () => () => null);
jest.mock('../src/screens/RequestsOverlay', () => () => null);
jest.mock('../src/screens/ChatScreen', () => () => null);
jest.mock('../src/screens/ResubmitDocsView', () => () => null);
jest.mock('../src/components/BrandLogo', () => () => null);

import { MAIN_TABS_POLL_INTERVAL_MS, MainTabs, shouldMainTabsPoll } from '../App';

const flushMicrotasks = async (cycles = 4) => {
    for (let i = 0; i < cycles; i += 1) {
        await Promise.resolve();
    }
};

describe('MainTabs Polling Suspension & Interval Scaling', () => {
    let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        mockTabStateHandler = undefined;
        mockHomeProps = {};
    });

    afterEach(async () => {
        if (activeRenderer) {
            const toUnmount = activeRenderer;
            activeRenderer = null;
            await act(async () => {
                toUnmount.unmount();
            });
        }
        jest.useRealTimers();
    });

    test('shouldMainTabsPoll suspends whenever Trips, History, BookRideScreen, RequestsOverlay, or ChatScreen owns polling', () => {
        expect(MAIN_TABS_POLL_INTERVAL_MS).toBe(25000);

        const base = {
            token: 't1',
            notificationsVisible: false,
            activeChat: false,
            rekycVisible: false,
            bookRideActive: false,
            currentRoute: 'Home',
            isParcelModeActive: false,
        };

        expect(shouldMainTabsPoll(base)).toBe(true);
        expect(shouldMainTabsPoll({ ...base, token: null })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, notificationsVisible: true })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, activeChat: true })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, bookRideActive: true })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, currentRoute: 'Trips' })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, currentRoute: 'History' })).toBe(false);
        expect(shouldMainTabsPoll({ ...base, currentRoute: 'Trips', isParcelModeActive: true })).toBe(true);
        expect(shouldMainTabsPoll({ ...base, currentRoute: 'Account' })).toBe(true);
    });

    test('MainTabs polls every 25s on Home and immediately suspends when BookRideScreen or Trips/History activates', async () => {
        jest.useFakeTimers();

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<MainTabs />);
            await flushMicrotasks(6);
        });

        // Initial poll: 1x bookings + 1x notifications
        expect(mockApiRequest).toHaveBeenCalledTimes(2);

        // Old 10s mark triggers 0 requests
        await act(async () => {
            jest.advanceTimersByTime(10000);
            await flushMicrotasks(4);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(2);

        // 25s interval fires 2nd cycle
        await act(async () => {
            jest.advanceTimersByTime(15000);
            await flushMicrotasks(6);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(4);

        // Entering BookRideScreen commits suspension before time advances -> 0 requests for 60s
        await act(async () => {
            mockHomeProps.onBookRideActiveChange?.(true);
        });
        await act(async () => {
            jest.advanceTimersByTime(60000);
            await flushMicrotasks(8);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(4);

        // Switching directly from BookRideScreen into Trips keeps MainTabs polling suspended
        await act(async () => {
            mockHomeProps.onBookRideActiveChange?.(false);
            mockTabStateHandler?.({ data: { state: { index: 1, routes: [{ name: 'Home' }, { name: 'Trips' }] } } });
        });
        await act(async () => {
            jest.advanceTimersByTime(60000);
            await flushMicrotasks(8);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(4);

        // Returning to Home after suspension (> 5s cooldown) triggers 1 resume sync and restores 25s cadence
        await act(async () => {
            mockTabStateHandler?.({ data: { state: { index: 0, routes: [{ name: 'Home' }, { name: 'Trips' }] } } });
        });
        await act(async () => {
            await flushMicrotasks(8);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(6);

        await act(async () => {
            jest.advanceTimersByTime(24999);
            await flushMicrotasks(4);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(6);

        await act(async () => {
            jest.advanceTimersByTime(1);
            await flushMicrotasks(8);
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(8);
    });
});
