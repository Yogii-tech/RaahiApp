import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Dimensions, Platform, Text } from 'react-native';

const mockLogout = jest.fn<Promise<void>, []>(async () => {});
const mockFetchWithAuth = jest.fn<Promise<any>, [string, RequestInit?]>();
const mockNotify = jest.fn((..._args: any[]) => undefined);
const mockConfirmAction = jest.fn((...args: any[]) => {
  const onConfirm = args[2];
  if (typeof onConfirm === 'function') onConfirm();
});

let capturedFcmCallbacks: {
  onNavigate?: (type: string, data: any) => void;
  onForegroundMessage?: (payload: any) => void;
  onPushReceived?: (payload: any) => void;
  promptIfDefault?: boolean;
} = {};
const mockRegisterFCM = jest.fn(async (...args: any[]) => {
  const onNavigate = args[1];
  const options = args[2] || {};
  capturedFcmCallbacks = {
    onNavigate,
    onForegroundMessage: options?.onForegroundMessage,
    onPushReceived: options?.onPushReceived,
    promptIfDefault: options?.promptIfDefault,
  };
  const nextPerm = options?.promptIfDefault ? 'granted' : 'default';
  if (options?.promptIfDefault) {
    mockGetWebPermission.mockReturnValue('granted');
  }
  return {
    permission: nextPerm,
    tokenUploaded: Boolean(options?.promptIfDefault),
  };
});
const mockGetWebPermission = jest.fn<
  'granted' | 'denied' | 'default' | 'unsupported',
  []
>(() => 'default');

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'admin-jwt-token',
    refreshToken: 'admin-refresh-token',
    user: { id: 'admin-1', name: 'Super Admin', phone_number: '9999999999', role: 'admin' },
    isAuthenticated: true,
    isInitialLoading: false,
    logout: mockLogout,
    setAuth: jest.fn(),
    tryRefreshToken: jest.fn(),
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

jest.mock('../src/services/fcmService', () => ({
  registerFCM: (...args: any[]) => mockRegisterFCM(...args),
  unregisterFCM: jest.fn(async () => undefined),
  getWebNotificationPermission: () => mockGetWebPermission(),
}));

jest.mock('../src/utils/notify', () => ({
  notify: (...args: any[]) => mockNotify(...args),
  confirmAction: (...args: any[]) => mockConfirmAction(...args),
}));

jest.mock('../src/components/RaahiLogo', () => () => null);
jest.mock('../src/screens/admin/AdminDashboardView', () => () => null);
jest.mock('../src/screens/admin/AdminDriversView', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  return function MockAdminDriversView(props: any) {
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-drivers-view' },
      `Drivers:${props.initialFilter}:${props.searchQuery || ''}`
    );
  };
});
jest.mock('../src/screens/admin/AdminBookingsView', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  return function MockAdminBookingsView(props: any) {
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-bookings-view' },
      `Bookings:${props.searchQuery || ''}`
    );
  };
});
jest.mock('../src/screens/admin/AdminRidesDetailView', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  return function MockAdminRidesDetailView(props: any) {
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-rides-view' },
      `Rides:${props.initialTab}:${props.searchQuery || ''}`
    );
  };
});
jest.mock('../src/screens/admin/AdminParcelsDetailView', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  return function MockAdminParcelsDetailView(props: any) {
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-parcels-view' },
      `Parcels:${props.searchQuery || ''}`
    );
  };
});
jest.mock('../src/screens/admin/AdminVisitorsDetailView', () => {
  const ReactLocal = require('react');
  const { Text: Txt } = require('react-native');
  return function MockAdminVisitorsDetailView(props: any) {
    return ReactLocal.createElement(
      Txt,
      { testID: 'mock-visitors-view' },
      `Users:${props.searchQuery || ''}`
    );
  };
});
jest.mock('../src/screens/admin/AdminRoutesDetailView', () => () => null);
jest.mock('../src/screens/admin/AdminReportsView', () => () => null);
jest.mock('../src/screens/admin/AdminVehiclesView', () => () => null);
jest.mock('../src/screens/admin/AdminFinanceView', () => () => null);
jest.mock('../src/screens/admin/AdminAuditLogsView', () => () => null);
jest.mock('../src/screens/admin/AdminSettingsView', () => () => null);

import AdminDashboardScreen from '../src/screens/admin/AdminDashboardScreen';
import {
  extractNotificationContext,
  formatRelativeTime,
  getContextTagsFromNotification,
  mergeAndDeduplicateNotifications,
  normalizeNotificationsList,
  parseAdminDeepLinkSearch,
  resolveAdminTargetView,
  resolveNotificationCategory,
} from '../src/utils/adminNotifications';

