import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Hardcoded coordinates for villages missing from OSM/Nominatim
const KNOWN_LOCATIONS: Record<string, { lat: string; lon: string }> = {
    reema: { lat: '29.833', lon: '79.800' },
    rima: { lat: '29.833', lon: '79.800' },
};

const geocodeLocation = async (name: string): Promise<{ lat: string; lon: string } | null> => {
    const key = name.toLowerCase().trim();
    if (KNOWN_LOCATIONS[key]) return KNOWN_LOCATIONS[key];
    // Always append region to avoid resolving to wrong continent
    const query = `${name}, Uttarakhand, India`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: data[0].lat, lon: data[0].lon };
};

const DistanceDisplay = ({ pickup, dropoff, color }: { pickup?: string, dropoff?: string, color: string }) => {
    const [info, setInfo] = useState<string>('...');
    useEffect(() => {
        if (!pickup || !dropoff) return;
        let mounted = true;
        const fetchDist = async () => {
            try {
                const pCoords = await geocodeLocation(pickup);
                if (!pCoords) return;
                const dCoords = await geocodeLocation(dropoff);
                if (!dCoords) return;

                const url = `https://router.project-osrm.org/route/v1/driving/${pCoords.lon},${pCoords.lat};${dCoords.lon},${dCoords.lat}?overview=false`;
                const rRes = await fetch(url);
                const rData = await rRes.json();

                if (rData.routes && rData.routes.length > 0 && mounted) {
                    const km = Math.round(rData.routes[0].distance / 1000);
                    const hrs = Math.round(rData.routes[0].duration / 3600);
                    setInfo(`${km} KM · ${hrs}h`);
                }
            } catch (e) {
                console.log(e);
            }
        };
        fetchDist();
        return () => { mounted = false; };
    }, [pickup, dropoff]);

    return <Text style={{ fontSize: 12, fontWeight: 'bold', color: color, marginTop: 4 }}>{info}</Text>;
};

import { API_BASE } from '../apiConfig';
import { apiRequest } from '../utils/api';

interface StopInfo {
    name: string;
    distanceM: number;
    lat: number;
    lon: number;
}

interface Ride {
    id: string;
    vehicleModel: string;
    vehicleNumber: string;
    pickup: string;
    dropoff: string;
    departureTime: string;
    date?: string;
    seatsTotal: number;
    seatsBooked: number;
    takenSeats?: number[];
    pricePerSeat: number;
    driverName: string;
    discoveredStops?: StopInfo[];
    segmentPricePerSeat?: number;
    segmentDistanceKm?: number;
    matchedPickup?: string;
    matchedDropoff?: string;
    totalDistanceM?: number;
}

interface AvailableRidesScreenProps {
    searchPickup?: string;
    searchDropoff?: string;
    searchDate?: string;
    onBack: () => void;
    onSelectRide: (ride: Ride) => void;
}

