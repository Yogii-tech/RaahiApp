import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGetTokenWeb = jest.fn(async (..._args: any[]) => 'web-fcm-token-123');
const mockOnMessageWeb = jest.fn((..._args: any[]) => jest.fn());
const mockIsSupportedWeb = jest.fn(async (..._args: any[]) => true);
const mockGetMessagingWeb = jest.fn((..._args: any[]) => ({ app: 'mock-web-app' }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: '[DEFAULT]' })),
  getApps: jest.fn(() => [{ name: '[DEFAULT]' }]),
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('firebase/messaging', () => ({
  getMessaging: (...args: any[]) => mockGetMessagingWeb(...args),
  isSupported: (...args: any[]) => mockIsSupportedWeb(...args),
  getToken: (...args: any[]) => mockGetTokenWeb(...args),
  onMessage: (...args: any[]) => mockOnMessageWeb(...args),
}));

const mockNativeGetToken = jest.fn(async (..._args: any[]) => 'native-fcm-token-456');
const mockNativeOnMessage = jest.fn((..._args: any[]) => jest.fn());
const mockNativeOnOpened = jest.fn((..._args: any[]) => jest.fn());
const mockNativeGetInitial = jest.fn(async (..._args: any[]): Promise<any> => null);
const mockNativeOnTokenRefresh = jest.fn((..._args: any[]) => jest.fn());
const mockNativeRequestPerm = jest.fn(async (..._args: any[]) => 1);

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  getMessaging: jest.fn(() => ({})),
  getToken: (...args: any[]) => mockNativeGetToken(...args),
  onMessage: (...args: any[]) => mockNativeOnMessage(...args),
  onNotificationOpenedApp: (...args: any[]) => mockNativeOnOpened(...args),
  getInitialNotification: (...args: any[]) => mockNativeGetInitial(...args),
  onTokenRefresh: (...args: any[]) => mockNativeOnTokenRefresh(...args),
  requestPermission: (...args: any[]) => mockNativeRequestPerm(...args),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
}));

import {
  getWebNotificationPermission,
  registerFCM,
  unregisterFCM,
} from '../src/services/fcmService';
import { bumpAuthSessionGeneration } from '../src/utils/api';

