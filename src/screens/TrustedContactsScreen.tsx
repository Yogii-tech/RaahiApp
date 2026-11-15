import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';
import { confirmAction, notify } from '../utils/notify';
import { ScreenHeader } from '../components/ScreenHeader';

interface Contact {
    phone: string;
}

const MAX_TRUSTED_CONTACTS = 2;
const REMOVE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const resolveTranslation = (
    t: (key: string) => string,
    key: string,
    fallback: string,
): string => {
    const value = t(key);
    return value && value !== key ? value : fallback;
};

const normalizePhoneInput = (rawValue: string): string => {
    const trimmed = rawValue.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 14 && digitsOnly.startsWith('0091')) {
        return digitsOnly.slice(4, 14);
    }
    if (
        digitsOnly.length >= 12 &&
        (trimmed.startsWith('+91') || (digitsOnly.length === 12 && digitsOnly.startsWith('91')))
    ) {
        return digitsOnly.slice(2, 12);
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        return digitsOnly.slice(1, 11);
    }
    return digitsOnly.slice(0, 10);
};

const TrustedContactsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { colors, isDark } = useTheme();
    const { logout } = useAuth();
    const { t } = useLanguage();
    const [contacts, setContacts] = useState<Contact[]>([
        { phone: '' },
        { phone: '' },
    ]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const isMountedRef = useRef(true);

    const primaryColor = colors.primary || (isDark ? '#1E90FF' : '#5B4FFF');
    const cardColor = colors.cardColor || (isDark ? '#162032' : '#FFFFFF');
    const textColor = colors.textColor || (isDark ? '#FFFFFF' : '#222260');
    const subtextColor =
        colors.subtextColor || (isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(34, 34, 96, 0.7)');
    const borderColor =
        colors.borderColor || (isDark ? 'rgba(30, 144, 255, 0.2)' : 'rgba(91, 79, 255, 0.12)');
    const inputFillColor = colors.inputFillColor || (isDark ? '#181F2A' : '#F8F9FF');
    const inputBorderColor =
        colors.inputBorderColor ||
        (isDark ? 'rgba(30, 144, 255, 0.18)' : 'rgba(91, 79, 255, 0.14)');

    const softPrimaryBg = isDark ? 'rgba(30, 144, 255, 0.11)' : 'rgba(91, 79, 255, 0.06)';
    const softPrimaryBorder = isDark ? 'rgba(30, 144, 255, 0.24)' : 'rgba(91, 79, 255, 0.15)';
    const validColor = isDark ? '#34D399' : '#059669';
    const validBorder = isDark ? 'rgba(52, 211, 153, 0.45)' : 'rgba(5, 150, 105, 0.38)';
    const validBg = isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.09)';
    const warnColor = isDark ? '#FBBF24' : '#D97706';
    const warnBorder = isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.35)';
    const dangerColor = isDark ? '#F87171' : '#EF4444';
    const dangerBg = isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)';
    const dangerBorder = isDark ? 'rgba(248, 113, 113, 0.28)' : 'rgba(239, 68, 68, 0.2)';

    const pointerStyle: any = Platform.OS === 'web' ? { cursor: 'pointer' } : undefined;

    useEffect(() => {
        isMountedRef.current = true;
        fetchContacts();
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchContacts = async () => {
        if (!isMountedRef.current) return;
        setLoading(true);
        setLoadError(null);
        try {
            const response = await apiRequest('/api/user/trusted-contacts', {}, logout);
            if (!isMountedRef.current) return;
            if (response.ok) {
                const data = await response.json();
                if (!isMountedRef.current) return;
                if (data && data.length > 0) {
                    setContacts(data);
                } else {
                    setContacts([{ phone: '' }]);
                }
            } else {
                setLoadError('Failed to load trusted contacts. Please try again.');
            }
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
            if (isMountedRef.current) {
                setLoadError(t('book.errorConnect') || 'Connection error. Please try again.');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (saving) return;
        const toSave = contacts
            .map(c => ({ ...c, phone: c.phone.trim() }))
            .filter(c => c.phone.length > 0);

        if (toSave.length === 0) {
            notify(t('common.error'), t('trusted.atLeastOne'));
            return;
        }

        const invalidContact = toSave.find(c => c.phone.length !== 10);
        if (invalidContact) {
            notify(t('common.error'), t('trusted.tenDigits'));
            return;
        }

        setSaving(true);
        try {
            const response = await apiRequest(
                '/api/user/trusted-contacts',
                {
                    method: 'PUT',
                    body: JSON.stringify(toSave),
                },
                logout,
            );

            if (!isMountedRef.current) return;

            if (response.ok) {
                notify(t('requests.success'), t('trusted.successUpdate'));
                onBack();
            } else {
                notify(t('common.error'), t('trusted.failUpdate'));
            }
        } catch (err) {
            if (isMountedRef.current) {
                notify(t('common.error'), t('book.errorConnect'));
            }
        } finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    };

    const updateContact = (index: number, field: keyof Contact, value: string) => {
        const sanitized = field === 'phone' ? normalizePhoneInput(value) : value;
        setContacts(prev =>
            prev.map((item, i) => (i === index ? { ...item, [field]: sanitized } : item)),
        );
    };

    const removeContact = (index: number) => {
        setContacts(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            return filtered.length === 0 ? [{ phone: '' }] : filtered;
        });
    };

    const handleRequestRemove = (index: number) => {
        const target = contacts[index];
        if (!target || target.phone.trim().length === 0) {
            removeContact(index);
            return;
        }

        confirmAction(
            resolveTranslation(t, 'trusted.removeTitle', 'Remove Contact?'),
            resolveTranslation(
                t,
                'trusted.removeMessage',
                'Remove this phone number from your trusted contacts?',
            ),
            () => removeContact(index),
            resolveTranslation(t, 'trusted.removeBtn', 'Remove'),
            resolveTranslation(t, 'common.cancel', 'Cancel'),
        );
    };

    const addContact = () => {
        if (contacts.length < MAX_TRUSTED_CONTACTS) {
            setContacts(prev => [...prev, { phone: '' }]);
        }
    };

    const ofTotalLabel = resolveTranslation(t, 'trusted.ofTotal', 'of 2');
    const countChip = (
        <View
            testID="trusted-count-badge"
            style={[
                styles.countPill,
                { backgroundColor: softPrimaryBg, borderColor: softPrimaryBorder },
            ]}
        >
            <Icon name="shield-checkmark" size={14} color={primaryColor} />
            <Text style={[styles.countPillText, { color: primaryColor }]}>
                {`${contacts.length} ${ofTotalLabel}`}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.screen, styles.nonScrollPadding, { backgroundColor: colors.background }]}>
                <View style={styles.innerWrap}>
                    <ScreenHeader
                        onBack={onBack}
                        title={t('trusted.title')}
                        backTestID="trusted-back-button"
                        style={styles.screenHeader}
                    />
                </View>
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={primaryColor} />
                </View>
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.screen, styles.nonScrollPadding, { backgroundColor: colors.background }]}>
                <View style={styles.innerWrap}>
                    <ScreenHeader
                        onBack={onBack}
                        title={t('trusted.title')}
                        backTestID="trusted-back-button"
                        style={styles.screenHeader}
                    />
                    <View
                        style={[
                            styles.errorCard,
                            { backgroundColor: cardColor, borderColor },
                            isDark ? styles.cardShadowDark : styles.cardShadowLight,
                        ]}
                    >
                        <View style={[styles.errorIconWell, { backgroundColor: dangerBg }]}>
                            <Icon name="alert-circle-outline" size={28} color={dangerColor} />
                        </View>
                        <Text style={[styles.errorText, { color: textColor }]}>{loadError}</Text>
                        <TouchableOpacity
                            style={[
                                styles.retryButton,
                                { backgroundColor: primaryColor },
                                pointerStyle,
                            ]}
                            onPress={fetchContacts}
                            accessibilityRole="button"
                            accessibilityLabel="Retry"
                            activeOpacity={0.8}
                        >
                            <Text style={styles.primaryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    const contactWord = resolveTranslation(t, 'trusted.contactWord', 'Contact');
    const safetyBadgeLabel = resolveTranslation(t, 'trusted.safetyBadge', 'Safety Circle');
    const maxLimitLabel = resolveTranslation(t, 'trusted.maxLimitHint', 'Up to 2 contacts');
    const digitsValidLabel = resolveTranslation(
        t,
        'trusted.digitsValid',
        '10-digit number ready',
    );
    const digitsRemainingLabel = resolveTranslation(
        t,
        'trusted.digitsRemaining',
        'more digits needed',
    );
    const addAnotherLabel = resolveTranslation(
        t,
        'trusted.addAnotherLabel',
        'Add Another Contact',
    );
    const securityNoteLabel = resolveTranslation(
        t,
        'trusted.securityNote',
        'Stored securely for emergency SOS and ride safety sharing.',
    );
    const removeLabel = resolveTranslation(t, 'trusted.removeBtn', 'Remove');

    return (
        <ScrollView
            style={[styles.screen, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.innerWrap}>
                <ScreenHeader
                    onBack={onBack}
                    title={t('trusted.title')}
                    rightSlot={countChip}
                    backTestID="trusted-back-button"
                    style={styles.screenHeader}
                />

                <View
                    style={[
                        styles.safetyBanner,
                        { backgroundColor: softPrimaryBg, borderColor: softPrimaryBorder },
                    ]}
                >
                    <View style={styles.bannerTopRow}>
                        <View
                            style={[
                                styles.safetyTag,
                                {
                                    backgroundColor: cardColor,
                                    borderColor: softPrimaryBorder,
                                },
                            ]}
                        >
                            <Icon name="shield-checkmark" size={14} color={primaryColor} />
                            <Text style={[styles.safetyTagText, { color: primaryColor }]}>
                                {safetyBadgeLabel}
                            </Text>
                        </View>
                        <Text style={[styles.maxHintText, { color: subtextColor }]}>
                            {maxLimitLabel}
                        </Text>
                    </View>
                    <Text style={[styles.subtitle, { color: textColor }]}>
                        {t('trusted.subtitle')}
                    </Text>
                </View>

                {contacts.map((contact, index) => {
                    const digitCount = contact.phone.trim().length;
                    const isValid = digitCount === 10;
                    const isIncomplete = digitCount > 0 && digitCount < 10;
                    const isFocused = focusedIndex === index;
                    const canRemove = contacts.length > 1 || digitCount > 0;

                    const activeInputBorder = isFocused
                        ? primaryColor
                        : isValid
                          ? validBorder
                          : isIncomplete
                            ? warnBorder
                            : inputBorderColor;

                    const activeCardBorder = isFocused
                        ? primaryColor
                        : isValid
                          ? validBorder
                          : borderColor;

                    return (
                        <View
                            key={index}
                            style={[
                                styles.contactCard,
                                {
                                    backgroundColor: cardColor,
                                    borderColor: activeCardBorder,
                                },
                                isDark ? styles.cardShadowDark : styles.cardShadowLight,
                            ]}
                        >
                            <View style={styles.cardHeader}>
                                <View
                                    style={[
                                        styles.contactBadge,
                                        {
                                            backgroundColor: isValid ? validBg : softPrimaryBg,
                                            borderColor: isValid ? validBorder : softPrimaryBorder,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.indexDot,
                                            {
                                                backgroundColor: isValid
                                                    ? validColor
                                                    : primaryColor,
                                            },
                                        ]}
                                    >
                                        <Text style={styles.indexDotText}>{index + 1}</Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.contactBadgeText,
                                            { color: isValid ? validColor : primaryColor },
                                        ]}
                                    >
                                        {`${contactWord} ${index + 1}`}
                                    </Text>
                                </View>

                                {canRemove ? (
                                    <TouchableOpacity
                                        onPress={() => handleRequestRemove(index)}
                                        hitSlop={REMOVE_HIT_SLOP}
                                        testID={`remove-contact-${index}`}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${removeLabel} ${contactWord} ${index + 1}`}
                                        activeOpacity={0.7}
                                        style={[
                                            styles.removeCircleBtn,
                                            {
                                                backgroundColor: dangerBg,
                                                borderColor: dangerBorder,
                                            },
                                            pointerStyle,
                                        ]}
                                    >
                                        <Icon
                                            name="trash-outline"
                                            size={16}
                                            color={dangerColor}
                                        />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: subtextColor }]}>
                                    {t('trusted.phoneLabel')}
                                </Text>
                                {isValid ? (
                                    <View style={styles.statusInline}>
                                        <Icon
                                            name="checkmark-circle"
                                            size={14}
                                            color={validColor}
                                        />
                                        <Text style={[styles.statusText, { color: validColor }]}>
                                            {digitsValidLabel}
                                        </Text>
                                    </View>
                                ) : isIncomplete ? (
                                    <View style={styles.statusInline}>
                                        <Icon
                                            name="alert-circle-outline"
                                            size={14}
                                            color={warnColor}
                                        />
                                        <Text style={[styles.statusText, { color: warnColor }]}>
                                            {`${10 - digitCount} ${digitsRemainingLabel}`}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={[styles.counterHint, { color: subtextColor }]}>
                                        0 / 10
                                    </Text>
                                )}
                            </View>

                            <View
                                style={[
                                    styles.phoneInputGroup,
                                    {
                                        backgroundColor: inputFillColor,
                                        borderColor: activeInputBorder,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.countryPrefix,
                                        { borderRightColor: borderColor },
                                    ]}
                                >
                                    <Icon name="call-outline" size={15} color={primaryColor} />
                                    <Text style={[styles.countryCodeText, { color: textColor }]}>
                                        +91
                                    </Text>
                                </View>

                                <TextInput
                                    testID={`trusted-phone-input-${index}`}
                                    style={[styles.phoneInput, { color: textColor }]}
                                    placeholder={t('trusted.phonePlaceholderSmall')}
                                    placeholderTextColor={subtextColor}
                                    keyboardType="phone-pad"
                                    value={contact.phone}
                                    onFocus={() => setFocusedIndex(index)}
                                    onBlur={() =>
                                        setFocusedIndex(curr => (curr === index ? null : curr))
                                    }
                                    onChangeText={val => updateContact(index, 'phone', val)}
                                    accessibilityLabel={`${contactWord} ${index + 1} ${t('trusted.phoneLabel')}`}
                                />

                                {isValid ? (
                                    <View style={styles.validInputIcon}>
                                        <Icon
                                            name="checkmark-circle"
                                            size={20}
                                            color={validColor}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    );
                })}

                {contacts.length < MAX_TRUSTED_CONTACTS ? (
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            {
                                borderColor: isDark
                                    ? 'rgba(30, 144, 255, 0.45)'
                                    : 'rgba(91, 79, 255, 0.34)',
                                backgroundColor: isDark
                                    ? 'rgba(30, 144, 255, 0.08)'
                                    : 'rgba(91, 79, 255, 0.04)',
                            },
                            pointerStyle,
                        ]}
                        onPress={addContact}
                        accessibilityRole="button"
                        accessibilityLabel={addAnotherLabel}
                        activeOpacity={0.75}
                    >
                        <Icon name="add-circle-outline" size={20} color={primaryColor} />
                        <Text style={[styles.addButtonText, { color: primaryColor }]}>
                            {addAnotherLabel}
                        </Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        { backgroundColor: primaryColor, opacity: saving ? 0.78 : 1 },
                        isDark ? styles.saveButtonShadowDark : styles.saveButtonShadowLight,
                        Platform.OS === 'web'
                            ? ({ cursor: saving ? 'wait' : 'pointer' } as any)
                            : undefined,
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityState={{ busy: saving, disabled: saving }}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Icon name="shield-checkmark-outline" size={19} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>
                                {t('trusted.saveTrusted')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.securityFooter}>
                    <Icon name="shield-checkmark-outline" size={14} color={subtextColor} />
                    <Text style={[styles.securityFooterText, { color: subtextColor }]}>
                        {securityNoteLabel}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 36,
        flexGrow: 1,
    },
    nonScrollPadding: {
        paddingHorizontal: 18,
        paddingTop: 12,
    },
    innerWrap: {
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
    },
    screenHeader: {
        marginBottom: 14,
    },
    centerState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    countPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    countPillText: {
        fontSize: 12,
        fontWeight: '700',
        includeFontPadding: false,
    },
    safetyBanner: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 15,
        marginBottom: 18,
    },
    bannerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    safetyTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    safetyTagText: {
        fontSize: 12,
        fontWeight: '700',
        includeFontPadding: false,
    },
    maxHintText: {
        fontSize: 12,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 13.5,
        lineHeight: 20,
        fontWeight: '500',
    },
    contactCard: {
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1.5,
    },
    cardShadowLight: {
        shadowColor: '#222260',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardShadowDark: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 6,
        paddingRight: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    indexDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indexDotText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
        includeFontPadding: false,
    },
    contactBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        includeFontPadding: false,
    },
    removeCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
    },
    statusInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    counterHint: {
        fontSize: 12,
        fontWeight: '600',
    },
    phoneInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        minHeight: 50,
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 12,
        borderRightWidth: 1,
    },
    countryCodeText: {
        fontSize: 15,
        fontWeight: '700',
        includeFontPadding: false,
    },
    phoneInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.6,
    },
    validInputIcon: {
        paddingRight: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 50,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginTop: 2,
        marginBottom: 18,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 54,
        borderRadius: 16,
        paddingHorizontal: 20,
        marginTop: 4,
    },
    saveButtonShadowLight: {
        shadowColor: '#5B4FFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 4,
    },
    saveButtonShadowDark: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    securityFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 14,
        paddingHorizontal: 12,
    },
    securityFooterText: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        flexShrink: 1,
    },
    errorCard: {
        marginTop: 20,
        borderRadius: 18,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    errorIconWell: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    errorText: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 22,
    },
    retryButton: {
        marginTop: 18,
        minHeight: 46,
        borderRadius: 14,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default TrustedContactsScreen;
