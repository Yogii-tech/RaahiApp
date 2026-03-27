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

const API_BASE = 'http://localhost:8081';

interface Ride {
    id: string;
    vehicleModel: string;
    vehicleNumber: string;
    pickup: string;
    dropoff: string;
    departureTime: string;
    seatsTotal: number;
    seatsBooked: number;
    takenSeats?: number[];
    pricePerSeat: number;
    driverName: string;
}

interface AvailableRidesScreenProps {
    onBack: () => void;
    onSelectRide: (ride: Ride) => void;
}

const AvailableRidesScreen: React.FC<AvailableRidesScreenProps> = ({ onBack, onSelectRide }) => {
    const { colors, isDark } = useTheme();
    const { token } = useAuth();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/rides/available`, {
                headers: { Authorization: `Bearer ${token}` },
            });
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
                    <Text style={[styles.label, { color: colors.subtextColor }]}>DEPARTS</Text>
                    <Text style={[styles.timeText, { color: colors.textColor }]}>{item.departureTime}</Text>
                </View>
                <View style={styles.vehicleContainer}>
                    <Text style={[styles.vehicleModel, { color: colors.textColor }]}>{item.vehicleModel}</Text>
                    <Text style={[styles.vehicleNumber, { color: colors.subtextColor }]}>{item.vehicleNumber}</Text>
                </View>
                <View style={styles.priceContainer}>
                    <Text style={[styles.label, { color: colors.subtextColor }]}>PER SEAT PRICE</Text>
                    <Text style={[styles.priceText, { color: '#00C853' }]}>₹ {item.pricePerSeat}</Text>
                </View>
            </View>
            <View style={{ marginBottom: 15, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.textColor, fontWeight: 'bold', fontSize: 13 }}>{item.pickup.toUpperCase()}</Text>
                <Text style={{ color: colors.subtextColor, marginHorizontal: 8 }}>•</Text>
                <Text style={{ color: colors.textColor, fontWeight: 'bold', fontSize: 13 }}>{item.dropoff.toUpperCase()}</Text>
            </View>

            <View style={styles.rideFooter}>
                <View style={styles.driverInfo}>
                    <View style={[styles.avatar, { backgroundColor: '#37474F' }]}>
                        <Text style={styles.avatarText}>{(item.driverName || 'V')[0].toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={[styles.driverName, { color: colors.textColor }]}>{item.driverName || 'Community Driver'} ✅</Text>
                        <Text style={[styles.driverRole, { color: colors.subtextColor }]}>COMMUNITY DRIVER</Text>
                    </View>
                </View>
                <View style={styles.seatsInfo}>
                    <Text style={[styles.seatsLeft, { color: '#00C853' }]}>{item.seatsTotal - item.seatsBooked} SEATS LEFT</Text>
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
                    <Text style={[styles.backText, { color: colors.textColor }]}>‹ BACK</Text>
                </TouchableOpacity>
                <Text style={[styles.routeDetails, { color: colors.subtextColor }]}>ROUTE DETAILS</Text>
            </View>

            <Text style={[styles.title, { color: colors.textColor }]}>Available Cabs</Text>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRideItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={{ color: colors.textColor, textAlign: 'center', marginTop: 20 }}>No rides available</Text>}
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
});

export default AvailableRidesScreen;
