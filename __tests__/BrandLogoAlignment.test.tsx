(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

const mockNavigate = jest.fn();
const mockToggleTheme = jest.fn();
const mockLogout = jest.fn(async () => undefined);

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
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) =>
      typeof children === 'function' ? children({}) : children || null,
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

jest.mock(
  'maplibre-gl',
  () => ({
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
  }),
  { virtual: true },
);

jest.mock(
  'socket.io-client',
  () => ({
    io: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    })),
  }),
  { virtual: true },
);

jest.mock('../src/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({
    isDark: false,
    toggleTheme: mockToggleTheme,
    colors: {
      primary: '#5B4FFF',
      background: '#F5F7FA',
      cardColor: '#FFFFFF',
      borderColor: '#E2E8F0',
      textColor: '#0F172A',
      subtextColor: '#64748B',
    },
  }),
}));

jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    isAuthenticated: true,
    isInitialLoading: false,
    token: 'test-token',
    user: { id: 'u1', name: 'Asha', role: 'passenger' },
    logout: mockLogout,
  }),
}));

jest.mock('../src/context/LanguageContext', () => ({
  LanguageProvider: ({ children }: any) => children,
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../src/screens/MapScreen', () => () => null);
jest.mock('../src/components/TripTrackingMap', () => () => null);

import BrandLogo, { BRAND_LOGO_PRESETS } from '../src/components/BrandLogo';
import RaahiLogo from '../src/components/RaahiLogo';
import WelcomeScreen from '../src/screens/WelcomeScreen';
import { AppHeader } from '../App';

function readPngBounds(filePath: string) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
      colorType = buf[offset + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(offset + 8, offset + 8 + length));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prevRow = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    const curRow = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? curRow[x - bpp] : 0;
      const up = prevRow ? prevRow[x] : 0;
      const upLeft = prevRow && x >= bpp ? prevRow[x - bpp] : 0;
      const val = row[x];
      curRow[x] =
        (filter === 0
          ? val
          : filter === 1
            ? val + left
            : filter === 2
              ? val + up
              : filter === 3
                ? val + ((left + up) >> 1)
                : val + paeth(left, up, upLeft)) & 255;
    }
  }

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = bpp === 4 ? pixels[(y * width + x) * 4 + 3] : 255;
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    width,
    height,
    padLeft: minX,
    padRight: width - 1 - maxX,
    padTop: minY,
    padBottom: height - 1 - maxY,
  };
}

