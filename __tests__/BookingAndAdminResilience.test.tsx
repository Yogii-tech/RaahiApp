import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

const mockApiRequest = jest.fn<Promise<any>, any[]>();
const mockFetchWithAuth = jest.fn<Promise<any>, any[]>();
const mockLogout = jest.fn(async () => {});
const mockSetAuth = jest.fn(async () => {});
const mockNotify = jest.fn<void, any[]>();
const mockConfirmAction = jest.fn<void, any[]>((_t, _m, onConfirm) => onConfirm?.());

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => 'test-token'),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      background: '#000',
      cardColor: '#111',
      borderColor: '#333',
      textColor: '#fff',
      subtextColor: '#aaa',
      primary: '#00BFA5',
      inputFillColor: '#111',
      inputBorderColor: '#333',
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
    user: { id: 'user-1', name: 'Test User', phone_number: '9999999999', role: 'passenger' },
    isAuthenticated: true,
    isInitialLoading: false,
    logout: mockLogout,
    setAuth: mockSetAuth,
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
  confirmAction: (...args: any[]) => mockConfirmAction(...args),
}));

jest.mock('../src/utils/documentUpload', () => ({
  uploadDocumentFile: jest.fn(),
  notify: (...args: any[]) => mockNotify(...args),
}));

jest.mock('../src/utils/browserHistory', () => ({
  pushSubViewHistory: jest.fn(),
  popSubViewHistory: jest.fn(),
  useBrowserBack: jest.fn(),
}));

jest.mock('../src/utils/exportUtils', () => ({
  downloadCSV: jest.fn(),
}));

jest.mock('../src/components/AdminChart', () => () => null);

jest.mock('../src/components/JeepLayout', () => {
  const ReactLocal = require('react');
  const { TouchableOpacity: Btn, Text: Txt } = require('react-native');
  return function MockJeepLayout({ onSeatPress }: any) {
    return ReactLocal.createElement(
      Btn,
      { testID: 'mock-seat-0', onPress: () => onSeatPress(0) },
      ReactLocal.createElement(Txt, null, 'Seat 0')
    );
  };
});

jest.mock('../src/components/LocationInput', () => {
  const ReactLocal = require('react');
  const { TextInput: Input } = require('react-native');
  return function MockLocationInput({ label, value, onChangeText }: any) {
    return ReactLocal.createElement(Input, {
      testID: `loc-${label}`,
      value,
      onChangeText,
    });
  };
});

import { parseJsonSafe } from '../src/utils/json';
import BookRideScreen from '../src/screens/BookRideScreen';
import ParcelBookingView from '../src/screens/ParcelBookingView';
import AdminDashboardView from '../src/screens/admin/AdminDashboardView';
import AdminDriversView from '../src/screens/admin/AdminDriversView';

const collectText = (root: ReactTestRenderer.ReactTestInstance) =>
  root
    .findAllByType(Text)
    .map(node => {
      const children = node.props.children;
      if (Array.isArray(children)) return children.join('');
      return children == null ? '' : String(children);
    })
    .join(' ');

