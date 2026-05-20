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
import { API_BASE } from '../apiConfig';

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
}

const LocationInput: React.FC<LocationInputProps> = ({
    label,
    value,
    onChangeText,
    onSelect,
    placeholder,
    labelColor,
}) => {
    const { colors, isDark } = useTheme();
    const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
    const [popular, setPopular] = useState<GeoResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch popular locations on mount or focus
    useEffect(() => {
        if (isFocused && value.length < 3) {
            fetchPopular();
        } else {
            setPopular([]);
        }
    }, [isFocused, value]);

    const fetchPopular = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/locations/suggestions`);
            if (res.ok) {
                const data = await res.json();
                setPopular(data.map((item: any) => ({
                    place_id: item.id,
                    display_name: item.displayName,
                    lat: item.lat,
                    lon: item.lon,
                    type: item.type,
                })));
            }
        } catch (err) {
            console.error('Failed to fetch popular locations:', err);
        }
    };

    const fetchSuggestions = async (query: string) => {
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            // Using the modern geocoding endpoint if available, or a public one
            // For simplicity, we'll try to use the Nominatim through the tracking server if it's up
            // Or just use the tracking server's geocode endpoint
            const res = await fetch(`http://localhost:4000/api/geocode?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data);
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTextChange = (text: string) => {
        onChangeText(text);
        if (timerRef.current) clearTimeout(timerRef.current);
        
        if (text.length >= 3) {
            timerRef.current = setTimeout(() => {
                fetchSuggestions(text);
            }, 500);
        } else {
            setSuggestions([]);
        }
    };

    const handleSelect = async (item: GeoResult) => {
        onSelect(item);
        setShowDropdown(false);
        setIsFocused(false);
        
        // Record the selection
        try {
            await fetch(`${API_BASE}/api/locations/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: item.display_name,
                    lat: item.lat,
                    lon: item.lon,
                    type: item.type,
                }),
            });
        } catch (err) {
            console.error('Failed to record location:', err);
        }
    };

    const displayList = suggestions.length > 0 ? suggestions : popular;
    const shouldShow = showDropdown && (displayList.length > 0 || loading);

    return (
        <View style={styles.container}>
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
                        setIsFocused(true);
                        setShowDropdown(true);
                    }}
                    onBlur={() => {
                        // Delay hide to allow clicks on suggestions
                        setTimeout(() => {
                            setIsFocused(false);
                            setShowDropdown(false);
                        }, 200);
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={colors.subtextColor}
                    autoComplete="off"
                />
                {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />}
            </View>

            {shouldShow && (
                <View style={[
                    styles.dropdown, 
                    { 
                        backgroundColor: colors.cardColor, 
                        borderColor: colors.borderColor,
                        shadowColor: isDark ? '#000' : colors.primary 
                    }
                ]}>
                    {popular.length > 0 && suggestions.length === 0 && (
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
        fontWeight: 'bold',
        fontSize: 11,
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    spacer6: { height: 0 }, // Handled by marginBottom in label
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1,
    },
    input: {
        flex: 1,
        fontSize: 15,
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