const SAMPLE_NOTIFICATIONS = [
  {
    id: 'n-1',
    title: 'New Booking Created',
    message: 'Aarav booked 2 seats on Kotdwar → Pauri',
    type: 'booking_created',
    category: 'bookings',
    targetView: 'bookings',
    relatedId: 'bk-obj-1',
    metadata: {
      bid: 'Go-0047',
      actorName: 'Aarav',
      actorPhone: '9811112222',
      pickup: 'Kotdwar',
      dropoff: 'Pauri',
    },
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-2',
    title: 'Driver KYC Submitted',
    message: 'Ramesh Kumar submitted documents for verification',
    type: 'driver_kyc_submitted',
    category: 'drivers',
    targetView: 'driver_verification',
    relatedId: 'drv-101',
    metadata: {
      driverId: 'drv-101',
      actorName: 'Ramesh Kumar',
      actorPhone: '9822223333',
      vehicleNumber: 'UK12A1234',
    },
    read: false,
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-3',
    title: 'Ride Completed',
    message: 'Ride from Almora to Haldwani completed',
    type: 'ride_completed',
    category: 'rides',
    targetView: 'completed_rides',
    relatedId: 'ride-77',
    read: true,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

const collectText = (root: ReactTestRenderer.ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map((node) => {
      const ch = node.props.children;
      if (Array.isArray(ch)) return ch.join('');
      return ch == null ? '' : String(ch);
    })
    .join(' ');

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

describe('adminNotifications utilities', () => {
  test('resolveAdminTargetView handles targetView, case aliases, URL params, and type fallbacks', () => {
    expect(resolveAdminTargetView({ targetView: 'bookings' })).toBe('bookings');
    expect(resolveAdminTargetView({ targetView: 'ACTIVE_RIDES' })).toBe('active_rides');
    expect(resolveAdminTargetView({ targetView: 'VISITORS' })).toBe('admin_users');
    expect(resolveAdminTargetView({ targetView: 'notifications' })).toBe('NOTIFICATIONS');
    expect(
      resolveAdminTargetView({ url: '/?adminView=DOCUMENT_REVIEW&relatedId=d1' })
    ).toBe('document_review');
    expect(resolveAdminTargetView({ type: 'user_registered' })).toBe('admin_users');
    expect(resolveAdminTargetView({ type: 'driver_kyc_resubmitted' })).toBe('driver_verification');
    expect(resolveAdminTargetView({ type: 'vehicle_updated' })).toBe('vehicles');
    expect(resolveAdminTargetView({ type: 'ride_cancelled' })).toBe('cancelled_rides');
    expect(resolveAdminTargetView({ type: 'parcel_cancelled' })).toBe('parcels');
    expect(resolveAdminTargetView({ type: 'review_submitted' })).toBe('drivers');
    expect(resolveAdminTargetView({ type: 'unknown_event' })).toBe('NOTIFICATIONS');
  });

  test('resolveNotificationCategory infers category when missing', () => {
    expect(resolveNotificationCategory({ category: 'parcels', type: 'anything' })).toBe('parcels');
    expect(resolveNotificationCategory({ type: 'driver_kyc_submitted' })).toBe('drivers');
    expect(resolveNotificationCategory({ type: 'vehicle_updated' })).toBe('drivers');
    expect(resolveNotificationCategory({ type: 'ride_started' })).toBe('rides');
    expect(resolveNotificationCategory({ type: 'booking_cancelled' })).toBe('bookings');
    expect(resolveNotificationCategory({ type: 'parcel_created' })).toBe('parcels');
    expect(resolveNotificationCategory({ type: 'review_submitted' })).toBe('reviews');
    expect(resolveNotificationCategory({ type: 'user_registered' })).toBe('users');
    expect(resolveNotificationCategory({ type: 'admin_promoted' })).toBe('system');
  });

  test('formatRelativeTime formats seconds, minutes, hours, days cleanly', () => {
    const now = new Date('2026-11-13T12:00:00Z').getTime();
    expect(formatRelativeTime('2026-11-13T11:59:30Z', now)).toBe('Just now');
    expect(formatRelativeTime('2026-11-13T11:55:00Z', now)).toBe('5m ago');
    expect(formatRelativeTime('2026-11-13T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-11-12T10:00:00Z', now)).toBe('Yesterday');
    expect(formatRelativeTime('2026-11-09T10:00:00Z', now)).toBe('4d ago');
  });

  test('extractNotificationContext returns target-appropriate search tokens and avoids stale filters for deletions', () => {
    expect(
      extractNotificationContext({
        type: 'booking_created',
        relatedId: 'obj-1',
        targetView: 'bookings',
        metadata: { bid: 'Go-0047', actorName: 'Aarav' },
      })
    ).toEqual({ searchQuery: 'Go-0047', bid: 'Go-0047' });

    expect(
      extractNotificationContext({
        type: 'driver_deleted',
        relatedId: 'drv-gone',
        targetView: 'drivers',
      })
    ).toEqual({ searchQuery: '' });

    expect(
      extractNotificationContext({
        type: 'ride_created',
        relatedId: 'ride-88',
        targetView: 'active_rides',
      })
    ).toEqual({ searchQuery: 'ride-88', bid: undefined });

    // Parcels: prefer passenger/sender over driverName, convert 24-hex ObjectId to RA-P-<last4>
    expect(
      extractNotificationContext({
        type: 'parcel_confirmed',
        relatedId: '674f0011223344556677a1b2',
        targetView: 'parcels',
        metadata: {
          actorName: 'Driver Ramesh',
          driverName: 'Driver Ramesh',
          passengerName: 'Sender Aarav',
          recipientName: 'Rohan',
          pickup: 'Kotdwar',
        },
      })
    ).toEqual({ searchQuery: 'Sender Aarav', bid: undefined });

    expect(
      extractNotificationContext({
        type: 'parcel_completed',
        relatedId: '674f0011223344556677a1b2',
        targetView: 'parcels',
        metadata: {
          actorName: 'Driver Ramesh',
          driverName: 'Driver Ramesh',
        },
      })
    ).toEqual({ searchQuery: 'RA-P-a1b2', bid: undefined });

    // Context tags avoid pairing driverName with passengerPhone
    const tags = getContextTagsFromNotification({
      id: 'tag-test-1',
      title: 'Parcel Confirmed',
      message: 'Confirmed',
      type: 'parcel_confirmed',
      read: false,
      createdAt: '2026-11-13T10:00:00Z',
      metadata: {
        actorName: 'Driver Ramesh',
        driverName: 'Driver Ramesh',
        passengerName: 'Sender Aarav',
        actorPhone: '9811112222',
        recipientName: 'Rohan',
      },
    });
    expect(tags).toContain('Sender Aarav (9811112222)');
    expect(tags).toContain('Driver: Driver Ramesh');
    expect(tags).toContain('To: Rohan');
    expect(tags).not.toContain('Driver Ramesh (9811112222)');
  });

  test('parseAdminDeepLinkSearch extracts query params and normalizes notification lists', () => {
    const parsed = parseAdminDeepLinkSearch(
      '?adminView=parcels&relatedId=p-101&type=parcel_created&notificationId=n-9'
    );
    expect(parsed).toEqual(
      expect.objectContaining({
        adminView: 'parcels',
        targetView: 'parcels',
        relatedId: 'p-101',
        type: 'parcel_created',
        notificationId: 'n-9',
      })
    );
    expect(parseAdminDeepLinkSearch('')).toBeNull();

    const normalized = normalizeNotificationsList([
      { _id: 'a1', title: 'Old', message: 'm1', type: 'ride_created', read: true, createdAt: '2026-11-12T10:00:00Z' },
      { id: 'a2', title: 'New', message: 'm2', type: 'booking_created', read: false, createdAt: '2026-11-13T10:00:00Z' },
    ]);
    expect(normalized.map((n) => n.id)).toEqual(['a2', 'a1']);

    const merged = mergeAndDeduplicateNotifications(normalized, [
      { id: 'a2', title: 'New Updated', message: 'm2', type: 'booking_created', read: true, createdAt: '2026-11-13T10:00:00Z' },
      { id: 'a3', title: 'Newest', message: 'm3', type: 'parcel_created', read: false, createdAt: '2026-11-13T11:00:00Z' },
    ]);
    expect(merged.map((n) => n.id)).toEqual(['a3', 'a2', 'a1']);
    expect(merged[1].read).toBe(true);
  });
});

describe('AdminDashboardScreen Notifications & Push Integration', () => {
  const originalOS = Platform.OS;
  const originalWindow = (global as any).window;
  let activeRenderer: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedFcmCallbacks = {};
    mockGetWebPermission.mockReturnValue('default');
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 1280,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    mockFetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/notifications/unread-count')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ unreadCount: 2 }),
        };
      }
      if (url.includes('/api/notifications/read-all') && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'All notifications marked as read', modifiedCount: 2 }),
        };
      }
      if (url.includes('/api/notifications/clear') && init?.method === 'DELETE') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'All notifications cleared' }),
        };
      }
      if (url.includes('/read') && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'Marked read' }),
        };
      }
      if (url.includes('/api/notifications/')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(SAMPLE_NOTIFICATIONS),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{}',
      };
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
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    (global as any).window = originalWindow;
  });

  test('loads notifications on mount, shows unread bell badge, opens popover, marks read & navigates with context', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    // Bell badge shows 2 unread
    expect(collectText(findByTestId(renderer.root, 'admin-bell-badge'))).toContain('2');
    expect(mockRegisterFCM).toHaveBeenCalledWith(
      'admin-jwt-token',
      expect.any(Function),
      expect.objectContaining({
        promptIfDefault: false,
        onForegroundMessage: expect.any(Function),
        onPushReceived: expect.any(Function),
      })
    );

    // Clicking bell opens quick dropdown popover
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-bell-button').props.onPress();
    });
    const popoverText = collectText(findByTestId(renderer.root, 'admin-bell-popover'));
    expect(popoverText).toContain('New Booking Created');
    expect(popoverText).toContain('Driver KYC Submitted');

    // Clicking a notification marks it read and navigates to Bookings with Go-0047 search context
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-popover-item-n-1').props.onPress();
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/n-1/read'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(collectText(findByTestId(renderer.root, 'mock-bookings-view'))).toBe('Bookings:Go-0047');
    expect(collectText(findByTestId(renderer.root, 'admin-bell-badge'))).toContain('1');

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('AdminNotificationsView supports filtering, Mark all read, Clear all, and navigating to driver_verification', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    // Open bell popover -> View all notifications
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-bell-button').props.onPress();
    });
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-popover-view-all').props.onPress();
    });

    // All 3 notifications are visible
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-1').length).toBeGreaterThan(0);
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-2').length).toBeGreaterThan(0);
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-3').length).toBeGreaterThan(0);

    // Filter to Drivers category -> only n-2 shows
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-notifs-filter-drivers').props.onPress();
    });
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-1')).toHaveLength(0);
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-2').length).toBeGreaterThan(0);

    // Switch back to All, mark all read -> badge disappears
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-notifs-filter-all').props.onPress();
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-notifs-mark-all-btn').props.onPress();
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/read-all'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(queryByTestId(renderer.root, 'admin-bell-badge')).toHaveLength(0);

    // Click n-2 -> navigates to driver_verification with Ramesh Kumar's phone filter
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-notif-card-n-2').props.onPress();
    });
    expect(collectText(findByTestId(renderer.root, 'mock-drivers-view'))).toBe(
      'Drivers:pending:9822223333'
    );

    // Return to Notifications view and Clear all
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-nav-NOTIFICATIONS').props.onPress();
    });
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-notifs-clear-all-btn').props.onPress();
    });
    expect(mockConfirmAction).toHaveBeenCalled();
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/clear'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(queryByTestId(renderer.root, 'admin-notif-card-n-1')).toHaveLength(0);

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });

  test('Web push permission banner, foreground push toast, and cold-start URL deep linking work end-to-end', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const replaceStateMock = jest.fn();
    (global as any).window = {
      location: {
        search: '?adminView=parcels&relatedId=parcel-55&type=parcel_created&notificationId=n-cold',
        pathname: '/',
      },
      history: {
        replaceState: replaceStateMock,
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<AdminDashboardScreen />);
      activeRenderer = renderer;
    });

    // Cold-start deep link navigated straight to Parcels with context & marked notificationId read
    expect(replaceStateMock).toHaveBeenCalled();
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/n-cold/read'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(collectText(findByTestId(renderer.root, 'mock-parcels-view'))).toBe('Parcels:parcel-55');

    // Web permission banner is visible when permission is 'default'
    expect(queryByTestId(renderer.root, 'admin-push-permission-banner').length).toBeGreaterThan(0);
    await act(async () => {
      await findPressableByTestId(renderer.root, 'admin-banner-enable-push').props.onPress();
    });
    expect(mockRegisterFCM).toHaveBeenLastCalledWith(
      'admin-jwt-token',
      expect.any(Function),
      expect.objectContaining({ promptIfDefault: true })
    );
    // Banner hides once permission becomes 'granted'
    expect(queryByTestId(renderer.root, 'admin-push-permission-banner')).toHaveLength(0);

    // Simulate foreground push arrival -> shows interactive toast + refreshes badge
    await act(async () => {
      capturedFcmCallbacks.onForegroundMessage?.({
        notificationId: 'n-fg-99',
        title: 'Ride Cancelled by Driver',
        body: 'Ride #R-99 cancelled with 2 affected bookings',
        type: 'ride_cancelled',
        targetView: 'cancelled_rides',
        relatedId: 'ride-99',
      });
    });

    const toast = findByTestId(renderer.root, 'admin-foreground-toast');
    expect(collectText(toast)).toContain('Ride Cancelled by Driver');

    // Tapping foreground toast marks it read & navigates to cancelled_rides with ride-99 context
    await act(async () => {
      findPressableByTestId(renderer.root, 'admin-foreground-toast-open').props.onPress();
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/n-fg-99/read'),
      expect.objectContaining({ method: 'PUT' })
    );
    expect(collectText(findByTestId(renderer.root, 'mock-rides-view'))).toBe(
      'Rides:cancelled:ride-99'
    );
    expect(queryByTestId(renderer.root, 'admin-foreground-toast')).toHaveLength(0);

    activeRenderer = null;
    await act(async () => {
      renderer.unmount();
    });
  });
});
