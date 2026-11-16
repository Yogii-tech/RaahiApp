import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { createTtlCache } from '../utils/ttlCache';
import {
    FORM_LABEL_TYPOGRAPHY,
    FORM_INPUT_TEXT_TYPOGRAPHY,
    FORM_INPUT_BOX_METRICS,
} from '../styles/formTypography';

interface GeoResult {
    place_id: string | number;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
}

interface LocationInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    onSelect: (result: GeoResult) => void;
    placeholder?: string;
    labelColor?: string;
    containerZIndex?: number;
}

const COMMON_UTTARAKHAND_TOWNS: GeoResult[] = [
    { place_id: 't1', display_name: 'Almora, Uttarakhand', lat: '29.5892', lon: '79.6467', type: 'town' },
    { place_id: 't2', display_name: 'Bageshwar, Uttarakhand', lat: '29.8404', lon: '79.7694', type: 'town' },
    { place_id: 't3', display_name: 'Dehradun, Uttarakhand', lat: '30.3165', lon: '78.0322', type: 'city' },
    { place_id: 't4', display_name: 'Rishikesh, Uttarakhand', lat: '30.0869', lon: '78.2676', type: 'town' },
    { place_id: 't5', display_name: 'Haldwani, Uttarakhand', lat: '29.2183', lon: '79.5130', type: 'city' },
    { place_id: 't6', display_name: 'Nainital, Uttarakhand', lat: '29.3919', lon: '79.4542', type: 'town' },
    { place_id: 't7', display_name: 'Haridwar, Uttarakhand', lat: '29.9457', lon: '78.1642', type: 'city' },
    { place_id: 't8', display_name: 'Roorkee, Uttarakhand', lat: '29.8543', lon: '77.8880', type: 'city' },
    { place_id: 't9', display_name: 'Rudrapur, Uttarakhand', lat: '28.9816', lon: '79.4059', type: 'city' },
    { place_id: 't10', display_name: 'Kashipur, Uttarakhand', lat: '29.2104', lon: '78.9619', type: 'city' },
    { place_id: 't11', display_name: 'Pithoragarh, Uttarakhand', lat: '29.5829', lon: '80.2182', type: 'town' },
    { place_id: 't12', display_name: 'Ramnagar, Uttarakhand', lat: '29.3948', lon: '79.1271', type: 'town' },
    { place_id: 't13', display_name: 'Kotdwar, Uttarakhand', lat: '29.7491', lon: '78.5255', type: 'town' },
    { place_id: 't14', display_name: 'Mussoorie, Uttarakhand', lat: '30.4598', lon: '78.0664', type: 'town' },
    { place_id: 't15', display_name: 'Ranikhet, Uttarakhand', lat: '29.6434', lon: '79.4322', type: 'town' },
    { place_id: 't16', display_name: 'Chamoli, Uttarakhand', lat: '30.2736', lon: '79.3234', type: 'town' },
    { place_id: 't17', display_name: 'Uttarkashi, Uttarakhand', lat: '30.7268', lon: '78.4354', type: 'town' },
    { place_id: 't18', display_name: 'Pauri, Uttarakhand', lat: '30.1458', lon: '78.7758', type: 'town' },
    { place_id: 't19', display_name: 'Tehri, Uttarakhand', lat: '30.3807', lon: '78.4800', type: 'town' },
    { place_id: 't20', display_name: 'Joshimath, Uttarakhand', lat: '30.5506', lon: '79.5660', type: 'town' },
    { place_id: 't21', display_name: 'Badrinath, Uttarakhand', lat: '30.7433', lon: '79.4938', type: 'town' },
    { place_id: 't22', display_name: 'Kedarnath, Uttarakhand', lat: '30.7352', lon: '79.0669', type: 'town' },
    { place_id: 't23', display_name: 'Gangotri, Uttarakhand', lat: '30.9947', lon: '78.9398', type: 'town' },
    { place_id: 't24', display_name: 'Yamunotri, Uttarakhand', lat: '31.0140', lon: '78.4600', type: 'town' },
];

const DEFAULT_POPULAR_LOCATIONS: GeoResult[] = [
    { place_id: 'p1', display_name: 'Rishikesh, Uttarakhand', lat: '30.0869', lon: '78.2676', type: 'popular' },
    { place_id: 'p2', display_name: 'Dehradun, Uttarakhand', lat: '30.3165', lon: '78.0322', type: 'popular' },
    { place_id: 'p3', display_name: 'Bageshwar, Uttarakhand', lat: '29.8404', lon: '79.7694', type: 'popular' },
    { place_id: 'p4', display_name: 'Haldwani, Uttarakhand', lat: '29.2183', lon: '79.5130', type: 'popular' },
];

const LOCATION_SEARCH_DEBOUNCE_MS = 380;
const MIN_REMOTE_SEARCH_LENGTH = 2;
const LOCATION_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCATION_SEARCH_CACHE_MAX_ENTRIES = 60;

