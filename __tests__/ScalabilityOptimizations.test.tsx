import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AppState, FlatList, Platform, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockApiRequest = jest.fn<Promise<any>, any[]>();
const mockFetchWithAuth = jest.fn<Promise<any>, any[]>();
const mockLogout = jest.fn(async () => {});
const mockNotify = jest.fn();

let mockCurrentUser: any = {
    id: 'user-1',
    name: 'Test Traveler',
    phone_number: '9999999999',
    role: 'passenger',
};

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => 'test-token'),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
    useIsFocused: () => true,
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('../src/context/ThemeContext', () => ({
    useTheme: () => ({
        isDark: true,
        colors: {
            background: '#111',
            cardColor: '#1F2937',
            borderColor: '#374151',
            textColor: '#F9FAFB',
            subtextColor: '#9CA3AF',
            primary: '#5B4FFF',
            inputFillColor: '#1F2937',
            inputBorderColor: '#374151',
        },
    }),
}));

jest.mock('../src/context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}));

jest.mock('../src/context/AuthContext', () => ({
    useAuth: () => ({
        token: 'test-token',
        refreshToken: 'test-refresh',
        user: mockCurrentUser,
        isAuthenticated: true,
        isInitialLoading: false,
        logout: mockLogout,
        setAuth: jest.fn(),
        tryRefreshToken: jest.fn(),
        fetchWithAuth: mockFetchWithAuth,
    }),
}));

jest.mock('../src/utils/api', () => ({
    apiRequest: (...args: any[]) => mockApiRequest(...args),
    getAuthSessionGeneration: () => 1,
}));

jest.mock('../src/utils/notify', () => ({
    notify: (...args: any[]) => mockNotify(...args),
    confirmAction: jest.fn(),
}));

jest.mock('../src/utils/exportUtils', () => ({
    downloadCSV: jest.fn(),
}));

jest.mock('../src/services/fcmService', () => ({
    registerFCM: jest.fn(async () => ({ permission: 'granted', tokenUploaded: true })),
    unregisterFCM: jest.fn(async () => undefined),
    getWebNotificationPermission: jest.fn(() => 'granted'),
}));

jest.mock('../src/components/BackButton', () => () => null);
jest.mock('../src/components/RaahiLogo', () => () => null);
jest.mock('../src/components/AdminChart', () => () => null);

import LocationInput, { _resetLocationSearchCacheForTests } from '../src/components/LocationInput';
import RequestsOverlay from '../src/screens/RequestsOverlay';
import ChatScreen, { CHAT_POLL_ACTIVE_MS, CHAT_POLL_IDLE_MS, CHAT_POLL_WARM_MS, getNextChatPollIntervalMs } from '../src/screens/ChatScreen';
import AdminDashboardScreen from '../src/screens/admin/AdminDashboardScreen';
import AdminDriversView from '../src/screens/admin/AdminDriversView';
import AdminVehiclesView from '../src/screens/admin/AdminVehiclesView';
import AdminAuditLogsView from '../src/screens/admin/AdminAuditLogsView';
import AdminFinanceView from '../src/screens/admin/AdminFinanceView';
import { AdminCacheProvider } from '../src/utils/adminCache';
import { createTtlCache } from '../src/utils/ttlCache';
import { useVisibilityPolling } from '../src/utils/polling';

const jsonResponse = (body: any, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const flushMicrotasks = async (cycles = 4) => {
    for (let i = 0; i < cycles; i += 1) {
        await Promise.resolve();
    }
};

describe('Frontend Scalability & Caching Optimizations', () => {
    const originalPlatformOS = Platform.OS;
    const originalDocument = (global as any).document;
    const originalWindow = (global as any).window;
    const originalFetch = (global as any).fetch;
    let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        _resetLocationSearchCacheForTests();
        mockCurrentUser = {
            id: 'user-1',
            name: 'Test Traveler',
            phone_number: '9999999999',
            role: 'passenger',
        };
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
        jest.restoreAllMocks();
        Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
        (global as any).document = originalDocument;
        (global as any).window = originalWindow;
        (global as any).fetch = originalFetch;
    });

    test('firebase.json sets immutable long-term Cache-Control before no-cache SW/HTML/JSON overrides and ignores *.js.map', () => {
        const firebaseJsonPath = path.resolve(__dirname, '../firebase.json');
        const config = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

        expect(config.hosting.ignore).toContain('**/*.js.map');

        const headers = config.hosting.headers as Array<{ source: string; headers: { key: string; value: string }[] }>;
        const staticIdx = headers.findIndex(h => h.source.includes('js|css') && h.source.includes('ttf'));
        const swIdx = headers.findIndex(h => h.source === 'firebase-messaging-sw.js');
        const htmlJsonIdx = headers.findIndex(h => h.source === '**/*.@(html|json)');

        expect(staticIdx).toBeGreaterThanOrEqual(0);
        expect(swIdx).toBeGreaterThan(staticIdx);
        expect(htmlJsonIdx).toBeGreaterThan(staticIdx);

        expect(headers[staticIdx].headers).toContainEqual({
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
        });
        expect(headers[swIdx].headers).toContainEqual({
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
        });
        expect(headers[swIdx].headers).toContainEqual({
            key: 'Service-Worker-Allowed',
            value: '/',
        });
        expect(headers[htmlJsonIdx].headers).toContainEqual({
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
        });
    });

    test('LocationInput eliminates dead /api/locations/* 404 calls, enforces min length 2, and caches /api/location/search with TTL', async () => {
        jest.useFakeTimers();
        let nowMs = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => nowMs);

        const globalFetchMock = jest.fn();
        (global as any).fetch = globalFetchMock;
        mockApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/api/location/search')) {
                return jsonResponse([
                    {
                        place_id: 'loc-champawat',
                        display_name: 'Champawat, Uttarakhand, India',
                        lat: '29.3360',
                        lon: '80.0910',
                        type: 'town',
                    },
                ]);
            }
            return jsonResponse([]);
        });

        const onChangeText = jest.fn();
        const onSelect = jest.fn();

        function LocationHarness() {
            const [val, setVal] = React.useState('');
            return (
                <LocationInput
                    label="Pickup"
                    value={val}
                    onChangeText={(next) => {
                        setVal(next);
                        onChangeText(next);
                    }}
                    onSelect={onSelect}
                />
            );
        }

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<LocationHarness />);
            await flushMicrotasks();
        });

        const input = activeRenderer!.root.findByType(TextInput);

        // Focusing empty input uses local popular recommendations without calling /api/locations/suggestions
        await act(async () => {
            input.props.onFocus();
            await flushMicrotasks();
        });
        expect(globalFetchMock).not.toHaveBeenCalled();

        // Single-char query does NOT trigger remote search
        await act(async () => {
            input.props.onChangeText('C');
            jest.advanceTimersByTime(500);
            await flushMicrotasks();
        });
        expect(mockApiRequest).not.toHaveBeenCalled();

        // Built-in local town match requires zero network calls
        await act(async () => {
            input.props.onChangeText('Almora');
            jest.advanceTimersByTime(450);
            await flushMicrotasks();
        });
        expect(mockApiRequest).not.toHaveBeenCalled();

        // Non-preset place >= 2 chars calls /api/location/search once after debounce
        await act(async () => {
            input.props.onChangeText('Champawat');
            jest.advanceTimersByTime(380);
            await flushMicrotasks();
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
        expect(mockApiRequest.mock.calls[0][0]).toContain('/api/location/search?q=');

        // Selecting suggestion never calls removed /api/locations/record endpoint
        const optionBtn = activeRenderer!.root.findAllByType(TouchableOpacity).find(btn =>
            btn.findAll(n => n.props?.children === 'Champawat').length > 0
        );
        expect(optionBtn).toBeDefined();
        await act(async () => {
            optionBtn!.props.onPress();
            await flushMicrotasks();
        });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(globalFetchMock).not.toHaveBeenCalled();

        // Re-typing same query within TTL hits client cache (0 extra backend calls)
        await act(async () => {
            input.props.onChangeText('champawat');
            jest.advanceTimersByTime(450);
            await flushMicrotasks();
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(1);

        // Advancing past 5 minute TTL expires cache entry and re-fetches once
        nowMs += 5 * 60 * 1000 + 1;
        await act(async () => {
            input.props.onChangeText('Champawat');
            jest.advanceTimersByTime(450);
            await flushMicrotasks();
        });
        expect(mockApiRequest).toHaveBeenCalledTimes(2);
    });

    test('RequestsOverlay uses batch PUT /api/notifications/read-all instead of N+1 per-item PUTs and polls at 10s only while visible', async () => {
        jest.useFakeTimers();
        const visibilityListeners = new Set<() => void>();
        let visibilityState: 'visible' | 'hidden' = 'visible';

        Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
        (global as any).document = {
            get visibilityState() {
                return visibilityState;
            },
            addEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'visibilitychange') visibilityListeners.add(cb);
            }),
            removeEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'visibilitychange') visibilityListeners.delete(cb);
            }),
        };
        (global as any).window = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };

        mockApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/api/notifications/') {
                return jsonResponse([
                    { id: 'n1', title: 'Doc 1', message: 'Approved', read: false, createdAt: new Date().toISOString() },
                    { id: 'n2', title: 'Doc 2', message: 'Pending', read: false, createdAt: new Date().toISOString() },
                    { id: 'n3', title: 'Doc 3', message: 'Info', read: false, createdAt: new Date().toISOString() },
                ]);
            }
            if (endpoint === '/api/notifications/read-all') {
                return jsonResponse({ modifiedCount: 3 });
            }
            return jsonResponse([]);
        });

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(
                <RequestsOverlay onClose={jest.fn()} onOpenChat={jest.fn()} />
            );
            await flushMicrotasks(6);
        });

        // Batch read-all once instead of 3 individual PUT /api/notifications/:id/read calls
        const readAllCalls = mockApiRequest.mock.calls.filter(([ep]) => ep === '/api/notifications/read-all');
        const perIdReadCalls = mockApiRequest.mock.calls.filter(([ep]) => /\/api\/notifications\/[^/]+\/read$/.test(String(ep)));
        expect(readAllCalls).toHaveLength(1);
        expect(readAllCalls[0][1]).toEqual({ method: 'PUT' });
        expect(perIdReadCalls).toHaveLength(0);

        const pollCountAt5sBefore = mockApiRequest.mock.calls.filter(([ep]) => ep === '/api/rides/bookings').length;
        expect(pollCountAt5sBefore).toBe(1);

        // No poll at 5s (moved from 5s -> 10s), polls at 10s
        await act(async () => {
            jest.advanceTimersByTime(5000);
            await flushMicrotasks();
        });
        expect(mockApiRequest.mock.calls.filter(([ep]) => ep === '/api/rides/bookings').length).toBe(1);

        await act(async () => {
            jest.advanceTimersByTime(5000);
            await flushMicrotasks();
        });
        expect(mockApiRequest.mock.calls.filter(([ep]) => ep === '/api/rides/bookings').length).toBe(2);

        // Hide tab -> pauses completely (0 requests during 30s hidden)
        await act(async () => {
            visibilityState = 'hidden';
            visibilityListeners.forEach(cb => cb());
            jest.advanceTimersByTime(30000);
            await flushMicrotasks();
        });
        expect(mockApiRequest.mock.calls.filter(([ep]) => ep === '/api/rides/bookings').length).toBe(2);
    });

    test('useVisibilityPolling pauses when hidden/backgrounded and applies >= 5s cooldown across rapid visibility + focus flips', async () => {
        jest.useFakeTimers();
        let nowMs = 5_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => nowMs);

        const visibilityListeners = new Set<() => void>();
        const focusListeners = new Set<() => void>();
        let visibilityState: 'visible' | 'hidden' = 'visible';

        Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
        (global as any).document = {
            get visibilityState() {
                return visibilityState;
            },
            addEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'visibilitychange') visibilityListeners.add(cb);
            }),
            removeEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'visibilitychange') visibilityListeners.delete(cb);
            }),
        };
        (global as any).window = {
            addEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'focus') focusListeners.add(cb);
            }),
            removeEventListener: jest.fn((event: string, cb: () => void) => {
                if (event === 'focus') focusListeners.delete(cb);
            }),
        };

        const onPoll = jest.fn(async () => undefined);
        const onPause = jest.fn();

        function Harness({ enabled }: { enabled: boolean }) {
            useVisibilityPolling({
                enabled,
                intervalMs: 10000,
                resumeCooldownMs: 5000,
                onPoll,
                onPause,
            });
            return null;
        }

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<Harness enabled />);
            await flushMicrotasks();
        });
        expect(onPoll).toHaveBeenCalledTimes(1);

        // Hide tab -> onPause called, 0 polls for 60s
        await act(async () => {
            visibilityState = 'hidden';
            visibilityListeners.forEach(cb => cb());
            nowMs += 2000;
            jest.advanceTimersByTime(60000);
            await flushMicrotasks();
        });
        expect(onPause).toHaveBeenCalled();
        expect(onPoll).toHaveBeenCalledTimes(1);

        // Rapid return (2s elapsed < 5s cooldown) firing visibilitychange + focus must NOT burst immediately
        await act(async () => {
            visibilityState = 'visible';
            visibilityListeners.forEach(cb => cb());
            focusListeners.forEach(cb => cb());
            await flushMicrotasks();
        });
        expect(onPoll).toHaveBeenCalledTimes(1);

        // Hide again and wait >= 5s before returning -> fires exactly ONE resume poll even when visibility + focus both fire
        await act(async () => {
            visibilityState = 'hidden';
            visibilityListeners.forEach(cb => cb());
            await flushMicrotasks();
        });
        nowMs += 6000;
        await act(async () => {
            visibilityState = 'visible';
            visibilityListeners.forEach(cb => cb());
            focusListeners.forEach(cb => cb());
            await flushMicrotasks();
        });
        expect(onPoll).toHaveBeenCalledTimes(2);
    });

    test('ChatScreen backs off polling adaptively (4s -> 8s -> 15s) when idle, pauses when hidden, and resets to 4s on new messages', async () => {
        expect(getNextChatPollIntervalMs(0)).toBe(CHAT_POLL_ACTIVE_MS);
        expect(getNextChatPollIntervalMs(1)).toBe(CHAT_POLL_WARM_MS);
        expect(getNextChatPollIntervalMs(2)).toBe(CHAT_POLL_WARM_MS);
        expect(getNextChatPollIntervalMs(3)).toBe(CHAT_POLL_IDLE_MS);

        jest.useFakeTimers();
        let appStateListener: ((state: any) => void) | undefined;
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
            appStateListener = handler;
            return { remove: jest.fn() } as any;
        });
        let messagesPayload = [
            { id: 'm1', text: 'Hello', senderId: 'other-user', role: 'driver', createdAt: '2026-11-16T10:00:00Z' },
        ];

        mockApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/api/chat/booking-1') {
                return jsonResponse(messagesPayload);
            }
            return jsonResponse({ ok: true });
        });

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(
                <ChatScreen
                    bookingId="booking-1"
                    recipientName="Driver"
                    pickup="Kotdwar"
                    dropoff="Pauri"
                    departureTime="08:00 AM"
                    onBack={jest.fn()}
                />
            );
            await flushMicrotasks(8);
        });

        const getChatCalls = () =>
            mockApiRequest.mock.calls.filter(([ep, init]) => ep === '/api/chat/booking-1' && (!init?.method || init.method === 'GET')).length;

        expect(getChatCalls()).toBe(1);

        // First active interval: 4s (returns identical message -> bumps next delay to 8s)
        await act(async () => {
            jest.advanceTimersByTime(4000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(2);

        // At +4s (8s total since last poll wouldn't fire yet -> should STILL be 2!)
        await act(async () => {
            jest.advanceTimersByTime(4000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(2);

        // After full 8s -> poll 3 fires (still unchanged -> bumps to 8s)
        await act(async () => {
            jest.advanceTimersByTime(4000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(3);

        // Poll 4 after 8s -> still unchanged -> bumps to 15s idle
        await act(async () => {
            jest.advanceTimersByTime(8000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(4);

        // Advancing 8s should NOT poll yet because interval backed off to 15s
        await act(async () => {
            jest.advanceTimersByTime(8000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(4);

        // Simulate new incoming message on the 15s poll (+7s) -> resets interval back to 4s
        messagesPayload = [
            ...messagesPayload,
            { id: 'm2', text: 'On my way', senderId: 'other-user', role: 'driver', createdAt: '2026-11-16T10:01:00Z' },
        ];
        await act(async () => {
            jest.advanceTimersByTime(7000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(5);

        // Next poll fires at 4s because new message reset active cadence
        await act(async () => {
            jest.advanceTimersByTime(4000);
            await flushMicrotasks(6);
        });
        expect(getChatCalls()).toBe(6);

        // Native AppState background pauses polling completely (0 requests across 30s)
        const prevAppState = AppState.currentState;
        Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
        await act(async () => {
            appStateListener?.('background');
            jest.advanceTimersByTime(30000);
            await flushMicrotasks(8);
        });
        expect(getChatCalls()).toBe(6);
        Object.defineProperty(AppState, 'currentState', { value: prevAppState, configurable: true });
    });

    test('AdminCacheProvider deduplicates /api/admin/drivers across Drivers and Vehicles tabs while avoiding nested vertical ScrollViews around FlatLists', async () => {
        mockFetchWithAuth.mockImplementation(async (url: string) => {
            if (url.includes('/api/admin/drivers')) {
                return jsonResponse([
                    {
                        id: 'd1',
                        name: 'Suresh Bisht',
                        phone: '9811112222',
                        verificationStatus: 'pending',
                        vehicleName: 'Bolero',
                        vehicleNumber: 'UK07AA1234',
                    },
                ]);
            }
            if (url.includes('/api/admin/rides')) {
                return jsonResponse([
                    { id: 'r1', driver: 'Suresh', pricePerSeat: 200, seatsBooked: 2, status: 'completed' },
                ]);
            }
            if (url.includes('/api/admin/stats')) {
                return jsonResponse({
                    rides: { total: 1, available: 0, completed: 1, cancelled: 0 },
                    bookings: { total: 1, pending: 0 },
                    users: { total: 1, drivers: 1 },
                    routes: 1,
                    monthlyTrend: [],
                });
            }
            if (url.includes('/api/notifications/unread-count')) {
                return jsonResponse({ unreadCount: 0 });
            }
            return jsonResponse([]);
        });

        function AdminHarness({ tab }: { tab: 'drivers' | 'vehicles' | 'audit' | 'finance' }) {
            return (
                <AdminCacheProvider scopeKey="admin-jwt">
                    {tab === 'drivers' && <AdminDriversView token="admin-jwt" initialFilter="pending" />}
                    {tab === 'vehicles' && <AdminVehiclesView token="admin-jwt" isDark />}
                    {tab === 'audit' && <AdminAuditLogsView isDark />}
                    {tab === 'finance' && <AdminFinanceView token="admin-jwt" isDark />}
                </AdminCacheProvider>
            );
        }

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<AdminHarness tab="drivers" />);
            await flushMicrotasks(6);
        });
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);

        // Switching to Vehicles reuses cached /api/admin/drivers within 30s TTL
        await act(async () => {
            activeRenderer!.update(<AdminHarness tab="vehicles" />);
            await flushMicrotasks(6);
        });
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);

        // Verify FlatList views have zero outer vertical ScrollView ancestor in Audit, Vehicles, and Finance
        const assertNoFlatListInsideVerticalScrollView = (tab: 'audit' | 'vehicles' | 'finance') => {
            const verticalScrollViews = activeRenderer!.root
                .findAllByType(ScrollView)
                .filter(sv => !sv.props?.horizontal);
            for (const sv of verticalScrollViews) {
                expect(sv.findAllByType(FlatList)).toHaveLength(0);
            }
            expect(activeRenderer!.root.findAllByType(FlatList).length).toBeGreaterThan(0);
            return tab;
        };

        assertNoFlatListInsideVerticalScrollView('vehicles');

        await act(async () => {
            activeRenderer!.update(<AdminHarness tab="audit" />);
            await flushMicrotasks(4);
        });
        assertNoFlatListInsideVerticalScrollView('audit');

        await act(async () => {
            activeRenderer!.update(<AdminHarness tab="finance" />);
            await flushMicrotasks(6);
        });
        assertNoFlatListInsideVerticalScrollView('finance');

        // Also check AdminDashboardScreen wrapper doesn't wrap page content in a vertical ScrollView
        await act(async () => {
            activeRenderer!.update(<AdminDashboardScreen />);
            await flushMicrotasks(4);
        });
        const dashboardVerticalScrollViews = activeRenderer!.root
            .findAllByType(ScrollView)
            .filter(sv => !sv.props?.horizontal);
        for (const sv of dashboardVerticalScrollViews) {
            expect(sv.findAllByType(FlatList)).toHaveLength(0);
        }
    });

    test('Switching admin tabs mid-flight does not abort shared AdminCacheProvider fetch and populates newly mounted view', async () => {
        let resolveDriversFetch!: (res: any) => void;
        let capturedSignal: AbortSignal | undefined;

        mockFetchWithAuth.mockImplementation((url: string, init?: RequestInit) => {
            if (url.includes('/api/admin/drivers')) {
                capturedSignal = init?.signal as AbortSignal | undefined;
                return new Promise((resolve) => {
                    resolveDriversFetch = resolve;
                });
            }
            return Promise.resolve(jsonResponse([]));
        });

        function SwitchHarness({ tab }: { tab: 'drivers' | 'vehicles' }) {
            return (
                <AdminCacheProvider scopeKey="admin-jwt">
                    {tab === 'drivers' && <AdminDriversView token="admin-jwt" initialFilter="pending" />}
                    {tab === 'vehicles' && <AdminVehiclesView token="admin-jwt" isDark />}
                </AdminCacheProvider>
            );
        }

        // Start fetch in AdminDriversView
        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<SwitchHarness tab="drivers" />);
            await flushMicrotasks(2);
        });
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);
        expect(capturedSignal?.aborted).toBe(false);

        // Unmount AdminDriversView and mount AdminVehiclesView BEFORE the fetch settles
        await act(async () => {
            activeRenderer!.update(<SwitchHarness tab="vehicles" />);
            await flushMicrotasks(2);
        });
        expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);
        expect(capturedSignal?.aborted).toBe(false);

        // Settle the shared request -> AdminVehiclesView must populate cleanly
        await act(async () => {
            resolveDriversFetch(jsonResponse([
                {
                    id: 'd-99',
                    name: 'Mohan Negi',
                    phone: '9999999999',
                    verificationStatus: 'verified',
                    vehicleName: 'Swift Dzire',
                    vehicleNumber: 'UK07AB1234',
                },
            ]));
            await flushMicrotasks(8);
        });

        const renderedText = activeRenderer!.root
            .findAllByType(Text)
            .map(node => node.props.children)
            .flat()
            .join(' ');
        expect(renderedText).toContain('Swift Dzire');
        expect(renderedText).toContain('UK07AB1234');
        expect(renderedText).not.toContain('Refresh failed');
    });

    test('TtlCache prevents stale in-flight fetches from overwriting cache after invalidatePrefix, force refresh, or clear', async () => {
        const cache = createTtlCache<string>({ maxEntries: 10, ttlMs: 30_000 });

        // 1. Invalidate while slow fetch is in-flight
        let resolveSlow1!: (val: string) => void;
        const slow1 = cache.getOrFetch(
            'admin:drivers',
            () => new Promise<string>((resolve) => { resolveSlow1 = resolve; })
        );
        cache.invalidatePrefix('admin:');
        resolveSlow1('stale-after-invalidate');
        expect(await slow1).toBe('stale-after-invalidate');
        expect(cache.get('admin:drivers')).toBeUndefined();

        // 2. Slower older fetch displaced by force:true fast fetch must NOT overwrite fresh entry
        let resolveSlow2!: (val: string) => void;
        let resolveFast2!: (val: string) => void;
        const slow2 = cache.getOrFetch(
            'admin:drivers',
            () => new Promise<string>((resolve) => { resolveSlow2 = resolve; })
        );
        const fast2 = cache.getOrFetch(
            'admin:drivers',
            () => new Promise<string>((resolve) => { resolveFast2 = resolve; }),
            { force: true }
        );
        resolveFast2('fresh-value');
        expect(await fast2).toBe('fresh-value');
        expect(cache.get('admin:drivers')).toBe('fresh-value');

        resolveSlow2('stale-slow-value');
        expect(await slow2).toBe('stale-slow-value');
        expect(cache.get('admin:drivers')).toBe('fresh-value');

        // 3. Clear while fetch is in-flight
        let resolvePreClear!: (val: string) => void;
        const preClear = cache.getOrFetch(
            'admin:drivers',
            () => new Promise<string>((resolve) => { resolvePreClear = resolve; }),
            { force: true }
        );
        cache.clear();
        resolvePreClear('stale-pre-clear');
        expect(await preClear).toBe('stale-pre-clear');
        expect(cache.get('admin:drivers')).toBeUndefined();
    });

    test('AdminCacheProvider rotates scope synchronously before child mount fetches when scopeKey changes', async () => {
        const resolvers: Array<(res: any) => void> = [];
        const signals: Array<AbortSignal | undefined> = [];

        mockFetchWithAuth.mockImplementation((url: string, init?: RequestInit) => {
            if (url.includes('/api/admin/drivers')) {
                signals.push(init?.signal as AbortSignal | undefined);
                return new Promise((resolve) => {
                    resolvers.push(resolve);
                });
            }
            return Promise.resolve(jsonResponse([]));
        });

        function ScopedHarness({ scopeKey, mountId }: { scopeKey: string; mountId: number }) {
            return (
                <AdminCacheProvider scopeKey={scopeKey}>
                    <AdminVehiclesView key={mountId} token="jwt" isDark />
                </AdminCacheProvider>
            );
        }

        await act(async () => {
            activeRenderer = ReactTestRenderer.create(<ScopedHarness scopeKey="user:admin-1" mountId={1} />);
            await flushMicrotasks(2);
        });
        expect(signals).toHaveLength(1);
        expect(signals[0]?.aborted).toBe(false);

        // Switching scopeKey AND mounting a fresh child in the same commit must abort
        // the old scope's fetch and pass an active (non-aborted) signal to the new fetch.
        await act(async () => {
            activeRenderer!.update(<ScopedHarness scopeKey="user:admin-2" mountId={2} />);
            await flushMicrotasks(2);
        });
        expect(signals).toHaveLength(2);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(false);

        // Stale user:admin-1 response settles -> ignored; user:admin-2 settles -> rendered
        await act(async () => {
            resolvers[0](jsonResponse([
                {
                    id: 'old-drv',
                    name: 'Old Admin Driver',
                    phone: '1111111111',
                    verificationStatus: 'verified',
                    vehicleName: 'Old Car',
                    vehicleNumber: 'UK01AA0001',
                },
            ]));
            resolvers[1](jsonResponse([
                {
                    id: 'new-drv',
                    name: 'New Admin Driver',
                    phone: '2222222222',
                    verificationStatus: 'verified',
                    vehicleName: 'Innova Crysta',
                    vehicleNumber: 'UK07XY9999',
                },
            ]));
            await flushMicrotasks(8);
        });

        const renderedText = activeRenderer!.root
            .findAllByType(Text)
            .map(node => node.props.children)
            .flat()
            .join(' ');
        expect(renderedText).toContain('Innova Crysta');
        expect(renderedText).toContain('UK07XY9999');
        expect(renderedText).not.toContain('Old Car');
    });
});