describe('fcmService Admin Web & Native Integration', () => {
  const originalOS = Platform.OS;
  const originalFetch = global.fetch;
  const originalWindow = (global as any).window;
  const originalNavigator = (global as any).navigator;
  const originalNotification = (global as any).Notification;

  let swMessageListeners: Array<(event: any) => void> = [];

  const setupWebGlobals = (permission: NotificationPermission = 'default') => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    swMessageListeners = [];
    const mockSwRegistration = {
      scope: '/',
      waiting: null,
      update: jest.fn(async () => undefined),
      showNotification: jest.fn(async () => undefined),
    };
    const mockNotificationCtor: any = jest.fn();
    mockNotificationCtor.permission = permission;
    mockNotificationCtor.requestPermission = jest.fn(async () => {
      mockNotificationCtor.permission = 'granted';
      return 'granted';
    });

    (global as any).window = (global as any).window || {};
    (global as any).Notification = mockNotificationCtor;
    (global as any).navigator = {
      serviceWorker: {
        register: jest.fn(async () => mockSwRegistration),
        ready: Promise.resolve(mockSwRegistration),
        addEventListener: jest.fn((evt: string, cb: (event: any) => void) => {
          if (evt === 'message') swMessageListeners.push(cb);
        }),
      },
    };
    return { mockNotificationCtor, mockSwRegistration };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bumpAuthSessionGeneration();
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{}',
    })) as any;
  });

  afterEach(async () => {
    await unregisterFCM();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    global.fetch = originalFetch;
    (global as any).window = originalWindow;
    (global as any).navigator = originalNavigator;
    (global as any).Notification = originalNotification;
  });

  test('getWebNotificationPermission returns unsupported on native and mirrors Notification.permission on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(getWebNotificationPermission()).toBe('unsupported');

    setupWebGlobals('default');
    expect(getWebNotificationPermission()).toBe('default');

    (global as any).Notification.permission = 'granted';
    expect(getWebNotificationPermission()).toBe('granted');
  });

  test('Web registerFCM with promptIfDefault=false does not prompt when permission is default, yet relays SW events', async () => {
    const { mockNotificationCtor } = setupWebGlobals('default');
    const onNavigate = jest.fn();
    const onForeground = jest.fn();
    const onPushReceived = jest.fn();

    const result = await registerFCM('admin-jwt', onNavigate, {
      promptIfDefault: false,
      onForegroundMessage: onForeground,
      onPushReceived,
    });

    expect(result).toEqual({ permission: 'default', tokenUploaded: false });
    expect(mockNotificationCtor.requestPermission).not.toHaveBeenCalled();
    expect(swMessageListeners.length).toBeGreaterThanOrEqual(1);

    // Simulate SW messages relayed to the open tab
    const listener = swMessageListeners[swMessageListeners.length - 1];
    listener({
      data: {
        type: 'PUSH_RECEIVED',
        data: { type: 'booking_created', targetView: 'bookings', notificationId: 'n-1' },
      },
    });
    expect(onPushReceived).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'booking_created', notificationId: 'n-1' })
    );

    listener({
      data: {
        type: 'NOTIFICATION_CLICK',
        data: { type: 'driver_kyc_submitted', targetView: 'driver_verification', relatedId: 'drv-1' },
      },
    });
    expect(onNavigate).toHaveBeenCalledWith(
      'driver_kyc_submitted',
      expect.objectContaining({ targetView: 'driver_verification', relatedId: 'drv-1' })
    );
  });

  test('Web registerFCM uploads token when granted, deduplicates foreground pushes, and calls onForegroundMessage', async () => {
    const { mockNotificationCtor, mockSwRegistration } = setupWebGlobals('default');
    const onNavigate = jest.fn();
    const onForeground = jest.fn();
    const onPushReceived = jest.fn();

    const result = await registerFCM('admin-jwt', onNavigate, {
      promptIfDefault: true,
      onForegroundMessage: onForeground,
      onPushReceived,
    });

    expect(mockNotificationCtor.requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ permission: 'granted', tokenUploaded: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/fcm-token'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ fcmToken: 'web-fcm-token-123' }),
      })
    );

    // Trigger foreground onMessage twice with the same notificationId -> deduplicated
    const onMsgCalls = mockOnMessageWeb.mock.calls as any[][];
    const foregroundCb = onMsgCalls[0]?.[1];
    expect(typeof foregroundCb).toBe('function');

    foregroundCb({
      messageId: 'msg-1',
      notification: { title: 'New KYC Submission', body: 'Driver Ramesh submitted documents' },
      data: {
        type: 'driver_kyc_submitted',
        targetView: 'driver_verification',
        notificationId: 'notif-1',
        relatedId: 'drv-99',
      },
    });
    foregroundCb({
      messageId: 'msg-1',
      notification: { title: 'New KYC Submission', body: 'Driver Ramesh submitted documents' },
      data: {
        type: 'driver_kyc_submitted',
        targetView: 'driver_verification',
        notificationId: 'notif-1',
        relatedId: 'drv-99',
      },
    });

    expect(onForeground).toHaveBeenCalledTimes(1);
    expect(onForeground).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New KYC Submission',
        body: 'Driver Ramesh submitted documents',
        type: 'driver_kyc_submitted',
        targetView: 'driver_verification',
        notificationId: 'notif-1',
      })
    );
    expect(onPushReceived).toHaveBeenCalledTimes(1);
    // Does not hijack navigation or show duplicate OS notification while admin toast handles it
    expect(onNavigate).not.toHaveBeenCalled();
    expect(mockSwRegistration.showNotification).not.toHaveBeenCalled();
  });

  test('Native registerFCM invokes onForegroundMessage without forced navigation, and navigates on background/cold-start tap', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    mockNativeGetInitial.mockResolvedValueOnce({
      messageId: 'cold-1',
      data: { type: 'parcel_created', targetView: 'parcels', relatedId: 'p-1', notificationId: 'n-p1' },
    });

    const onNavigate = jest.fn();
    const onForeground = jest.fn();
    const onPushReceived = jest.fn();

    const result = await registerFCM('admin-jwt', onNavigate, {
      onForegroundMessage: onForeground,
      onPushReceived,
    });

    expect(result.tokenUploaded).toBe(true);
    // Cold-start tap navigates immediately
    expect(onNavigate).toHaveBeenCalledWith(
      'parcel_created',
      expect.objectContaining({ targetView: 'parcels', relatedId: 'p-1' })
    );

    // Foreground native message triggers toast/refresh, not navigation
    onNavigate.mockClear();
    const fgCalls = mockNativeOnMessage.mock.calls as any[][];
    const nativeFgCb = fgCalls[0]?.[1];
    await nativeFgCb({
      messageId: 'fg-1',
      notification: { title: 'Booking Created', body: 'Passenger booked 2 seats' },
      data: { type: 'booking_created', targetView: 'bookings', notificationId: 'n-b1' },
    });
    expect(onForeground).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Booking Created', type: 'booking_created' })
    );
    expect(onPushReceived).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();

    // Background tap navigates immediately
    const openedCalls = mockNativeOnOpened.mock.calls as any[][];
    const nativeOpenedCb = openedCalls[0]?.[1];
    nativeOpenedCb({
      messageId: 'bg-1',
      data: { type: 'ride_cancelled', targetView: 'cancelled_rides', relatedId: 'r-5' },
    });
    expect(onNavigate).toHaveBeenCalledWith(
      'ride_cancelled',
      expect.objectContaining({ targetView: 'cancelled_rides', relatedId: 'r-5' })
    );
  });

  test('unregisterFCM deduplicates concurrent calls and removes token from backend once', async () => {
    setupWebGlobals('granted');
    await registerFCM('admin-jwt', jest.fn(), { promptIfDefault: false });
    (global.fetch as jest.Mock).mockClear();

    await Promise.all([unregisterFCM('admin-jwt'), unregisterFCM('admin-jwt')]);

    const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([, init]) => init?.method === 'DELETE'
    );
    expect(deleteCalls).toHaveLength(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('active_fcm_token');
  });
});
