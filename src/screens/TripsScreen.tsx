import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
import JeepLayout from '../components/JeepLayout';



interface Booking {
    id: string;
    rideId: string;
    passengerId: string;
    seatsRequested: number;
    status: string;
    createdAt: string;
    roofCarrier: boolean;
    motionSickness: boolean;
}

const TripsScreen: React.FC = () => {
    const { colors, isDark } = useTheme();
    const { user, token } = useAuth();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

    const isDriver = user?.role === 'driver';

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Polling for real-time updates
        return () => clearInterval(interval);
    }, [isDriver]);

    const fetchData = async () => {
        try {
            const endpoint = isDriver ? '/api/rides/recent' : '/api/rides/bookings';
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(data || []);
                // For driver, auto-expand if there's only one active ride
                if (isDriver && data && data.length === 1 && !expandedRideId) {
                    setExpandedRideId(data[0].id);
                }
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderRequestItem = ({ item }: { item: any }) => {
        const isExpanded = expandedRideId === item.id;
        return (
            <View style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.requestTitle, { color: colors.textColor }]}>
                        {isDriver ? `Ride to ${item.dropoff}` : `Booking for ${item.ride?.vehicleModel || 'SUV'}`}
                    </Text>
                    <Text style={[styles.statusTag, { color: colors.primary }]}>
                        {(item.status || 'AVAILABLE').toUpperCase()}
                    </Text>
                </View>

                <View style={styles.details}>
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {isDriver ? `From: ${item.pickup}` : `From: ${item.ride?.pickup} to ${item.ride?.dropoff}`}
                    </Text>
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {isDriver ? `Seats Booked: ${item.seatsBooked || 0} / ${item.seatsTotal}` : `Seats Requested: ${item.seatsRequested}`}
                    </Text>
                    {item.roofCarrier && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• Needs Roof Carrier</Text>}
                    {item.motionSickness && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• Motion Sickness (Front Seat)</Text>}
                </View>

                {isDriver && (
                    <TouchableOpacity
                        style={[styles.viewLayoutBtn, { borderColor: colors.primary }]}
                        onPress={() => setExpandedRideId(isExpanded ? null : item.id)}>
                        <Text style={[styles.viewLayoutText, { color: colors.primary }]}>
                            {isExpanded ? 'Hide Seating' : 'View Seating'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* For Passengers - Always show or add a button */}
                {!isDriver && (
                    <View style={{ marginTop: 10 }}>
                        <JeepLayout
                            interactive={false}
                            selectedSeats={item.seatLayout || []}
                            takenSeats={(item.ride?.takenSeats || []).filter((s: number) => !(item.seatLayout || []).includes(s))}
                        />

                        {item.status === 'accepted' && (
                            <View style={styles.bookingIdCard}>
                                <View style={styles.bookingIdHeader}>
                                    <Text style={styles.bookingIdLabel}>OFFLINE BOOKING ID</Text>
                                    <View style={styles.verifiedTag}>
                                        <Text style={styles.verifiedTagText}>VERIFIED DRIVER</Text>
                                    </View>
                                </View>
                                <Text style={styles.bookingIdText}>RA-{item.id.slice(-4).toUpperCase()}</Text>
                                <Text style={styles.bookingIdFooter}>SHOW THIS TO YOUR DRIVER IN NO-NETWORK ZONES</Text>
                            </View>
                        )}
                    </View>
                )}

                {isExpanded && isDriver && (
                    <View style={{ marginTop: 20 }}>
                        <JeepLayout
                            interactive={false}
                            takenSeats={item.takenSeats || []}
                        />
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.textColor }]}>
                {isDriver ? 'My Rides' : 'My Bookings'}
            </Text>

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={bookings}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRequestItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={[styles.empty, { color: colors.subtextColor }]}>
                            {isDriver ? 'No published rides' : 'No trips found'}
                        </Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    list: {
        paddingBottom: 20,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusTag: {
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(91, 79, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    details: {
        marginBottom: 16,
    },
    detailText: {
        fontSize: 14,
        marginBottom: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    viewLayoutBtn: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    viewLayoutText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    bookingIdCard: {
        backgroundColor: '#111822',
        borderRadius: 16,
        padding: 20,
        marginTop: 20,
    },
    bookingIdHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    bookingIdLabel: {
        color: '#607D8B',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    verifiedTag: {
        backgroundColor: 'rgba(0, 191, 165, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    verifiedTagText: {
        color: '#00BFA5',
        fontSize: 9,
        fontWeight: 'bold',
    },
    bookingIdText: {
        color: '#00BFA5',
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 10,
    },
    bookingIdFooter: {
        color: '#4B5C6B',
        fontSize: 9,
        fontWeight: 'bold',
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
});

export default TripsScreen;
