(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  GLASS_TOKENS,
  GlassBackdrop,
  GlassVariant,
  getGlassSurfaceStyle,
} from '../src/styles/glassmorphism';
import {
  ThemeProvider,
  darkColors,
  lightColors,
  useTheme,
} from '../src/context/ThemeContext';
import { ScreenHeader } from '../src/components/ScreenHeader';

const VARIANTS: GlassVariant[] = [
  'card',
  'elevated',
  'input',
  'header',
  'tabBar',
  'pill',
  'modal',
];

describe('Glassmorphism design tokens & helpers', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it('defines light and dark palettes, orb glows, and translucent frosted variants', () => {
    expect(GLASS_TOKENS.light.orbs).toEqual(['#5B4FFF', '#38BDF8', '#A855F7']);
    expect(GLASS_TOKENS.dark.orbs).toEqual(['#1E90FF', '#8B5CF6', '#06B6D4']);
    expect(GLASS_TOKENS.light.specularBorder).toBe('rgba(255, 255, 255, 0.88)');
    expect(GLASS_TOKENS.dark.specularBorder).toBe('rgba(255, 255, 255, 0.16)');

    for (const variant of VARIANTS) {
      const lightStyle = getGlassSurfaceStyle(false, variant);
      const darkStyle = getGlassSurfaceStyle(true, variant);

      expect(String(lightStyle.backgroundColor)).toMatch(/^rgba\(/);
      expect(String(darkStyle.backgroundColor)).toMatch(/^rgba\(/);
      expect(lightStyle.borderColor).toBeTruthy();
      expect(darkStyle.borderColor).toBeTruthy();
      expect(lightStyle.shadowRadius).toBeGreaterThan(0);
      expect(darkStyle.shadowRadius).toBeGreaterThan(0);

      if (variant === 'header') {
        expect(lightStyle.borderWidth).toBe(0);
        expect(lightStyle.borderBottomWidth).toBe(1);
      } else if (variant === 'tabBar') {
        expect(lightStyle.borderWidth).toBe(0);
        expect(lightStyle.borderTopWidth).toBe(1);
      } else {
        expect(lightStyle.borderWidth).toBe(1);
        expect(darkStyle.borderWidth).toBe(1);
      }
    }
  });

  it('emits backdropFilter and WebkitBackdropFilter on web, skips nested blur on inputs, and omits CSS filters on native', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const webStyle = getGlassSurfaceStyle(false, 'card') as any;
    expect(webStyle.backdropFilter).toContain('blur(');
    expect(webStyle.backdropFilter).toContain('saturate(');
    expect(webStyle.WebkitBackdropFilter).toBe(webStyle.backdropFilter);

    const webInputStyle = getGlassSurfaceStyle(false, 'input') as any;
    expect(webInputStyle.backdropFilter).toBeUndefined();
    expect(webInputStyle.WebkitBackdropFilter).toBeUndefined();

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const nativeStyle = getGlassSurfaceStyle(true, 'card') as any;
    expect(nativeStyle.backdropFilter).toBeUndefined();
    expect(nativeStyle.WebkitBackdropFilter).toBeUndefined();
    expect(nativeStyle.backgroundColor).toBe(GLASS_TOKENS.dark.surfaces.card.backgroundColor);
  });

  it('renders GlassBackdrop non-interactively with 3 ambient orbs for both themes', () => {
    let lightTree!: renderer.ReactTestRenderer;
    let darkTree!: renderer.ReactTestRenderer;

    act(() => {
      lightTree = renderer.create(<GlassBackdrop isDark={false} />);
      darkTree = renderer.create(<GlassBackdrop isDark={true} />);
    });

    const lightRoot = lightTree.root.findByProps({ testID: 'glass-backdrop' });
    expect(lightRoot.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(lightRoot.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: GLASS_TOKENS.light.canvas,
    });

    const darkRoot = darkTree.root.findByProps({ testID: 'glass-backdrop' });
    expect(StyleSheet.flatten(darkRoot.props.style).backgroundColor).toBe(
      GLASS_TOKENS.dark.canvas,
    );

    expect(
      lightTree.root.findByProps({ testID: 'glass-backdrop-orb-primary' }),
    ).toBeDefined();
    expect(
      lightTree.root.findByProps({ testID: 'glass-backdrop-orb-secondary' }),
    ).toBeDefined();
    expect(
      lightTree.root.findByProps({ testID: 'glass-backdrop-orb-accent' }),
    ).toBeDefined();

    act(() => {
      lightTree.unmount();
      darkTree.unmount();
    });
  });

  it('preserves all ThemeColors keys with frosted glass values across light and dark mode', () => {
    const requiredKeys = [
      'primary',
      'secondary',
      'background',
      'cardColor',
      'borderColor',
      'textColor',
      'subtextColor',
      'accentColor',
      'inputFillColor',
      'inputBorderColor',
    ];

    for (const key of requiredKeys) {
      expect((lightColors as any)[key]).toBeTruthy();
      expect((darkColors as any)[key]).toBeTruthy();
    }

    expect(lightColors.cardColor).toBe('rgba(255, 255, 255, 0.56)');
    expect(lightColors.borderColor).toBe('rgba(255, 255, 255, 0.85)');
    expect(darkColors.cardColor).toBe('rgba(22, 32, 50, 0.58)');
    expect(darkColors.borderColor).toBe('rgba(255, 255, 255, 0.16)');

    let observedTheme: any;
    function ThemeProbe() {
      const theme = useTheme();
      observedTheme = theme;
      return (
        <TouchableOpacity testID="toggle-btn" onPress={theme.toggleTheme}>
          <Text>{theme.isDark ? 'dark' : 'light'}</Text>
        </TouchableOpacity>
      );
    }

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      );
    });

    expect(observedTheme.isDark).toBe(false);
    expect(observedTheme.colors).toEqual(lightColors);

    act(() => {
      tree.root.findByType(TouchableOpacity).props.onPress();
    });

    expect(observedTheme.isDark).toBe(true);
    expect(observedTheme.colors).toEqual(darkColors);

    act(() => {
      tree.unmount();
    });
  });

  it('keeps ScreenHeader primary banner solid while using frosted surface on surface tone', () => {
    let surfaceTree!: renderer.ReactTestRenderer;
    let primaryTree!: renderer.ReactTestRenderer;

    act(() => {
      surfaceTree = renderer.create(
        <ThemeProvider>
          <ScreenHeader title="Profile" tone="surface" />
        </ThemeProvider>,
      );
      primaryTree = renderer.create(
        <ThemeProvider>
          <ScreenHeader title="Vehicle KYC" tone="primary" />
        </ThemeProvider>,
      );
    });

    const surfaceRootView = surfaceTree.root.findAllByType(View)[0];
    expect(StyleSheet.flatten(surfaceRootView.props.style).backgroundColor).toBe(
      GLASS_TOKENS.light.surfaces.header.backgroundColor,
    );

    const primaryRootView = primaryTree.root.findAllByType(View)[0];
    expect(StyleSheet.flatten(primaryRootView.props.style).backgroundColor).toBe(
      lightColors.primary,
    );

    act(() => {
      surfaceTree.unmount();
      primaryTree.unmount();
    });
  });
});
