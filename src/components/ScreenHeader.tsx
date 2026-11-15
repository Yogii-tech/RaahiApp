import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BackButton, BackButtonVariant } from './BackButton';

export type ScreenHeaderTone = 'default' | 'surface' | 'primary';
export type ScreenHeaderAlign = 'left' | 'center';

export interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    backLabel?: string;
    backVariant?: BackButtonVariant;
    backIconName?: 'chevron-back' | 'arrow-back';
    backAccessibilityLabel?: string;
    backTestID?: string;
    rightSlot?: React.ReactNode;
    tone?: ScreenHeaderTone;
    align?: ScreenHeaderAlign;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
    subtitleStyle?: StyleProp<TextStyle>;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
    title,
    subtitle,
    onBack,
    backLabel,
    backVariant,
    backIconName = 'chevron-back',
    backAccessibilityLabel,
    backTestID,
    rightSlot,
    tone = 'default',
    align = 'left',
    style,
    titleStyle,
    subtitleStyle,
}) => {
    const { isDark, colors } = useTheme();

    const primaryColor = colors.primary || (isDark ? '#1E90FF' : '#5B4FFF');
    const cardColor = colors.cardColor || (isDark ? '#162032' : '#FFFFFF');
    const borderColor =
        colors.borderColor || (isDark ? 'rgba(30, 144, 255, 0.2)' : 'rgba(91, 79, 255, 0.12)');
    const textColor = colors.textColor || (isDark ? '#FFFFFF' : '#222260');
    const subtextColor =
        colors.subtextColor || (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(34, 34, 96, 0.7)');

    const isPrimary = tone === 'primary';
    const isSurface = tone === 'surface';
    const resolvedVariant: BackButtonVariant = backVariant ?? (backLabel ? 'pill' : 'icon');

    const containerToneStyle: ViewStyle = isPrimary
        ? { backgroundColor: primaryColor }
        : isSurface
          ? {
                backgroundColor: cardColor,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
            }
          : { backgroundColor: 'transparent' };

    const resolvedTitleColor = isPrimary ? '#FFFFFF' : textColor;
    const resolvedSubtitleColor = isPrimary ? 'rgba(255, 255, 255, 0.85)' : subtextColor;

    const backControl = onBack ? (
        <BackButton
            onPress={onBack}
            label={backLabel}
            variant={resolvedVariant}
            tone={isPrimary ? 'inverted' : 'default'}
            iconName={backIconName}
            accessibilityLabel={backAccessibilityLabel}
            testID={backTestID}
        />
    ) : null;

    if (align === 'center') {
        const needsLeftSpacer = !onBack && Boolean(rightSlot);
        const needsRightSpacer = Boolean(onBack) && !rightSlot && resolvedVariant === 'icon';

        return (
            <View
                style={[
                    styles.container,
                    isPrimary || isSurface ? styles.paddedBar : styles.compactBar,
                    containerToneStyle,
                    style,
                ]}
            >
                <View style={styles.centerRow}>
                    <View style={styles.sideSlot}>
                        {backControl || (needsLeftSpacer ? <View style={styles.balanceSpacer} /> : null)}
                    </View>
                    <View style={styles.centerTextWrap}>
                        <Text
                            numberOfLines={2}
                            accessibilityRole="header"
                            style={[styles.title, styles.centerTitle, { color: resolvedTitleColor }, titleStyle]}
                        >
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text
                                style={[
                                    styles.subtitle,
                                    styles.centerSubtitle,
                                    { color: resolvedSubtitleColor },
                                    subtitleStyle,
                                ]}
                            >
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>
                    <View style={[styles.sideSlot, styles.sideSlotRight]}>
                        {rightSlot || (needsRightSpacer ? <View style={styles.balanceSpacer} /> : null)}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                isPrimary || isSurface ? styles.paddedBar : styles.compactBar,
                containerToneStyle,
                style,
            ]}
        >
            <View style={styles.leftRow}>
                {backControl ? <View style={styles.leftBackWrap}>{backControl}</View> : null}
                <View style={styles.leftTextWrap}>
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, { color: resolvedTitleColor }, titleStyle]}
                    >
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text
                            style={[
                                styles.subtitle,
                                { color: resolvedSubtitleColor },
                                subtitleStyle,
                            ]}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
                {rightSlot ? <View style={styles.leftRightSlot}>{rightSlot}</View> : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    compactBar: {
        paddingVertical: 4,
    },
    paddedBar: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    leftRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftBackWrap: {
        marginRight: 12,
    },
    leftTextWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    leftRightSlot: {
        marginLeft: 12,
    },
    centerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sideSlot: {
        minWidth: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    sideSlotRight: {
        alignItems: 'flex-end',
    },
    balanceSpacer: {
        width: 40,
        height: 40,
    },
    centerTextWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 21,
        fontWeight: '800',
        letterSpacing: -0.35,
        includeFontPadding: false,
    },
    centerTitle: {
        fontSize: 19,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        marginTop: 3,
    },
    centerSubtitle: {
        textAlign: 'center',
    },
});

export default ScreenHeader;
