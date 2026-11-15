import React from 'react';
import {
  Image,
  ImageStyle,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

export type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoPreset {
  iconSize: number;
  fontSize: number;
  lineHeight: number;
  gap: number;
  letterSpacing: number;
}

export const BRAND_LOGO_PRESETS: Record<BrandLogoSize, BrandLogoPreset> = {
  sm: {
    iconSize: 32,
    fontSize: 20,
    lineHeight: 24,
    gap: 8,
    letterSpacing: -0.3,
  },
  md: {
    iconSize: 40,
    fontSize: 24,
    lineHeight: 28,
    gap: 8,
    letterSpacing: -0.4,
  },
  lg: {
    iconSize: 52,
    fontSize: 38,
    lineHeight: 44,
    gap: 10,
    letterSpacing: -0.8,
  },
};

export interface BrandLogoProps {
  size?: BrandLogoSize;
  iconSize?: number;
  fontSize?: number;
  lineHeight?: number;
  gap?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  wordmarkStyle?: StyleProp<TextStyle>;
  iconContainerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const LOGO_SOURCE = require('../assets/logo_brand.png');

/**
 * Unified GoRaahi emblem + wordmark lockup with matched vertical centerline
 * across Web, iOS, and Android headers and splash screens.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  iconSize,
  fontSize,
  lineHeight,
  gap,
  showWordmark = true,
  wordmarkColor = '#0056D2',
  wordmarkStyle,
  iconContainerStyle,
  imageStyle,
  style,
  onPress,
  accessibilityLabel = 'GoRaahi',
  testID,
}) => {
  const preset = BRAND_LOGO_PRESETS[size];
  const resolvedIconSize = iconSize ?? preset.iconSize;
  const resolvedFontSize = fontSize ?? preset.fontSize;
  const resolvedLineHeight = lineHeight ?? preset.lineHeight;
  const resolvedGap = gap ?? preset.gap;

  const content = (
    <View style={[styles.row, { gap: resolvedGap }, style]} testID={onPress ? undefined : testID}>
      <View
        style={[
          styles.iconContainer,
          { width: resolvedIconSize, height: resolvedIconSize },
          iconContainerStyle,
        ]}
        testID={testID ? `${testID}-icon-wrapper` : undefined}
      >
        <Image
          source={LOGO_SOURCE}
          style={[
            styles.iconImage,
            { width: resolvedIconSize, height: resolvedIconSize },
            imageStyle,
          ]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          testID={testID ? `${testID}-image` : undefined}
        />
      </View>
      {showWordmark && (
        <Text
          numberOfLines={1}
          style={[
            styles.wordmark,
            {
              color: wordmarkColor,
              fontSize: resolvedFontSize,
              lineHeight: resolvedLineHeight,
              letterSpacing: preset.letterSpacing,
            },
            wordmarkStyle,
          ]}
          testID={testID ? `${testID}-wordmark` : undefined}
        >
          GoRaahi
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.pressable}
        testID={testID}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  iconImage: {
    flexShrink: 0,
  },
  wordmark: {
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default BrandLogo;
