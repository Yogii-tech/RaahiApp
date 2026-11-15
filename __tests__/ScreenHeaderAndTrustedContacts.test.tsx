(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';

const mockApiRequest = jest.fn();
const mockLogout = jest.fn(async () => {});
const mockNotify = jest.fn();
const mockConfirmAction = jest.fn();

let mockThemeState = {
    isDark: false,
    colors: {
        primary: '#5B4FFF',
        background: '#F8F9FF',
        cardColor: '#FFFFFF',
        borderColor: 'rgba(91, 79, 255, 0.12)',
        textColor: '#222260',
        subtextColor: 'rgba(34, 34, 96, 0.7)',
        inputFillColor: '#F8F9FF',
        inputBorderColor: 'rgba(91, 79, 255, 0.10)',
    },
};

let mockTranslateImpl = (key: string) => key;

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('../src/apiConfig', () => ({
    API_BASE: 'http://localhost:8080',
}));

jest.mock('../src/context/ThemeContext', () => ({
    useTheme: () => mockThemeState,
}));

jest.mock('../src/context/AuthContext', () => ({
    useAuth: () => ({
        logout: mockLogout,
    }),
}));

jest.mock('../src/context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => mockTranslateImpl(key),
    }),
}));

jest.mock('../src/utils/api', () => ({
    apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.mock('../src/utils/notify', () => ({
    notify: (...args: any[]) => mockNotify(...args),
    confirmAction: (...args: any[]) => mockConfirmAction(...args),
}));

jest.mock('react-native-vector-icons/Ionicons', () => {
    const ReactLib = require('react');
    const { Text: RNText } = require('react-native');
    return function MockIonicons({ name, size, color }: any) {
        return ReactLib.createElement(
            RNText,
            { testID: `ionicon-${name}`, accessibilityLabel: name, style: { color, fontSize: size } },
            name,
        );
    };
});

import { BackButton } from '../src/components/BackButton';
import { ScreenHeader } from '../src/components/ScreenHeader';
import TrustedContactsScreen from '../src/screens/TrustedContactsScreen';
import { translations } from '../src/translations';

const collectText = (root: ReactTestInstance): string =>
    root
        .findAllByType(Text)
        .map(node => {
            const children = node.props.children;
            if (Array.isArray(children)) {
                return children.filter(c => typeof c === 'string' || typeof c === 'number').join('');
            }
            return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
        })
        .join(' ');

const flattenStyle = (style: any): Record<string, any> => {
    if (!style) return {};
    if (Array.isArray(style)) {
        return style.reduce((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
    }
    return typeof style === 'object' ? style : {};
};

const flushAsync = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

describe('translations common.back and trusted keys', () => {
    it('defines clean common.back strings without raw bracket glyphs in en and hi', () => {
        expect(translations.en['common.back']).toBe('Back');
        expect(translations.hi['common.back']).toBe('पीछे');
        expect(translations.en['common.back']).not.toMatch(/[‹<←]/);
        expect(translations.hi['common.back']).not.toMatch(/[‹<←]/);

        const requiredTrustedKeys = [
            'trusted.safetyBadge',
            'trusted.contactWord',
            'trusted.ofTotal',
            'trusted.maxLimitHint',
            'trusted.digitsValid',
            'trusted.digitsRemaining',
            'trusted.removeTitle',
            'trusted.removeMessage',
            'trusted.removeBtn',
            'trusted.addAnotherLabel',
            'trusted.securityNote',
        ] as const;

        for (const key of requiredTrustedKeys) {
            expect(translations.en[key]).toBeTruthy();
            expect(translations.hi[key]).toBeTruthy();
        }
    });
});

describe('BackButton & ScreenHeader', () => {
    beforeEach(() => {
        mockIsLightTheme();
        mockTranslateImpl = (key: string) => key;
    });

    function mockIsLightTheme() {
        mockThemeState = {
            isDark: false,
            colors: {
                primary: '#5B4FFF',
                background: '#F8F9FF',
                cardColor: '#FFFFFF',
                borderColor: 'rgba(91, 79, 255, 0.12)',
                textColor: '#222260',
                subtextColor: 'rgba(34, 34, 96, 0.7)',
                inputFillColor: '#F8F9FF',
                inputBorderColor: 'rgba(91, 79, 255, 0.10)',
            },
        };
    }

    it('renders BackButton pill with fallback label when t() returns key literally', () => {
        const onPress = jest.fn();
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<BackButton onPress={onPress} testID="back-pill" />);
        });

        const button = tree.root.findByType(TouchableOpacity);
        expect(button.props.testID).toBe('back-pill');
        expect(button.props.accessibilityRole).toBe('button');
        expect(collectText(tree.root)).toContain('Back');
        expect(tree.root.findByProps({ testID: 'ionicon-chevron-back' })).toBeTruthy();
        expect(collectText(tree.root)).not.toMatch(/[‹<←]/);

        const style = flattenStyle(button.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(40);

        act(() => {
            button.props.onPress();
        });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders icon BackButton with >= 40x40 target and supports inverted tone on primary headers', () => {
        const onBack = jest.fn();
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <ScreenHeader
                    title="Vehicle KYC"
                    subtitle="Upload clear photos"
                    onBack={onBack}
                    tone="primary"
                    align="center"
                    backTestID="kyc-back"
                />,
            );
        });

        const backBtn = tree.root.findByType(TouchableOpacity);
        expect(backBtn.props.testID).toBe('kyc-back');
        const style = flattenStyle(backBtn.props.style);
        expect(style.width).toBe(40);
        expect(style.height).toBe(40);

        const icon = tree.root.findByProps({ testID: 'ionicon-chevron-back' });
        expect(icon.props.style.color).toBe('#FFFFFF');

        const text = collectText(tree.root);
        expect(text).toContain('Vehicle KYC');
        expect(text).toContain('Upload clear photos');
        expect(text).not.toContain('Back');
    });

    it('renders ScreenHeader with dark theme and pill variant when backLabel is provided', () => {
        mockThemeState = {
            isDark: true,
            colors: {
                primary: '#1E90FF',
                background: '#181F2A',
                cardColor: '#162032',
                borderColor: 'rgba(30, 144, 255, 0.2)',
                textColor: '#FFFFFF',
                subtextColor: 'rgba(255, 255, 255, 0.7)',
                inputFillColor: '#181F2A',
                inputBorderColor: 'rgba(30, 144, 255, 0.12)',
            },
        };
        const onBack = jest.fn();

        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(
                <ScreenHeader
                    title="Details"
                    onBack={onBack}
                    backLabel="Go Back"
                    tone="surface"
                    backTestID="dark-back"
                />,
            );
        });

        expect(collectText(tree.root)).toContain('Go Back');
        expect(collectText(tree.root)).toContain('Details');

        let linkTree!: renderer.ReactTestRenderer;
        act(() => {
            linkTree = renderer.create(
                <BackButton onPress={onBack} variant="link" iconName="arrow-back" label="Return" />,
            );
        });
        expect(linkTree.root.findByProps({ testID: 'ionicon-arrow-back' })).toBeTruthy();
        expect(collectText(linkTree.root)).toContain('Return');
    });
});

