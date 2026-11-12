/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

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
  registerFCM: jest.fn(async () => undefined),
  unregisterFCM: jest.fn(async () => undefined),
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

jest.mock('react-native-safe-area-context', () => {
  const actual = {
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    },
  };
  return actual;
});

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

jest.mock('../src/screens/MapScreen', () => () => null);
jest.mock('../src/components/TripTrackingMap', () => () => null);

import App from '../App';

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree).toBeDefined();
  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
}, 30000);