const locationSearchCache = createTtlCache<GeoResult[]>({
    maxEntries: LOCATION_SEARCH_CACHE_MAX_ENTRIES,
    ttlMs: LOCATION_SEARCH_CACHE_TTL_MS,
});

/** Clears shared autocomplete cache (intended for unit tests). */
export function _resetLocationSearchCacheForTests(): void {
    locationSearchCache.clear();
}

const buildCustomResult = (query: string): GeoResult => ({
    place_id: 'custom',
    display_name: `${query}, Uttarakhand (Custom)`,
    lat: '30.0869',
    lon: '78.2676',
    type: 'custom',
});

const LocationInput: React.FC<LocationInputProps> = ({
    label,
    value,
    onChangeText,
    onSelect,
    placeholder,
    labelColor,
    containerZIndex,
}) => {
    const { colors, isDark } = useTheme();
    const { logout } = useAuth();
    const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
    const suggestAbortRef = useRef<AbortController | null>(null);
    const suggestSeqRef = useRef(0);
    const inputFocusedRef = useRef(false);
    // On web, a click on a dropdown item fires: mousedown → input blur → mouseup → click.
    // If we close the dropdown on blur, the item's click never fires.
    // We track mousedown-on-dropdown so the blur handler knows to keep the dropdown open.
    const mouseDownOnDropdown = useRef(false);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            suggestAbortRef.current?.abort();
        };
    }, []);

    const fetchSuggestions = async (query: string) => {
        suggestAbortRef.current?.abort();
        const seq = ++suggestSeqRef.current;

        const trimmed = query.trim();
        if (trimmed.length < MIN_REMOTE_SEARCH_LENGTH) {
            setSuggestions([]);
            setLoading(false);
            return;
        }

        const lowerQuery = trimmed.toLowerCase();

        // 1. Check local Uttarakhand towns first for instant zero-network autocomplete.
        const localMatches = COMMON_UTTARAKHAND_TOWNS.filter(town =>
            town.display_name.toLowerCase().includes(lowerQuery)
        );
        if (localMatches.length > 0) {
            setSuggestions(localMatches);
            setLoading(false);
            return;
        }

        // 2. Check bounded client TTL cache before hitting backend / Nominatim proxy.
        const cached = locationSearchCache.get(lowerQuery);
        if (cached) {
            setSuggestions(cached);
            setLoading(false);
            return;
        }

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        suggestAbortRef.current = controller;
        setLoading(true);
        try {
            const res = await apiRequest(
                `/api/location/search?q=${encodeURIComponent(trimmed + ', Uttarakhand, India')}`,
                controller ? { signal: controller.signal } : {},
                logout
            );
            if (seq !== suggestSeqRef.current || controller?.signal.aborted) return;

            if (res.ok) {
                const data = await res.json();
                if (seq !== suggestSeqRef.current || controller?.signal.aborted) return;
                const mapped: GeoResult[] = Array.isArray(data) && data.length > 0
                    ? data.map((d: any) => ({
                        place_id: d.place_id,
                        display_name: d.display_name,
                        lat: d.lat,
                        lon: d.lon,
                        type: d.type,
                    }))
                    : [buildCustomResult(trimmed)];
                locationSearchCache.set(lowerQuery, mapped);
                setSuggestions(mapped);
            } else {
                setSuggestions([buildCustomResult(trimmed)]);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || controller?.signal.aborted) return;
            console.error('Geocoding search error:', err);
            if (seq === suggestSeqRef.current) {
                setSuggestions([buildCustomResult(trimmed)]);
            }
        } finally {
            if (seq === suggestSeqRef.current && !controller?.signal.aborted) {
                setLoading(false);
            }
        }
    };

    const scheduleBlurClose = (delayMs: number) => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        blurTimerRef.current = setTimeout(() => {
            if (!inputFocusedRef.current && !mouseDownOnDropdown.current) {
                setIsFocused(false);
                setShowDropdown(false);
            }
        }, delayMs);
    };

    const handleTextChange = (text: string) => {
        onChangeText(text);
        setShowDropdown(true);
        if (timerRef.current) clearTimeout(timerRef.current);

        if (text.trim().length >= MIN_REMOTE_SEARCH_LENGTH) {
            timerRef.current = setTimeout(() => {
                fetchSuggestions(text);
            }, LOCATION_SEARCH_DEBOUNCE_MS);
        } else {
            suggestSeqRef.current++;
            suggestAbortRef.current?.abort();
            setLoading(false);
            setSuggestions([]);
        }
    };

    const handleSelect = (item: GeoResult) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
        suggestSeqRef.current++;
        suggestAbortRef.current?.abort();
        setLoading(false);

        // Commit the FULL selected name (e.g. "Bageshwar") to both the parent's
        // value state AND the displayed input — this is the core fix for the
        // "typed partial text is submitted instead of selected full name" bug.
        const selectedName = item.display_name.split(',')[0].trim();
        onChangeText(selectedName);   // keep input in sync with selected value
        onSelect(item);               // inform parent with full GeoResult for coords etc.

        // Clear suggestions and close dropdown immediately after selection
        setSuggestions([]);
        setShowDropdown(false);
        setIsFocused(false);
        inputFocusedRef.current = false;
        mouseDownOnDropdown.current = false;
    };

    const showPopular = isFocused && value.trim().length < MIN_REMOTE_SEARCH_LENGTH && suggestions.length === 0;
    const displayList = suggestions.length > 0 ? suggestions : (showPopular ? DEFAULT_POPULAR_LOCATIONS : []);
    const shouldShow = showDropdown && (displayList.length > 0 || loading);

    return (
        <View style={[styles.container, { zIndex: containerZIndex !== undefined ? containerZIndex : 100 }]}>
            <Text style={[styles.label, { color: labelColor || colors.subtextColor }]}>
                {label.toUpperCase()}
            </Text>
            <View style={styles.spacer6} />
            <View style={[
                styles.inputWrapper,
                {
                    backgroundColor: colors.inputFillColor,
                    borderColor: isFocused ? colors.primary : colors.inputBorderColor,
                    borderWidth: isFocused ? 2 : 1
                }
            ]}>
                <TextInput
                    style={[
                        styles.input,
                        { color: colors.textColor },
                        // @ts-ignore
                        Platform.OS === 'web' && { outlineStyle: 'none', borderWidth: 0 }
                    ]}
                    value={value}
                    onChangeText={handleTextChange}
                    onFocus={() => {
                        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                        inputFocusedRef.current = true;
                        setIsFocused(true);
                        setShowDropdown(true);
                    }}
                    onBlur={() => {
                        inputFocusedRef.current = false;
                        // On web: if the user is pressing a dropdown item (mousedown fired on
                        // the dropdown container), keep the dropdown open so the click completes.
                        // The dropdown will be closed inside handleSelect or onMouseUp/Leave.
                        if (mouseDownOnDropdown.current) return;
                        // Small delay for native touch — gives time for onPress to register
                        scheduleBlurClose(200);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={colors.subtextColor}
                    autoComplete="off"
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
            </View>

            {shouldShow && (
                <View
                    style={[
                        styles.dropdown,
                        {
                            backgroundColor: colors.cardColor,
                            borderColor: colors.borderColor,
                            shadowColor: isDark ? '#000' : colors.primary
                        }
                    ]}
                    // Web-only: track mousedown so blur doesn't close dropdown before click fires
                    {...(Platform.OS === 'web' ? {
                        onMouseDown: () => {
                            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                            mouseDownOnDropdown.current = true;
                        },
                        onMouseUp: () => {
                            mouseDownOnDropdown.current = false;
                            if (!inputFocusedRef.current) {
                                scheduleBlurClose(150);
                            }
                        },
                        onMouseLeave: () => {
                            if (mouseDownOnDropdown.current) {
                                mouseDownOnDropdown.current = false;
                                if (!inputFocusedRef.current) {
                                    scheduleBlurClose(150);
                                }
                            }
                        },
                    } as any : {})}
                >
                    {showPopular && (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>🔥 POPULAR RECOMMENDATIONS</Text>
                        </View>
                    )}
                    <FlatList
                        data={displayList}
                        keyExtractor={(item, index) => item.place_id?.toString() || index.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.item, { borderBottomColor: colors.borderColor }]}
                                onPress={() => handleSelect(item)}>
                                <View style={styles.itemIconContainer}>
                                    <Text style={styles.itemIcon}>{suggestions.length > 0 ? '📍' : '✨'}</Text>
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={[styles.itemName, { color: colors.textColor }]} numberOfLines={1}>
                                        {item.display_name.split(',')[0]}
                                    </Text>
                                    <Text style={[styles.itemSub, { color: colors.subtextColor }]} numberOfLines={1}>
                                        {item.display_name.split(',').slice(1, 3).join(',')}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        style={{ maxHeight: 250 }}
                        keyboardShouldPersistTaps="always"
                    />
                </View>
            )}
        </View>
    );
};




const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 100,
    },
    label: {
        ...FORM_LABEL_TYPOGRAPHY,
        marginBottom: 8,
    },
    spacer6: { height: 0 }, // Handled by marginBottom in label
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        ...FORM_INPUT_BOX_METRICS,
    },
    input: {
        flex: 1,
        ...FORM_INPUT_TEXT_TYPOGRAPHY,
        height: '100%',
        padding: 0,
        backgroundColor: 'transparent',
    },
    loader: {
        marginLeft: 8,
    },
    dropdown: {
        position: 'absolute',
        top: 85,
        left: 0,
        right: 0,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 10,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        zIndex: 1000,
        overflow: 'hidden',
    },
    sectionHeader: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    sectionHeaderText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#888',
        letterSpacing: 1,
    },
    item: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemIcon: {
        fontSize: 14,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
    },
    itemSub: {
        fontSize: 11,
        marginTop: 2,
    },
});

export default LocationInput;