describe('TrustedContactsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockTranslateImpl = (key: string) =>
            (translations.en as Record<string, string>)[key] || key;
        mockThemeState = {
            isDark: false,
            colors: {
                primary: '#5B4FFF',
                background: '#F8F9FF',
                cardColor: '#FFFFFF',
                borderColor: 'rgba(91, 79, 255, 0.12)',
                textColor: '#222260',
                subtextColor: 'rgba(34, 34, 96, 0.7)',
                inputFillColor: '#F8F9FF',
                inputBorderColor: 'rgba(91, 79, 255, 0.10)',
            },
        };
    });

    it('renders loading header back button, then shows loaded contacts with validation state', async () => {
        let resolveFetch!: (val: any) => void;
        mockApiRequest.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFetch = resolve;
                }),
        );

        const onBack = jest.fn();
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<TrustedContactsScreen onBack={onBack} />);
        });

        expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
        const loadingBack = tree.root.findByProps({ testID: 'trusted-back-button' });
        act(() => {
            loadingBack.props.onPress();
        });
        expect(onBack).toHaveBeenCalledTimes(1);

        resolveFetch({
            ok: true,
            json: async () => [{ phone: '9876543210' }],
        });
        await flushAsync();

        const text = collectText(tree.root);
        expect(text).toContain('Trusted Contacts');
        expect(text).toContain('1 of 2');
        expect(text).toContain('Contact 1');
        expect(text).toContain('10-digit number ready');
        expect(text).toContain('+91');
        expect(text).not.toContain('✕');
        expect(text).not.toContain('‹ BACK');
    });

    it('handles load errors cleanly and retries on button press', async () => {
        mockApiRequest
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => [] });

        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<TrustedContactsScreen onBack={jest.fn()} />);
        });
        await flushAsync();

        expect(collectText(tree.root)).toContain('Failed to load trusted contacts. Please try again.');
        const retryBtn = tree.root.findByProps({ accessibilityLabel: 'Retry' });

        act(() => {
            retryBtn.props.onPress();
        });
        await flushAsync();

        expect(mockApiRequest).toHaveBeenCalledTimes(2);
        expect(collectText(tree.root)).toContain('Contact 1');
        expect(collectText(tree.root)).toContain('0 / 10');
    });

    it('validates input, confirms populated removal, normalizes +91 paste, and saves contacts', async () => {
        mockApiRequest
            .mockResolvedValueOnce({ ok: true, json: async () => [] })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        mockConfirmAction.mockImplementation((_t, _m, onConfirm) => onConfirm());

        const onBack = jest.fn();
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<TrustedContactsScreen onBack={onBack} />);
        });
        await flushAsync();

        const saveBtn = () =>
            tree.root.findAllByType(TouchableOpacity).find(btn =>
                collectText(btn).includes('Save Trusted Contacts'),
            )!;

        // Empty save triggers atLeastOne
        await act(async () => {
            saveBtn().props.onPress();
        });
        expect(mockNotify).toHaveBeenCalledWith(
            translations.en['common.error'],
            translations.en['trusted.atLeastOne'],
        );

        // Partial digits triggers live warning and tenDigits validation
        const input0 = tree.root.findByProps({ testID: 'trusted-phone-input-0' });
        act(() => {
            input0.props.onChangeText('98765');
        });
        expect(collectText(tree.root)).toContain('5 more digits needed');

        await act(async () => {
            saveBtn().props.onPress();
        });
        expect(mockNotify).toHaveBeenCalledWith(
            translations.en['common.error'],
            translations.en['trusted.tenDigits'],
        );

        // Add second blank contact, then remove blank immediately (no confirmAction)
        const addBtn = tree.root.findByProps({ accessibilityLabel: 'Add Another Contact' });
        act(() => {
            addBtn.props.onPress();
        });
        expect(collectText(tree.root)).toContain('2 of 2');
        expect(tree.root.findAllByProps({ accessibilityLabel: 'Add Another Contact' })).toHaveLength(0);

        const removeBlankBtn = tree.root.findByProps({ testID: 'remove-contact-1' });
        act(() => {
            removeBlankBtn.props.onPress();
        });
        expect(mockConfirmAction).not.toHaveBeenCalled();
        expect(collectText(tree.root)).toContain('1 of 2');

        // Removing populated contact asks confirmAction
        const removePopulatedBtn = tree.root.findByProps({ testID: 'remove-contact-0' });
        act(() => {
            removePopulatedBtn.props.onPress();
        });
        expect(mockConfirmAction).toHaveBeenCalledTimes(1);
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe('');

        // Ensure TextInput does not impose raw maxLength=10 that truncates formatted pastes before normalization
        const phoneInput = tree.root.findByType(TextInput);
        expect(phoneInput.props.maxLength).toBeUndefined();

        // Paste formatted numbers (+91 ..., 91..., 0...) and verify 10-digit regular typing/overflow
        act(() => {
            tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.onChangeText(
                '9123456789',
            );
        });
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe(
            '9123456789',
        );

        act(() => {
            tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.onChangeText(
                '91234567899',
            );
        });
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe(
            '9123456789',
        );

        act(() => {
            tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.onChangeText(
                '919876543210',
            );
        });
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe(
            '9876543210',
        );

        act(() => {
            tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.onChangeText(
                '09876543210',
            );
        });
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe(
            '9876543210',
        );

        // Paste +91 formatted number, verify live ready indicator and PUT save
        act(() => {
            tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.onChangeText(
                '+91 98765 43210',
            );
        });
        expect(tree.root.findByProps({ testID: 'trusted-phone-input-0' }).props.value).toBe(
            '9876543210',
        );
        expect(collectText(tree.root)).toContain('10-digit number ready');

        await act(async () => {
            saveBtn().props.onPress();
        });

        expect(mockApiRequest).toHaveBeenNthCalledWith(
            2,
            '/api/user/trusted-contacts',
            {
                method: 'PUT',
                body: JSON.stringify([{ phone: '9876543210' }]),
            },
            mockLogout,
        );
        expect(mockNotify).toHaveBeenCalledWith(
            translations.en['requests.success'],
            translations.en['trusted.successUpdate'],
        );
        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