describe('Booking, Parcel & Admin Resilience Fixes', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('parseJsonSafe returns null for 204 empty responses and HTML 502 error bodies without throwing', async () => {
    expect(
      await parseJsonSafe({
        status: 204,
        text: async () => '',
      } as any)
    ).toBeNull();

    expect(
      await parseJsonSafe({
        status: 502,
        text: async () => '<html><body>Bad Gateway</body></html>',
      } as any)
    ).toBeNull();

    expect(
      await parseJsonSafe({
        status: 200,
        text: async () => '{"ok":true,"id":"b1"}',
      } as any)
    ).toEqual({ ok: true, id: 'b1' });
  });

  test('BookRideScreen does not fabricate RA-XXXX booking ID when server omits booking ID, and refreshes seats on failure', async () => {
    let rideDetailCalls = 0;
    mockApiRequest.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('/book')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'queued without id' }),
        };
      }
      rideDetailCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 'ride-1',
            seatsTotal: 4,
            takenSeats: [2],
          }),
      };
    });

    const onBookingComplete = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(BookRideScreen, {
          ride: {
            id: 'ride-1',
            vehicleModel: 'Bolero',
            pricePerSeat: 250,
            seatsTotal: 4,
            takenSeats: [],
          },
          searchPickup: 'Kotdwar',
          searchDropoff: 'Pauri',
          onBack: jest.fn(),
          onBookingComplete,
        })
      );
    });

    const initialPollCount = rideDetailCalls;

    // Select a seat
    await act(async () => {
      renderer.root.findByProps({ testID: 'mock-seat-0' }).props.onPress();
    });

    // Tap Confirm Booking
    const confirmBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find(btn => collectText(btn).includes('book.confirmBooking'));
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      await confirmBtn!.props.onPress();
    });

    // Must not show fake RA-XXXX booking confirmation modal or call onBookingComplete
    expect(collectText(renderer.root)).not.toContain('BOOKING REFERENCE');
    expect(onBookingComplete).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      'common.error',
      expect.stringContaining('incomplete')
    );
    // Refreshed ride details / takenSeats after incomplete response
    expect(rideDetailCalls).toBeGreaterThan(initialPollCount);

    await act(async () => {
      renderer.unmount();
    });
  }, 15000);

  test('ParcelBookingView blocks Step 1->2 transition when geocoding/distance fails instead of falling back to 35 km', async () => {
    mockApiRequest.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ error: 'Geocoder down' }),
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(ParcelBookingView, { onBack: jest.fn() })
      );
    });

    // Enter pickup and dropoff without selecting suggestions (so coordinates stay unresolved)
    await act(async () => {
      renderer.root.findByProps({ testID: 'loc-parcel.pickupLabel' }).props.onChangeText('Kotdwar');
      renderer.root.findByProps({ testID: 'loc-parcel.dropoffLabel' }).props.onChangeText('Lansdowne');
    });

    const step1Btn = renderer.root
      .findAllByType(TouchableOpacity)
      .find(btn => collectText(btn).includes('PARCEL.SCHEDULEPICKUP'));
    expect(step1Btn).toBeDefined();

    await act(async () => {
      await step1Btn!.props.onPress();
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'common.error',
      expect.stringContaining('Could not determine route distance')
    );
    // Still on Step 1 (not recipient details)
    expect(collectText(renderer.root)).not.toContain('parcel.recipientDetails');

    await act(async () => {
      renderer.unmount();
    });
  });

  test('AdminDashboardView safely renders partial stats and preserves stats with inline banner when refresh fails', async () => {
    let callCount = 0;
    mockFetchWithAuth.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          // Partial stats missing nested bookings & users objects
          text: async () =>
            JSON.stringify({
              rides: { total: 12, available: 5, completed: 6, cancelled: 1 },
              routes: 4,
              monthlyTrend: [],
            }),
        };
      }
      return {
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      };
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(AdminDashboardView, { token: 'admin-token', isDark: true })
      );
    });

    let text = collectText(renderer.root);
    expect(text).toContain('Analytics Dashboard');
    expect(text).toContain('12');

    // Trigger refresh -> fails with 502
    const refreshBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find(btn => collectText(btn).includes('Refresh'));
    expect(refreshBtn).toBeDefined();

    await act(async () => {
      await refreshBtn!.props.onPress();
    });

    text = collectText(renderer.root);
    // Stats remain visible AND inline refresh banner appears
    expect(text).toContain('Analytics Dashboard');
    expect(text).toContain('12');
    expect(text).toContain('Refresh failed:');

    await act(async () => {
      renderer.unmount();
    });
  });

  test('AdminDriversView safely handles 204 No Content delete response via parseJsonSafe without throwing connection error', async () => {
    mockFetchWithAuth.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return {
          ok: true,
          status: 204,
          text: async () => '',
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 'drv-1',
              name: 'Ramesh Rawat',
              phone: '9876543210',
              verificationStatus: 'pending',
            },
          ]),
      };
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(AdminDriversView, { token: 'admin-token' })
      );
    });

    const deleteTrigger = renderer.root
      .findAllByType(TouchableOpacity)
      .find(btn => collectText(btn).includes('Delete'));
    expect(deleteTrigger).toBeDefined();

    // Open delete confirmation modal
    await act(async () => {
      deleteTrigger!.props.onPress();
    });

    const confirmDeleteBtn = renderer.root
      .findAllByType(TouchableOpacity)
      .find(btn => collectText(btn).includes('Yes, Delete'));
    expect(confirmDeleteBtn).toBeDefined();

    await act(async () => {
      await confirmDeleteBtn!.props.onPress();
    });

    expect(mockNotify).toHaveBeenCalledWith(
      'Deleted',
      expect.stringContaining('Ramesh Rawat deleted successfully')
    );

    await act(async () => {
      renderer.unmount();
    });
  });
});
