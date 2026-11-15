import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

export type GlassVariant =
  | 'card'
  | 'elevated'
  | 'input'
  | 'header'
  | 'tabBar'
  | 'pill'
  | 'modal';

export interface GlassSurfaceSpec {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
  blur: string;
}

export interface GlassThemePalette {
  canvas: string;
  backdropOverlay: string;
  specularBorder: string;
  subtleBorder: string;
  hairlineDivider: string;
  orbs: readonly [string, string, string];
  surfaces: Record<GlassVariant, GlassSurfaceSpec>;
}

export const GLASS_TOKENS: {
  light: GlassThemePalette;
  dark: GlassThemePalette;
} = {
  light: {
    canvas: '#F4F7FF',
    backdropOverlay: 'rgba(244, 247, 255, 0.9)',
    specularBorder: 'rgba(255, 255, 255, 0.88)',
    subtleBorder: 'rgba(255, 255, 255, 0.85)',
    hairlineDivider: 'rgba(91, 79, 255, 0.14)',
    orbs: ['#5B4FFF', '#38BDF8', '#A855F7'],
    surfaces: {
      card: {
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        borderColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        blur: 'blur(18px) saturate(160%)',
      },
      elevated: {
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.92)',
        borderWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
        blur: 'blur(22px) saturate(180%)',
      },
      input: {
        backgroundColor: 'rgba(255, 255, 255, 0.62)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
        // Omit nested backdropFilter on inputs inside frosted cards to avoid extra GPU blur passes on mobile
        blur: '',
      },
      header: {
        backgroundColor: 'rgba(255, 255, 255, 0.66)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 0,
        borderBottomWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        blur: 'blur(20px) saturate(180%)',
      },
      tabBar: {
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 0,
        borderTopWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 4,
        blur: 'blur(24px) saturate(180%)',
      },
      pill: {
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        borderColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        blur: 'blur(14px) saturate(160%)',
      },
      modal: {
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        borderColor: 'rgba(255, 255, 255, 0.94)',
        borderWidth: 1,
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 30,
        elevation: 12,
        blur: 'blur(26px) saturate(180%)',
      },
    },
  },
  dark: {
    canvas: '#0F172A',
    backdropOverlay: 'rgba(15, 23, 42, 0.92)',
    specularBorder: 'rgba(255, 255, 255, 0.16)',
    subtleBorder: 'rgba(255, 255, 255, 0.14)',
    hairlineDivider: 'rgba(255, 255, 255, 0.14)',
    orbs: ['#1E90FF', '#8B5CF6', '#06B6D4'],
    surfaces: {
      card: {
        backgroundColor: 'rgba(22, 32, 50, 0.58)',
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 22,
        elevation: 6,
        blur: 'blur(18px) saturate(160%)',
      },
      elevated: {
        backgroundColor: 'rgba(30, 41, 59, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.42,
        shadowRadius: 26,
        elevation: 10,
        blur: 'blur(22px) saturate(180%)',
      },
      input: {
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 1,
        // Omit nested backdropFilter on inputs inside frosted cards to avoid extra GPU blur passes on mobile
        blur: '',
      },
      header: {
        backgroundColor: 'rgba(15, 23, 42, 0.68)',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: 0,
        borderBottomWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
        elevation: 3,
        blur: 'blur(20px) saturate(180%)',
      },
      tabBar: {
        backgroundColor: 'rgba(15, 23, 42, 0.74)',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: 0,
        borderTopWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
        blur: 'blur(24px) saturate(180%)',
      },
      pill: {
        backgroundColor: 'rgba(30, 41, 59, 0.54)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 8,
        elevation: 2,
        blur: 'blur(14px) saturate(160%)',
      },
      modal: {
        backgroundColor: 'rgba(22, 32, 50, 0.88)',
        borderColor: 'rgba(255, 255, 255, 0.22)',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.5,
        shadowRadius: 32,
        elevation: 14,
        blur: 'blur(26px) saturate(180%)',
      },
    },
  },
};

/**
 * Returns cross-platform frosted glass surface styling for cards, headers,
 * inputs, pills, tab bars, and modals. Does not override layout geometry.
 */
export function getGlassSurfaceStyle(
  isDark: boolean,
  variant: GlassVariant = 'card',
): ViewStyle {
  const palette = isDark ? GLASS_TOKENS.dark : GLASS_TOKENS.light;
  const spec = palette.surfaces[variant];

  const style: ViewStyle = {
    backgroundColor: spec.backgroundColor,
    borderColor: spec.borderColor,
    borderWidth: spec.borderWidth,
    ...(spec.borderTopWidth !== undefined
      ? { borderTopWidth: spec.borderTopWidth, borderTopColor: spec.borderColor }
      : {}),
    ...(spec.borderBottomWidth !== undefined
      ? { borderBottomWidth: spec.borderBottomWidth, borderBottomColor: spec.borderColor }
      : {}),
    shadowColor: spec.shadowColor,
    shadowOffset: spec.shadowOffset,
    shadowOpacity: spec.shadowOpacity,
    shadowRadius: spec.shadowRadius,
    elevation: spec.elevation,
  };

  if (Platform.OS === 'web' && spec.blur) {
    (style as any).backdropFilter = spec.blur;
    (style as any).WebkitBackdropFilter = spec.blur;
  }

  return style;
}

export interface GlassBackdropProps {
  isDark: boolean;
}

const buildOrbStyle = (
  color: string,
  size: number,
  opacity: number,
  position: { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string },
): ViewStyle => {
  const base: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: Platform.OS === 'web' ? opacity : opacity * 0.28,
    backgroundColor: color,
    ...(position as any),
  };

  if (Platform.OS === 'web') {
    // Soft radial-gradient falloff renders in one fill pass without an extra large blur() GPU texture
    (base as any).backgroundImage = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
    (base as any).backgroundColor = 'transparent';
  }

  return base;
};

/**
 * Ambient atmospheric gradient orb layer rendered behind screens so frosted
 * glass surfaces visibly refract subtle brand color without intercepting touches.
 */
export const GlassBackdrop: React.FC<GlassBackdropProps> = ({ isDark }) => {
  const palette = isDark ? GLASS_TOKENS.dark : GLASS_TOKENS.light;
  const [orbPrimary, orbSky, orbViolet] = palette.orbs;

  return React.createElement(
    View,
    {
      pointerEvents: 'none',
      testID: 'glass-backdrop',
      style: [styles.backdrop, { backgroundColor: palette.canvas }],
    },
    React.createElement(View, {
      testID: 'glass-backdrop-orb-primary',
      style: buildOrbStyle(
        orbPrimary,
        420,
        isDark ? 0.24 : 0.16,
        { top: -110, left: -80 },
      ),
    }),
    React.createElement(View, {
      testID: 'glass-backdrop-orb-secondary',
      style: buildOrbStyle(
        orbSky,
        380,
        isDark ? 0.18 : 0.18,
        { top: '30%', right: -100 },
      ),
    }),
    React.createElement(View, {
      testID: 'glass-backdrop-orb-accent',
      style: buildOrbStyle(
        orbViolet,
        400,
        isDark ? 0.18 : 0.14,
        { bottom: -120, left: '14%' },
      ),
    }),
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
});
