import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Alert,
    Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

import AvailableRidesScreen from './AvailableRidesScreen';
import BookRideScreen from './BookRideScreen';

interface HomeScreenProps {
    onSosPressed?: () => void;
}

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
}

const API_BASE = 'http://localhost:8081';

const HomeScreen: React.FC<HomeScreenProps> = ({ onSosPressed }) => {
    const { isDark, colors } = useTheme();
    const { token, user } = useAuth();
    const [view, setView] = useState<string>('home');
    const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
    const [rideType, setRideType] = useState<0 | 1>(0);
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [recentRides, setRecentRides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showPostSuccess, setShowPostSuccess] = useState(false);

    useEffect(() => {
        fetchRecentRides();
    }, []);

    const fetchRecentRides = async () => {
        try {
            setLoading(true);
            setError(false);
            const response = await fetch(`${API_BASE}/api/rides/recent`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                const data = await response.json();
                setRecentRides(data);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleFindRides = async () => {
        if (!pickup.trim() || !dropoff.trim()) {
            return;
        }

        try {
            await fetch(`${API_BASE}/api/rides/recent`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pickup: pickup.trim(),
                    dropoff: dropoff.trim(),
                    rideType: rideType === 0 ? 'shared' : 'private',
                }),
            });

            setView('available');
        } catch (err) {
            console.error('Failed to save recent ride:', err);
            setView('available');
        }
    };


    const handlePostRide = async () => {
        if (!pickup.trim() || !dropoff.trim()) return;

        try {
            const response = await fetch(`${API_BASE}/api/rides/create`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pickup: pickup.trim(),
                    dropoff: dropoff.trim(),
                    vehicleModel: "Mountain SUV", // Mocked for now or add input
                    vehicleNumber: "UK07-AX-4421", // Mocked for now or add input
                    departureTime: "08:00 AM", // Mocked for now or add input
                    seatsTotal: 5,
                    pricePerSeat: 350,
                }),
            });

            if (response.ok) {
                setPickup('');
                setDropoff('');
                setShowPostSuccess(true);
                fetchRecentRides(); // Refresh recent list
            }
        } catch (err) {
            console.error('Post ride error:', err);
        }
    };

    const isDriver = user?.role === 'driver';

    if (view === 'available') {
        return (
            <AvailableRidesScreen
                onBack={() => setView('home')}
                onSelectRide={(ride) => {
                    setSelectedRide(ride);
                    setView('book');
                }}
            />
        );
    }

    if (view === 'book' && selectedRide) {
        return (
            <BookRideScreen
                ride={selectedRide}
                onBack={() => setView('available')}
                onBookingComplete={() => setView('home')}
            />
        );
    }

    const pickupLabelColor = isDark ? '#00FFFF' : '#5B4FFF';
    const dropoffLabelColor = isDark ? '#FF4081' : '#5B4FFF';
    const recentLabelColor = isDark ? '#00FFFF' : '#5B4FFF';

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Greeting */}
            <Text style={[styles.greeting, { color: colors.textColor }]}>
                {isDriver ? 'Hello, Driver 🚕' : 'Namaste, Traveler 🙏'}
            </Text>
            <View style={styles.spacer6} />
            <Text style={[styles.subGreeting, { color: colors.subtextColor }]}>
                {isDriver ? 'Provide a safe ride today.' : 'Ready for your next adventure?'}
            </Text>

            <View style={styles.spacer24} />

            {/* Ride Card */}
            <View
                style={[
                    styles.rideCard,
                    {
                        backgroundColor: colors.cardColor,
                        borderColor: colors.borderColor,
                        shadowColor: isDark ? '#000' : '#5B4FFF',
                    },
                ]}>

                <Text style={[styles.fieldLabel, { color: pickupLabelColor }]}>
                    PICKUP LOCATION
                </Text>
                <View style={styles.spacer6} />
                <TextInput
                    style={[
                        styles.textInput,
                        {
                            color: colors.textColor,
                            backgroundColor: colors.inputFillColor,
                            borderColor: colors.inputBorderColor,
                        },
                    ]}
                    value={pickup}
                    onChangeText={setPickup}
                    placeholderTextColor={colors.subtextColor}
                />

                <View style={styles.spacer14} />

                <Text style={[styles.fieldLabel, { color: dropoffLabelColor }]}>
                    DROPOFF LOCATION
                </Text>
                <View style={styles.spacer6} />
                <TextInput
                    style={[
                        styles.textInput,
                        {
                            color: colors.textColor,
                            backgroundColor: colors.inputFillColor,
                            borderColor: colors.inputBorderColor,
                        },
                    ]}
                    value={dropoff}
                    onChangeText={setDropoff}
                    placeholderTextColor={colors.subtextColor}
                />

                <View style={styles.spacer18} />

                <TouchableOpacity
                    style={[styles.findButton, { backgroundColor: colors.primary }]}
                    onPress={isDriver ? handlePostRide : handleFindRides}
                    activeOpacity={0.85}>
                    <Text style={styles.findButtonText}>
                        {isDriver ? 'Post This Ride' : 'Find Shared Rides'}
                    </Text>
                </TouchableOpacity>

            </View>

            <View style={styles.spacer28} />

            {/* Recent Routes */}
            <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
                RECENT ROUTES
            </Text>
            <View style={styles.spacer14} />

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" />
            ) : error ? (
                <Text style={styles.errorText}>Error loading recent rides</Text>
            ) : (recentRides || []).length === 0 ? (
                <Text style={{ color: colors.textColor }}>No recent rides found</Text>
            ) : (
                <View style={styles.recentRow}>
                    {(recentRides || []).slice(0, 2).map((ride, index) => (

                        <View
                            key={index}
                            style={[
                                styles.recentCard,
                                {
                                    backgroundColor: colors.cardColor,
                                    borderColor: colors.borderColor,
                                },
                                index === 0 && styles.recentCardFirst,
                            ]}>
                            <View style={styles.recentLabelRow}>
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: recentLabelColor },
                                    ]}
                                />
                                <Text
                                    style={[styles.recentLabel, { color: recentLabelColor }]}>
                                    Recent
                                </Text>
                            </View>
                            <View style={styles.spacer6} />
                            <Text
                                style={[styles.recentDestination, { color: colors.textColor }]}
                                numberOfLines={1}>
                                {ride.dropoff ?? 'Unknown'}
                            </Text>
                            <Text
                                style={[styles.recentSource, { color: colors.subtextColor }]}
                                numberOfLines={1}>
                                From {ride.pickup ?? 'Unknown'}
                            </Text>
                            {isDriver && ride.seatsTotal !== undefined && (
                                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: colors.subtextColor, fontWeight: '500' }}>
                                        Available: {Math.max(0, ride.seatsTotal - (ride.seatsBooked || 0))}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: isDark ? '#FF4081' : '#D81B60', fontWeight: 'bold' }}>
                                        Taken: {ride.seatsBooked || 0}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.spacer28} />

            {/* Why Choose Raahi */}
            <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
                WHY CHOOSE RAAHI?
            </Text>
            <View style={styles.spacer14} />

            <View style={styles.whyRow}>
                <View
                    style={[
                        styles.whyCard,
                        {
                            backgroundColor: isDark ? colors.cardColor : '#F8F9FF',
                            borderColor: colors.borderColor,
                        },
                        styles.whyCardFirst,
                    ]}>
                    <Text style={[styles.whyIcon, { color: colors.accentColor }]}>
                        🛡️
                    </Text>
                    <View style={styles.spacer8} />
                    <Text style={[styles.whyTitle, { color: colors.textColor }]}>
                        Safe Travel
                    </Text>
                    <Text style={[styles.whyDesc, { color: colors.subtextColor }]}>
                        Verified experts.
                    </Text>
                </View>

                <View
                    style={[
                        styles.whyCard,
                        {
                            backgroundColor: isDark ? colors.cardColor : '#F8F9FF',
                            borderColor: colors.borderColor,
                        },
                    ]}>
                    <Text style={[styles.whyIcon, { color: colors.accentColor }]}>
                        👥
                    </Text>
                    <View style={styles.spacer8} />
                    <Text style={[styles.whyTitle, { color: colors.textColor }]}>
                        Share & Save
                    </Text>
                    <Text style={[styles.whyDesc, { color: colors.subtextColor }]}>
                        Split costs.
                    </Text>
                </View>
            </View>

            <View style={styles.spacer24} />

            {/* Post Ride Success Modal */}
            <Modal
                visible={showPostSuccess}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowPostSuccess(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.successIconContainer}>
                            <Text style={styles.successIcon}>✓</Text>
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>RIDE POSTED!</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subtextColor }]}>
                            Your ride is now live! Passengers can now see and book your cab.
                        </Text>

                        <TouchableOpacity
                            style={styles.returnHomeBtn}
                            onPress={() => setShowPostSuccess(false)}>
                            <Text style={styles.returnHomeBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    greeting: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    subGreeting: {
        fontSize: 16,
    },
    rideCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 18,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    rideTypeRow: {
        flexDirection: 'row',
    },
    rideTypeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    rideTypeText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    fieldLabel: {
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 1,
    },
    textInput: {
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 15,
    },
    findButton: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    findButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        letterSpacing: 1,
        fontSize: 14,
    },
    recentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    recentCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
    },
    recentCardFirst: {
        marginRight: 6,
    },
    recentLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 4,
    },
    recentLabel: {
        fontWeight: 'bold',
        fontSize: 13,
    },
    recentDestination: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    recentSource: {
        fontSize: 13,
    },
    whyRow: {
        flexDirection: 'row',
        gap: 12,
    },
    whyCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        padding: 18,
    },
    whyCardFirst: {
        marginRight: 6,
    },
    whyIcon: {
        fontSize: 24,
    },
    whyTitle: {
        fontWeight: 'bold',
        fontSize: 15,
    },
    whyDesc: {
        fontSize: 13,
    },
    errorText: {
        color: '#FF4444',
        fontSize: 14,
    },
    spacer6: { height: 6 },
    spacer8: { height: 8 },
    spacer14: { height: 14 },
    spacer18: { height: 18 },
    spacer24: { height: 24 },
    spacer28: { height: 28 },
    spacerH8: { width: 8 },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
    },
    successIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#004D40',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#00BFA5',
    },
    successIcon: {
        color: '#00BFA5',
        fontSize: 40,
        fontWeight: 'bold',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 1,
    },
    modalSubtitle: {
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 30,
    },
    returnHomeBtn: {
        backgroundColor: '#1FAF63',
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    returnHomeBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 1,
    },
});

export default HomeScreen;
