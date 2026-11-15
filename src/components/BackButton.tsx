import React, { useState } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    Platform,
    StyleProp,
    ViewStyle,
    TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export type BackButtonVariant = 'pill' | 'icon' | 'link';
export type BackButtonTone = 'default' | 'inverted';

export interface BackButtonProps {
    onPress: () => void;
    label?: string;
    variant?: BackButtonVariant;
    tone?: BackButtonTone;
    iconName?: 'chevron-back' | 'arrow-back';
    disabled?: boolean;
    testID?: string;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}

const DEFAULT_LIGHT_BORDER = 'rgba(91, 79, 255, 0.16)';
const DEFAULT_DARK_BORDER = 'rgba(30, 144, 255, 0.26)';
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

export const BackButton: React.FC<BackButtonProps> = ({
    onPress,
    label,
    variant = 'pill',
    tone = 'default',
    iconName = 'chevron-back',
    disabled = false,
    testID,
    accessibilityLabel,
    style,
    textStyle,
}) => {
    const { isDark, colors } = useTheme();
    const { t } = useLanguage();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    const translatedBack = typeof t === 'function' ? t('common.back') : '';
    const fallbackLabel =
        translatedBack && translatedBack !== 'common.back' ? translatedBack : 'Back';
    const displayLabel = label !== undefined ? label : fallbackLabel;
    const isInteractive = hovered || focused;

    const primaryColor = colors.primary || (isDark ? '#1E90FF' : '#5B4FFF');
    const cardBg = colors.cardColor || (isDark ? '#162032' : '#FFFFFF');
    const textColor = colors.textColor || (isDark ? '#FFFFFF' : '#222260');
    const borderColor =
        colors.borderColor || (isDark ? DEFAULT_DARK_BORDER : DEFAULT_LIGHT_BORDER);

    let backgroundColor = 'transparent';
    let resolvedBorderColor = 'transparent';
    let foregroundColor = primaryColor;

    if (tone === 'inverted') {
        foregroundColor = '#FFFFFF';
        if (variant === 'link') {
            backgroundColor = isInteractive ? 'rgba(255, 255, 255, 0.14)' : 'transparent';
        } else {
            backgroundColor = isInteractive
                ? 'rgba(255, 255, 255, 0.26)'
                : 'rgba(255, 255, 255, 0.16)';
            resolvedBorderColor = isInteractive
                ? 'rgba(255, 255, 255, 0.5)'
                : 'rgba(255, 255, 255, 0.28)';
        }
    } else if (variant === 'link') {
        foregroundColor = primaryColor;
        backgroundColor = isInteractive
            ? isDark
                ? 'rgba(30, 144, 255, 0.14)'
                : 'rgba(91, 79, 255, 0.08)'
            : 'transparent';
    } else {
        backgroundColor = isInteractive
            ? isDark
                ? 'rgba(30, 144, 255, 0.16)'
                : '#F3F1FF'
            : cardBg;
        resolvedBorderColor = isInteractive ? primaryColor : borderColor;
        foregroundColor = isInteractive ? primaryColor : textColor;
    }

    const webProps =
        Platform.OS === 'web'
            ? ({
                  onMouseEnter: () => setHovered(true),
                  onMouseLeave: () => setHovered(false),
              } as any)
            : {};

    const webStyle: any =
        Platform.OS === 'web'
            ? {
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transitionProperty: 'background-color, border-color, transform',
                  transitionDuration: '150ms',
                  outlineStyle: focused ? 'solid' : 'none',
                  outlineWidth: focused ? 2 : 0,
                  outlineColor: tone === 'inverted' ? '#FFFFFF' : primaryColor,
                  outlineOffset: 2,
              }
            : undefined;

    const surfaceStyle =
        variant === 'icon'
            ? styles.iconSurface
            : variant === 'link'
              ? styles.linkSurface
              : styles.pillSurface;

    const elevationStyle =
        variant !== 'link' && tone === 'default'
            ? isDark
                ? styles.darkShadow
                : styles.lightShadow
            : undefined;

    const iconSize = variant === 'icon' ? 20 : 18;
    const shouldRenderLabel = variant !== 'icon' && displayLabel.trim().length > 0;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.72}
            hitSlop={HIT_SLOP}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || displayLabel.trim() || fallbackLabel}
            accessibilityState={{ disabled }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...webProps}
            style={[
                styles.base,
                surfaceStyle,
                elevationStyle,
                {
                    backgroundColor,
                    borderColor: resolvedBorderColor,
                    borderWidth: variant === 'link' ? 0 : 1,
                    opacity: disabled ? 0.5 : 1,
                },
                webStyle,
                style,
            ]}
        >
            <Icon
                name={iconName}
                size={iconSize}
                color={foregroundColor}
                style={variant === 'icon' && iconName === 'chevron-back' ? styles.chevronNudge : undefined}
            />
            {shouldRenderLabel && (
                <Text
                    numberOfLines={1}
                    style={[
                        styles.label,
                        variant === 'link' ? styles.linkLabel : styles.pillLabel,
                        { color: foregroundColor },
                        textStyle,
                    ]}
                >
                    {displayLabel}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
    },
    iconSurface: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    pillSurface: {
        minHeight: 40,
        paddingLeft: 10,
        paddingRight: 14,
        borderRadius: 20,
        gap: 4,
    },
    linkSurface: {
        minHeight: 40,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    chevronNudge: {
        marginRight: 1,
    },
    label: {
        includeFontPadding: false,
    },
    pillLabel: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    linkLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    lightShadow: {
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    darkShadow: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 2,
    },
});

export default BackButton;
