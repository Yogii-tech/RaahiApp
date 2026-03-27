import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import JeepLayout from '../components/JeepLayout';

const API_BASE = 'http://localhost:8081';

interface Booking {
    id: string;
    rideId: string;
    passengerId: string;
    seatsRequested: number;
    seatLayout?: number[];
    status: string;
    createdAt: string;
    roofCarrier: boolean;
    motionSickness: boolean;
}

interface RequestsOverlayProps {
    onClose?: () => void;
}

const RequestsOverlay: React.FC<RequestsOverlayProps> = ({ onClose }) => {
    const { colors, isDark } = useTheme();
    const { token, user } = useAuth();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const isDriver = user?.role === 'driver';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const endpoint = isDriver ? '/api/rides/requests' : '/api/rides/bookings';
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setBookings(data || []);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (bookingId: string, status: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/rides/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });
            if (response.ok) {
                Alert.alert('Success', `Booking ${status}`);
                fetchData();
            }
        } catch (err) {
            console.error('Update error:', err);
            Alert.alert('Error', 'Could not update status.');
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        if (!isDriver && item.status === 'pending') return null;

        return (
            <View style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                {isDriver ? (
                    <>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.requestTitle, { color: colors.textColor }]}>
                                New Ride Request
                            </Text>
                            <Text style={[styles.statusTag, { color: colors.primary }]}>{item.status.toUpperCase()}</Text>
                        </View>

                        <View style={styles.details}>
                            <Text style={[styles.detailText, { color: colors.subtextColor }]}>Seats Requested: {item.seatsRequested}</Text>
                            {item.roofCarrier && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• Needs Roof Carrier</Text>}
                            {item.motionSickness && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• Motion Sickness (Front Seat)</Text>}
                        </View>

                        {/* Layout for Driver to see requested seats */}
                        <View style={{ marginBottom: 20 }}>
                            <JeepLayout
                                interactive={false}
                                takenSeats={item.seatLayout || []}
                                numSeatsRequested={item.seatsRequested}
                            />
                        </View>

                        {item.status === 'pending' ? (
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'accepted')}>
                                    <Text style={styles.btnText}>Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#F44336' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'rejected')}>
                                    <Text style={styles.btnText}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: item.status === 'accepted' ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
                                    {item.status === 'accepted' ? '✓ ACCEPTED' : '✗ REJECTED'}
                                </Text>
                            </View>
                        )}
                    </>
                ) : item.status === 'accepted' ? (
                    <>
                        <View style={styles.successHeader}>
                            <View style={styles.successIconOuter}>
                                <Text style={styles.successIconInner}>✓</Text>
                            </View>
                            <Text style={[styles.successText, { color: colors.textColor }]}>SEAT RESERVED!</Text>
                            <Text style={[styles.successSubtitle, { color: colors.subtextColor }]}>
                                Verified. Present this ID to your driver at pickup.
                            </Text>
                        </View>

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
                    </>
                ) : (
                    <View style={styles.rejectionContainer}>
                        <View style={styles.rejectionIconOuter}>
                            <Text style={styles.rejectionIconInner}>✗</Text>
                        </View>
                        <Text style={[styles.rejectionText, { color: colors.textColor }]}>SEATS NOT BOOKED</Text>
                        <Text style={[styles.rejectionSubtitle, { color: colors.subtextColor }]}>
                            Your request was declined by the driver. Please try booking another ride.
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textColor }]}>
                    {isDriver ? 'Requests' : 'Notifications'}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Close</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={bookings.filter(b => isDriver || b.status !== 'pending')}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={[styles.empty, { color: colors.subtextColor }]}>
                            {isDriver ? 'No pending requests' : 'No notifications'}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 8,
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
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    successHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    successIconOuter: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 191, 165, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#00BFA5',
    },
    successIconInner: {
        color: '#00BFA5',
        fontSize: 30,
        fontWeight: 'bold',
    },
    successText: {
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    successSubtitle: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.7,
    },
    bookingIdCard: {
        backgroundColor: '#111822',
        borderRadius: 16,
        padding: 20,
        marginTop: 10,
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
    rejectionContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    rejectionIconOuter: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F44336',
    },
    rejectionIconInner: {
        color: '#F44336',
        fontSize: 30,
        fontWeight: 'bold',
    },
    rejectionText: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 8,
    },
    rejectionSubtitle: {
        fontSize: 12,
        textAlign: 'center',
        opacity: 0.7,
        lineHeight: 18,
    },
});

export default RequestsOverlay;
