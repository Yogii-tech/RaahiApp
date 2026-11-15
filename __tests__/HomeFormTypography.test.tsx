(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';

const mockApiRequest = jest.fn();
const mockLogout = jest.fn(async () => {});
const mockSetAuth = jest.fn(async () => {});
const mockNotify = jest.fn();

let mockUser: any = {
    id: 'user-passenger',
    name: 'Test Traveler',
    phone_number: '9876543210',
    role: 'passenger',
};

jest.mock('@react-navigation/native', () => ({
    useIsFocused: () => true,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/apiConfig', () => ({
    API_BASE: 'http://localhost:8080',
}));

jest.mock('../src/context/ThemeContext', () => ({
    useTheme: () => ({
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
    }),
}));

jest.mock('../src/context/AuthContext', () => ({
    useAuth: () => ({
        token: 'test-token',
        refreshToken: 'test-refresh',
        user: mockUser,
        logout: mockLogout,
        setAuth: mockSetAuth,
    }),
}));

jest.mock('../src/context/LanguageContext', () => {
    const { translations } = require('../src/translations');
    return {
        useLanguage: () => ({
            t: (key: string) => (translations.en as Record<string, string>)[key] || key,
        }),
    };
});

jest.mock('../src/utils/api', () => ({
    apiRequest: (...args: any[]) => mockApiRequest(...args),
    getAuthSessionGeneration: () => 1,
}));

jest.mock('../src/utils/notify', () => ({
    notify: (...args: any[]) => mockNotify(...args),
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

jest.mock('../src/utils/formDraftStorage', () => ({
    saveFormDraft: jest.fn(),
    loadFormDraft: jest.fn((_k: string, fallback: string) => fallback),
    clearFormDraft: jest.fn(),
    getTodayDisplayDate: () => '15/11/2026',
    isTodayOrFutureDisplayDate: () => true,
    resolveDraftDate: (val: string) => val || '15/11/2026',
}));

jest.mock('react-native-vector-icons/Ionicons', () => {
    const ReactLib = require('react');
    const { Text: RNText } = require('react-native');
    return function MockIonicons({ name, size, color }: any) {
        return ReactLib.createElement(
            RNText,
            { testID: `ionicon-${name}`, style: { fontSize: size, color } },
            name,
        );
    };
});

jest.mock('../src/screens/AvailableRidesScreen', () => () => null);
jest.mock('../src/screens/BookRideScreen', () => () => null);
jest.mock('../src/screens/ResubmitDocsView', () => () => null);

import HomeScreen from '../src/screens/HomeScreen';
import ParcelBookingView from '../src/screens/ParcelBookingView';

const flattenStyle = (style: any): Record<string, any> => {
    if (!style) return {};
    if (Array.isArray(style)) {
        return style.reduce((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
    }
    return typeof style === 'object' ? style : {};
};

const getTextContent = (node: ReactTestInstance): string => {
    const { children } = node.props;
    if (Array.isArray(children)) {
        return children.filter(c => typeof c === 'string' || typeof c === 'number').join('');
    }
    return typeof children === 'string' || typeof children === 'number' ? String(children) : '';
};

const findTextNode = (root: ReactTestInstance, exactText: string): ReactTestInstance => {
    const matches = root.findAllByType(Text).filter(n => getTextContent(n).trim() === exactText);
    expect(matches.length).toBeGreaterThan(0);
    return matches[0];
};

const flushAsync = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

describe('HomeScreen & ParcelBookingView form typography parity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockApiRequest.mockResolvedValue({
            ok: true,
            text: async () => '[]',
            json: async () => [],
        });
    });

    it('matches DEPARTURE DATE label and date value typography to PICKUP LOCATION and DROPOFF LOCATION on HomeScreen (passenger)', async () => {
        mockUser = {
            id: 'user-passenger',
            name: 'Test Traveler',
            phone_number: '9876543210',
            role: 'passenger',
        };

        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<HomeScreen />);
        });
        await flushAsync();

        try {
            const pickupLabelStyle = flattenStyle(findTextNode(tree.root, 'PICKUP LOCATION').props.style);
            const dropoffLabelStyle = flattenStyle(findTextNode(tree.root, 'DROPOFF LOCATION').props.style);
            const departureDateLabelStyle = flattenStyle(findTextNode(tree.root, 'DEPARTURE DATE').props.style);

            // Pickup & dropoff stay at 11px, bold, 1.5 tracking — Departure Date matches identically
            expect(pickupLabelStyle.fontSize).toBe(11);
            expect(dropoffLabelStyle.fontSize).toBe(11);
            expect(departureDateLabelStyle.fontSize).toBe(pickupLabelStyle.fontSize);
            expect(departureDateLabelStyle.fontWeight).toBe(pickupLabelStyle.fontWeight);
            expect(departureDateLabelStyle.letterSpacing).toBe(pickupLabelStyle.letterSpacing);

            // Date field text & box height match LocationInput input typography/height
            const locationInputs = tree.root.findAllByType(TextInput);
            expect(locationInputs.length).toBeGreaterThanOrEqual(2);
            const pickupInputStyle = flattenStyle(locationInputs[0].props.style);

            const dateTextNode = findTextNode(tree.root, '15/11/2026');
            const dateTextStyle = flattenStyle(dateTextNode.props.style);
            expect(dateTextStyle.fontSize).toBe(pickupInputStyle.fontSize);
            expect(dateTextStyle.fontSize).toBe(15);
            expect(dateTextStyle.fontWeight).toBeUndefined();

            const dateButton = tree.root
                .findAllByType(TouchableOpacity)
                .find(btn =>
                    btn.findAllByType(Text).some(n => getTextContent(n).trim() === '15/11/2026'),
                )!;
            expect(dateButton).toBeDefined();
            const dateButtonStyle = flattenStyle(dateButton.props.style);
            expect(dateButtonStyle.height).toBe(52);
            expect(dateButtonStyle.paddingHorizontal).toBe(16);
            expect(dateButtonStyle.borderRadius).toBe(12);
        } finally {
            act(() => {
                tree.unmount();
            });
        }
    });

    it('matches driver sibling labels (PER SEAT PASSENGER COST, DEPARTURE DATE, DEPARTURE TIME) to LocationInput labels', async () => {
        mockUser = {
            id: 'user-driver',
            name: 'Test Driver',
            phone_number: '9876543210',
            role: 'driver',
            verification_status: 'verified',
        };

        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<HomeScreen />);
        });
        await flushAsync();

        try {
            const pickupStyle = flattenStyle(findTextNode(tree.root, 'PICKUP LOCATION').props.style);
            const priceLabelStyle = flattenStyle(
                findTextNode(tree.root, 'PER SEAT PASSENGER COST (₹)').props.style,
            );
            const dateLabelStyle = flattenStyle(findTextNode(tree.root, 'DEPARTURE DATE').props.style);
            const timeLabelStyle = flattenStyle(findTextNode(tree.root, 'DEPARTURE TIME').props.style);

            for (const labelStyle of [priceLabelStyle, dateLabelStyle, timeLabelStyle]) {
                expect(labelStyle.fontSize).toBe(pickupStyle.fontSize);
                expect(labelStyle.fontWeight).toBe(pickupStyle.fontWeight);
                expect(labelStyle.letterSpacing).toBe(pickupStyle.letterSpacing);
            }
        } finally {
            act(() => {
                tree.unmount();
            });
        }
    });

    it('matches PICKUP DATE typography and value text to LocationInput in ParcelBookingView Step 1', async () => {
        let tree!: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<ParcelBookingView onBack={jest.fn()} />);
        });
        await flushAsync();

        try {
            const pickupLabelStyle = flattenStyle(findTextNode(tree.root, 'PICKUP LOCATION').props.style);
            const dropoffLabelStyle = flattenStyle(findTextNode(tree.root, 'DROPOFF LOCATION').props.style);
            const pickupDateLabelStyle = flattenStyle(findTextNode(tree.root, 'PICKUP DATE').props.style);

            expect(pickupDateLabelStyle.fontSize).toBe(pickupLabelStyle.fontSize);
            expect(pickupDateLabelStyle.fontWeight).toBe(pickupLabelStyle.fontWeight);
            expect(pickupDateLabelStyle.letterSpacing).toBe(pickupLabelStyle.letterSpacing);
            expect(dropoffLabelStyle.fontSize).toBe(11);

            const locationInputStyle = flattenStyle(tree.root.findAllByType(TextInput)[0].props.style);
            const dateValueStyle = flattenStyle(findTextNode(tree.root, '15/11/2026').props.style);
            expect(dateValueStyle.fontSize).toBe(locationInputStyle.fontSize);
            expect(dateValueStyle.fontSize).toBe(15);
            expect(dateValueStyle.fontWeight).toBeUndefined();
        } finally {
            act(() => {
                tree.unmount();
            });
        }
    });
});