describe('Brand logo alignment & asset geometry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('PNG brand assets are square with symmetric vertical and horizontal padding', () => {
    const appBrandBounds = readPngBounds(
      path.resolve(__dirname, '../src/assets/logo_brand.png'),
    );
    expect(appBrandBounds.width).toBe(256);
    expect(appBrandBounds.height).toBe(256);
    expect(Math.abs(appBrandBounds.padTop - appBrandBounds.padBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(appBrandBounds.padLeft - appBrandBounds.padRight)).toBeLessThanOrEqual(1);

    const webIconBounds = readPngBounds(
      path.resolve(__dirname, '../public/logo192.png'),
    );
    expect(webIconBounds.width).toBe(192);
    expect(webIconBounds.height).toBe(192);
    expect(Math.abs(webIconBounds.padTop - webIconBounds.padBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(webIconBounds.padLeft - webIconBounds.padRight)).toBeLessThanOrEqual(1);
  });

  test('BrandLogo enforces centered square icon + inline wordmark metrics for md preset', () => {
    let tree!: renderer.ReactTestRenderer;
    const onPress = jest.fn();

    act(() => {
      tree = renderer.create(
        <BrandLogo
          size="md"
          wordmarkColor="#5B4FFF"
          onPress={onPress}
          testID="brand-test"
        />,
      );
    });

    const button = tree.root.findByType(TouchableOpacity);
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.testID).toBe('brand-test');

    const iconWrapper = tree.root.findByProps({ testID: 'brand-test-icon-wrapper' });
    const wrapperStyle = StyleSheet.flatten(iconWrapper.props.style);
    expect(wrapperStyle.width).toBe(BRAND_LOGO_PRESETS.md.iconSize);
    expect(wrapperStyle.height).toBe(BRAND_LOGO_PRESETS.md.iconSize);
    expect(wrapperStyle.alignItems).toBe('center');
    expect(wrapperStyle.justifyContent).toBe('center');

    const image = tree.root.findByType(Image);
    const imageStyle = StyleSheet.flatten(image.props.style);
    expect(image.props.resizeMode).toBe('contain');
    expect(imageStyle.width).toBe(BRAND_LOGO_PRESETS.md.iconSize);
    expect(imageStyle.height).toBe(BRAND_LOGO_PRESETS.md.iconSize);

    const wordmark = tree.root.findByType(Text);
    const wordmarkStyle = StyleSheet.flatten(wordmark.props.style);
    expect(wordmark.props.children).toBe('GoRaahi');
    expect(wordmark.props.numberOfLines).toBe(1);
    expect(wordmarkStyle.color).toBe('#5B4FFF');
    expect(wordmarkStyle.fontSize).toBe(BRAND_LOGO_PRESETS.md.fontSize);
    expect(wordmarkStyle.lineHeight).toBe(BRAND_LOGO_PRESETS.md.lineHeight);
    expect(wordmarkStyle.includeFontPadding).toBe(false);
    expect(wordmarkStyle.textAlignVertical).toBe('center');

    act(() => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  test('BrandLogo aligns row center across presets and supports icon-only mode', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BrandLogo size="sm" showWordmark={false} testID="icon-only-brand" />,
      );
    });

    const row = tree.root.findAllByType(View).find((v) => v.props.testID === 'icon-only-brand');
    expect(row).toBeDefined();
    const rowStyle = StyleSheet.flatten(row!.props.style);
    expect(rowStyle.flexDirection).toBe('row');
    expect(rowStyle.alignItems).toBe('center');
    expect(rowStyle.gap).toBe(BRAND_LOGO_PRESETS.sm.gap);

    const image = tree.root.findByType(Image);
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      width: BRAND_LOGO_PRESETS.sm.iconSize,
      height: BRAND_LOGO_PRESETS.sm.iconSize,
    });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);

    act(() => {
      tree.unmount();
    });
  });

  test('AppHeader uses unified BrandLogo with theme primary wordmark and press handler', () => {
    let tree!: renderer.ReactTestRenderer;
    const onPressLogo = jest.fn();

    act(() => {
      tree = renderer.create(<AppHeader onPressLogo={onPressLogo} />);
    });

    const brandButton = tree.root.findByProps({ testID: 'app-header-brand-logo' });
    const brandWordmark = tree.root.findByProps({
      testID: 'app-header-brand-logo-wordmark',
    });
    expect(StyleSheet.flatten(brandWordmark.props.style).color).toBe('#5B4FFF');
    expect(brandWordmark.props.children).toBe('GoRaahi');

    act(() => {
      brandButton.props.onPress();
    });
    expect(onPressLogo).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  test('WelcomeScreen renders large aligned BrandLogo lockup', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<WelcomeScreen onGetStarted={jest.fn()} />);
    });

    const wordmark = tree.root.findByProps({ testID: 'welcome-brand-logo-wordmark' });
    const wordmarkStyle = StyleSheet.flatten(wordmark.props.style);
    expect(wordmark.props.children).toBe('GoRaahi');
    expect(wordmarkStyle.fontSize).toBe(BRAND_LOGO_PRESETS.lg.fontSize);
    expect(wordmarkStyle.lineHeight).toBe(BRAND_LOGO_PRESETS.lg.lineHeight);
    expect(wordmarkStyle.includeFontPadding).toBe(false);

    const image = tree.root.findByProps({ testID: 'welcome-brand-logo-image' });
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      width: BRAND_LOGO_PRESETS.lg.iconSize,
      height: BRAND_LOGO_PRESETS.lg.iconSize,
    });

    act(() => {
      tree.unmount();
    });
  });

  test('RaahiLogo renders centered square brand image without web-only SVG tags', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<RaahiLogo size={32} />);
    });

    const container = tree.root.findByProps({ testID: 'raahi-logo' });
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle).toMatchObject({
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    });

    const images = tree.root.findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.resizeMode).toBe('contain');
    expect(StyleSheet.flatten(images[0].props.style)).toMatchObject({
      width: 32,
      height: 32,
    });

    act(() => {
      tree.unmount();
    });
  });

  test('public/legal.html keeps brand image aspect ratio and vertical alignment', () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, '../public/legal.html'),
      'utf8',
    );
    expect(html).toContain('align-items: center;');
    expect(html).toContain('object-fit: contain;');
    expect(html).toContain('width: 38px;');
    expect(html).toContain('height: 38px;');
    expect(html).toContain('line-height: 1;');
  });
});
