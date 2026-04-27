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

import { API_BASE } from '../apiConfig';
import { apiRequest } from '../utils/api';

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
}

interface AvailableRidesScreenProps {
    searchPickup?: string;
    searchDropoff?: string;
    onBack: () => void;
    onSelectRide: (ride: Ride) => void;
}

const AvailableRidesScreen: React.FC<AvailableRidesScreenProps> = ({ searchPickup, searchDropoff, onBack, onSelectRide }) => {
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
            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await apiRequest(url.replace(API_BASE, ''), {}, logout);
            if (response.ok) {
                const data = await response.json();
                setRides(data);
            }
        } catch (err) {
            console.error('Failed to fetch rides:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderRideItem = ({ item }: { item: Ride }) => (
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
                    <Text style={[styles.label, { color: colors.subtextColor }]}>{t('available.perSeatPrice')}</Text>
                    <Text style={[styles.priceText, { color: '#00C853' }]}>₹ {item.pricePerSeat}</Text>
                </View>
            </View>
            <View style={styles.routeRow}>
                <Text style={[styles.routePoint, { color: colors.textColor }]}>{item.pickup.toUpperCase()}</Text>
                <Text style={[styles.routeArrow, { color: colors.subtextColor }]}>→</Text>
                <Text style={[styles.routePoint, { color: colors.textColor }]}>{item.dropoff.toUpperCase()}</Text>
            </View>

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
                    <Text style={[styles.seatsLeft, { color: '#00C853' }]}>{item.seatsTotal - item.seatsBooked} {t('available.seatsLeft')}</Text>
                    <View style={[styles.arrowBtn, { backgroundColor: colors.borderColor }]}>
                        <Text style={styles.arrowText}>›</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

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