const AvailableRidesScreen: React.FC<AvailableRidesScreenProps> = ({ searchPickup, searchDropoff, searchDate, onBack, onSelectRide }) => {
    const { colors, isDark } = useTheme();
    const { token, logout } = useAuth();
    const { t } = useLanguage();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        try {
            let url = `${API_BASE}/api/rides/available`;
            const queryParams = [];
            if (searchPickup) queryParams.push(`pickup=${encodeURIComponent(searchPickup)}`);
            if (searchDropoff) queryParams.push(`dropoff=${encodeURIComponent(searchDropoff)}`);
            if (searchDate) queryParams.push(`date=${encodeURIComponent(searchDate)}`);
            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await apiRequest(url.replace(API_BASE, ''), {}, logout);
            if (response.ok) {
                const data = await response.json();
                console.log('Fetched rides:', data); // Debug log
                setRides(data);
            }
        } catch (err) {
            console.error('Failed to fetch rides:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderRideItem = ({ item }: { item: Ride }) => {
        // Use segment price if available, otherwise full price
        const displayPrice = item.segmentPricePerSeat && item.segmentPricePerSeat > 0
            ? item.segmentPricePerSeat
            : item.pricePerSeat;

        // Display route: matched pickup → matched dropoff, or full route
        const pickupDisplay = item.matchedPickup || item.pickup;
        const dropoffDisplay = item.matchedDropoff || item.dropoff;
        const isSegment = item.matchedPickup && item.matchedDropoff;

        return (
            <TouchableOpacity
                style={[styles.rideCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                onPress={() => onSelectRide(item)}>
                <View style={styles.rideHeader}>
                    <View style={styles.timeContainer}>
                        <Text style={[styles.label, { color: colors.subtextColor }]}>{t('available.departs')}</Text>
                        <Text style={[styles.timeText, { color: colors.textColor }]}>{item.departureTime}</Text>
                    </View>
                    <View style={styles.vehicleContainer}>
                        <Text style={[styles.vehicleModel, { color: colors.textColor }]}>{item.vehicleModel}</Text>
                        <Text style={[styles.vehicleNumber, { color: colors.subtextColor }]}>{item.vehicleNumber}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                        <Text style={[styles.label, { color: colors.subtextColor }]}>
                            {isSegment ? t('available.segmentPrice') || 'SEGMENT PRICE' : t('available.perSeatPrice')}
                        </Text>
                        <Text style={[styles.priceText, { color: '#00C853' }]}>₹ {Math.round(displayPrice)}</Text>
                    </View>
                </View>

                {/* Route display */}
                <View style={styles.routeRow}>
                    <Text style={[styles.routePoint, { color: colors.textColor }]}>{pickupDisplay.toUpperCase()}</Text>
                    <Text style={[styles.routeArrow, { color: colors.subtextColor }]}>→</Text>
                    <Text style={[styles.routePoint, { color: colors.textColor }]}>{dropoffDisplay.toUpperCase()}</Text>
                </View>

                {/* Full route label if this is a segment of a longer ride */}
                {isSegment && (
                    <View style={[styles.segmentBadge, { backgroundColor: isDark ? 'rgba(0,255,255,0.08)' : 'rgba(91,79,255,0.08)' }]}>
                        <Text style={{ fontSize: 10, color: isDark ? '#00BFFF' : '#5B4FFF', fontWeight: '600' }}>
                            🚐 Full route: {item.pickup} → {item.dropoff}
                        </Text>
                    </View>
                )}

                {/* Discovered stops preview */}
                {item.discoveredStops && item.discoveredStops.length > 2 && (
                    <View style={[styles.stopsPreview, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#00FFFF' : '#5B4FFF', marginBottom: 6, letterSpacing: 0.5 }}>
                            📍 ROUTE VIA
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.subtextColor, lineHeight: 16 }} numberOfLines={2}>
                            {item.discoveredStops.map(s => s.name).join(' → ')}
                        </Text>
                    </View>
                )}

                {/* Date & Time Row */}
                <View style={styles.dateTimeRow}>
                    <View style={styles.dateTimeChip}>
                        <Text style={styles.dateTimeChipIcon}>📅</Text>
                        <Text style={[styles.dateTimeChipText, { color: colors.textColor }]}>{item.date || t('available.noDate')}</Text>
                    </View>
                    <View style={[styles.dateTimeChip, { marginLeft: 10 }]}>
                        <Text style={styles.dateTimeChipIcon}>🕒</Text>
                        <Text style={[styles.dateTimeChipText, { color: colors.textColor }]}>{item.departureTime || '—'}</Text>
                    </View>
                    {item.segmentDistanceKm && item.segmentDistanceKm > 0 ? (
                        <View style={[styles.dateTimeChip, { marginLeft: 10, backgroundColor: 'rgba(0, 200, 83, 0.12)' }]}>
                            <Text style={styles.dateTimeChipIcon}>📏</Text>
                            <Text style={[styles.dateTimeChipText, { color: '#00C853' }]}>~ {Math.round(item.segmentDistanceKm)} km</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.rideFooter}>
                    <View style={styles.driverInfo}>
                        <View style={[styles.avatar, { backgroundColor: '#37474F' }]}>
                            <Text style={styles.avatarText}>{(item.driverName || 'V')[0].toUpperCase()}</Text>
                        </View>
                        <View>
                            <Text style={[styles.driverName, { color: colors.textColor }]}>{item.driverName || t('available.communityDriver')} ✅</Text>
                            <Text style={[styles.driverRole, { color: colors.subtextColor }]}>{t('available.communityDriver').toUpperCase()}</Text>
                        </View>
                    </View>
                    <View style={styles.seatsInfo}>
                        <Text style={[styles.seatsLeft, { color: '#00C853' }]}>{item.seatsTotal - (item.takenSeats?.length || 0)} {t('available.seatsLeft')}</Text>
                        <View style={[styles.arrowBtn, { backgroundColor: colors.borderColor, marginTop: 4 }]}>
                            <Text style={styles.arrowText}>›</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Text style={[styles.backText, { color: colors.textColor }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.routeDetails, { color: colors.subtextColor }]}>{t('available.routeDetails')}</Text>
            </View>
            <Text style={[styles.title, { color: colors.textColor }]}>{t('available.title')}</Text>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRideItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={{ color: colors.textColor, textAlign: 'center', marginTop: 20 }}>{t('available.noRides')}</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        justifyContent: 'space-between',
    },
    backText: {
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.7,
    },
    routeDetails: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginVertical: 15,
    },
    listContent: {
        paddingBottom: 20,
    },
    rideCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 15,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    timeText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    vehicleModel: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    vehicleNumber: {
        fontSize: 12,
        textAlign: 'center',
    },
    priceText: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    rideFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    driverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    driverName: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    driverRole: {
        fontSize: 10,
    },
    seatsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seatsLeft: {
        fontSize: 10,
        fontWeight: 'bold',
        marginRight: 10,
    },
    arrowBtn: {
        width: 24,
        height: 24,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    arrowText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    timeContainer: { flex: 1 },
    vehicleContainer: { flex: 2 },
    priceContainer: { flex: 1, alignItems: 'flex-end' },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    routePoint: {
        fontWeight: 'bold',
        fontSize: 13,
        textAlign: 'center',
    },
    routeArrow: {
        marginHorizontal: 8,
        fontSize: 16,
    },
    segmentBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        marginBottom: 10,
        alignSelf: 'flex-start' as const,
    },
    stopsPreview: {
        borderTopWidth: 1,
        paddingTop: 10,
        paddingBottom: 10,
        marginBottom: 10,
    },
    dateTimeRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    dateTimeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(91, 79, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    dateTimeChipIcon: {
        fontSize: 12,
        marginRight: 5,
    },
    dateTimeChipText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default AvailableRidesScreen;
