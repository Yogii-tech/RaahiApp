import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
<<<<<<< HEAD
import { API_BASE } from '../config/api';
=======
import { useLanguage } from '../context/LanguageContext';
>>>>>>> 7c6b6ca6d8b0613d82ece15b6e9e2244096d7291
import JeepLayout from '../components/JeepLayout';
import SlideToComplete from '../components/SlideToComplete';

<<<<<<< HEAD

=======
import { API_BASE } from '../apiConfig';
import { apiRequest } from '../utils/api';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPackageView from '../components/TrackPackageView';
import { startDriverTracking } from '../modern_map/services/socket';
>>>>>>> 7c6b6ca6d8b0613d82ece15b6e9e2244096d7291

interface Booking {
    id: string;
    rideId: string;
    passengerId: string;
    seatsRequested: number;
    status: string;
    createdAt: string;
    roofCarrier: boolean;
    date?: string;
    departureTime?: string;
}

const DistanceDisplay = ({ pickup, dropoff, color }: { pickup?: string, dropoff?: string, color: string }) => {
    const [distance, setDistance] = useState<string>('...');
    useEffect(() => {
        if (!pickup || !dropoff) return;
        let mounted = true;
        const fetchDist = async () => {
            try {
                const pRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(pickup)}&format=json&limit=1`);
                const pData = await pRes.json();
                if (!pData || pData.length === 0) return;

                const dRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dropoff)}&format=json&limit=1`);
                const dData = await dRes.json();
                if (!dData || dData.length === 0) return;

                const url = `https://router.project-osrm.org/route/v1/driving/${pData[0].lon},${pData[0].lat};${dData[0].lon},${dData[0].lat}?overview=false`;
                const rRes = await fetch(url);
                const rData = await rRes.json();

                if (rData.routes && rData.routes.length > 0 && mounted) {
                    setDistance(`~ ${Math.round(rData.routes[0].distance / 1000)} km`);
                }
            } catch (e) {
                console.log(e);
            }
        };
        fetchDist();
        return () => { mounted = false; };
    }, [pickup, dropoff]);

    return <Text style={{ fontSize: 8, color: color, marginBottom: 2 }}>{distance}</Text>;
};

interface TripsScreenProps {
    isParcelMode?: boolean;
}

const TripsScreen: React.FC<TripsScreenProps> = ({ isParcelMode }) => {
    const { colors, isDark } = useTheme();
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

    const isDriver = user?.role === 'driver';

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Polling for real-time updates
        return () => clearInterval(interval);
    }, [isDriver]);

    // Start GPS tracking for driver
    useEffect(() => {
        if (isDriver && user?.id && bookings.length > 0) {
            // Find the most relevant active ride (available and has bookings)
            const activeRide = bookings.find(b => b.status === 'available');
            if (activeRide) {
                const stopTracking = startDriverTracking(activeRide.id, user.id);
                return () => stopTracking();
            }
        }
    }, [isDriver, bookings, user?.id]);

    const fetchData = async () => {
        try {
            const endpoint = isDriver ? '/api/rides/recent' : '/api/rides/bookings';
            const response = await apiRequest(endpoint, {}, logout);
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
    const handleCompleteTrip = async (rideId: string) => {
        try {
            const response = await apiRequest(`/api/rides/${rideId}/complete`, {
                method: 'PUT',
            }, logout);
            if (response.ok) {
                Alert.alert(t('common.success') || 'Success', t('trips.tripCompleted') || 'Trip marked successfully');
                fetchData();
            } else {
                const data = await response.json();
                Alert.alert(t('common.error') || 'Error', data.error || 'Failed to complete trip');
            }
        } catch (err) {
            console.error('Error completing trip:', err);
        }
    };

    const handleCompleteBooking = async (bookingId: string) => {
        try {
            const response = await apiRequest(`/api/rides/bookings/${bookingId}/complete`, {
                method: 'PUT',
            }, logout);
            if (response.ok) {
                Alert.alert(t('common.success') || 'Success', 'Booking marked as completed');
                fetchData();
            } else {
                const data = await response.json();
                Alert.alert(t('common.error') || 'Error', data.error || 'Failed to complete booking');
            }
        } catch (err) {
            console.error('Error completing booking:', err);
        }
    };

    const renderRequestItem = ({ item }: { item: any }) => {
        const isExpanded = expandedRideId === item.id;
        const isCompleted = isDriver && item.status === 'completed';
        const cardBgColor = isCompleted ? (isDark ? '#1C2939' : '#F5F5F5') : colors.cardColor;
        const cardOpacity = isCompleted ? 0.7 : 1;

        return (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: colors.borderColor, opacity: cardOpacity }]}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.requestTitle, { color: colors.textColor }]}>
                        {isDriver ? `${t('trips.rideTo')} ${item.dropoff}` : `${t('trips.bookingFor')} ${item.ride?.vehicleModel || 'SUV'}`}
                    </Text>
                    <Text style={[styles.statusTag, { color: isCompleted ? '#4CAF50' : colors.primary, backgroundColor: isCompleted ? 'rgba(76, 175, 80, 0.1)' : 'rgba(91, 79, 255, 0.1)' }]}>
                        {isCompleted ? 'COMPLETED' : t(`requests.${item.status || 'pending'}`).toUpperCase()}
                    </Text>
                </View>

                <View style={styles.details}>
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {isDriver ? `${t('book.pickup')}: ${item.pickup}` : `${t('book.pickup')}: ${item.ride?.pickup} ${t('home.from').toLowerCase()} ${item.ride?.dropoff}`}
                    </Text>
                    <View style={styles.dateTimeRow}>
                        <Icon name="calendar-outline" size={14} color={colors.textColor} style={styles.dateTimeIcon} />
                        <Text style={[styles.dateTimeText, { color: colors.textColor }]}>
                            {isDriver ? item.date : item.ride?.date}
                        </Text>
                        <View style={{ width: 12 }} />
                        <Icon name="time-outline" size={14} color={colors.textColor} style={styles.dateTimeIcon} />
                        <Text style={[styles.dateTimeText, { color: colors.textColor }]}>
                            {isDriver ? item.departureTime : item.ride?.departureTime}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.subtextColor, marginTop: 4, fontStyle: 'italic' }}>
                        {isDriver ? t('trips.postedOn') : t('trips.bookedOn')}
                        {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={{ height: 8 }} />
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {isDriver ? `${t('trips.seatsBooked')}: ${item.seatsBooked || 0} / ${item.seatsTotal}` : `${t('trips.seatsRequested')}: ${item.seatsRequested}`}
                    </Text>
                    {item.roofCarrier && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• {t('trips.needsRoofCarrier')}</Text>}
                </View>

                {isDriver && (
                    <TouchableOpacity
                        style={[styles.viewLayoutBtn, { borderColor: colors.primary }]}
                        onPress={() => setExpandedRideId(isExpanded ? null : item.id)}>
                        <Text style={[styles.viewLayoutText, { color: colors.primary }]}>
                            {isExpanded ? t('trips.hideSeating') : t('trips.viewSeating')}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* For Passengers - Always show or add a button */}
                {!isDriver && (
                    <View style={{ marginTop: 10 }}>
                        <JeepLayout
                            interactive={false}
                            selectedSeats={item.seatLayout || []}
                            takenSeats={(item.ride?.takenSeats || []).filter((s: number) => !(item.seatLayout || []).includes(s) && !(item.completedSeats || []).includes(s))}
                            completedSeats={item.completedSeats || []}
                            totalSeats={item.ride?.seatsTotal}
                            layoutType={item.ride?.seatingLayout || 'suv'}
                        />

                        {/* Ticket Layout or Completion Receipt */}
                        {item.status === 'completed' ? (
                            <View style={[styles.bookingIdCard, { marginTop: 20, backgroundColor: isDark ? '#1C2939' : '#F0F4F8', borderWidth: 1, borderColor: '#4CAF50' }]}>
                                <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(76, 175, 80, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                                        <Icon name="checkmark-circle" size={32} color="#4CAF50" />
                                    </View>
                                    <Text style={{ color: colors.textColor, fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>TRIP FINISHED</Text>
                                    <Text style={{ color: colors.subtextColor, fontSize: 13, textAlign: 'center' }}>
                                        You reached {item.ride?.dropoff || 'destination'} safely.
                                    </Text>

                                    <View style={{ width: '100%', height: 1, backgroundColor: colors.borderColor, marginVertical: 15 }} />

                                    <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <View>
                                            <Text style={{ color: colors.subtextColor, fontSize: 10, fontWeight: 'bold' }}>FINISHED ON</Text>
                                            <Text style={{ color: colors.textColor, fontSize: 12, marginTop: 2 }}>
                                                {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: colors.subtextColor, fontSize: 10, fontWeight: 'bold' }}>TIME</Text>
                                            <Text style={{ color: colors.textColor, fontSize: 12, marginTop: 2 }}>
                                                {item.completedAt ? new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ) : item.status === 'accepted' && (() => {
                            const ticketBg = isDark ? '#111822' : '#EEF2FF';
                            const ticketLabel = isDark ? '#607D8B' : '#7986A3';
                            const ticketText = isDark ? '#FFFFFF' : '#222260';
                            const ticketDash = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(34,34,96,0.15)';
                            const ticketFooter = isDark ? '#4B5C6B' : '#8A96BB';
                            return (
                                <View style={[styles.bookingIdCard, { marginTop: 20, backgroundColor: ticketBg }]}>
                                    {/* Ticket Layout Redesign - Row Based */}
                                    <View style={{ flexDirection: 'column', width: '100%' }}>

                                        {/* Row 1: Header / Vehicle / Verification */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1.2 }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>CONFIRMED E-TICKET</Text>
                                            </View>
                                            <View style={{ flex: 0.8, alignItems: 'center' }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>VEHICLE NO.</Text>
                                                <Text style={{ color: ticketText, fontSize: 12, marginTop: 2, textAlign: 'center', fontWeight: '600' }}>{item.ride?.vehicleNumber || '—'}</Text>
                                            </View>
                                            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                                <View style={[styles.verifiedTag, { margin: 0 }]}>
                                                    <Text style={styles.verifiedTagText}>{t('trips.verifiedDriver')}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Dashed Line Center */}
                                        <View style={{ flexDirection: 'row' }}>
                                            <View style={{ flex: 1 }} />
                                            <View style={{ flex: 1.5 }}>
                                                <View style={{ width: '100%', height: 1, borderStyle: 'dashed', borderColor: ticketDash, borderWidth: 1, marginVertical: 15 }} />
                                            </View>
                                            <View style={{ flex: 1 }} />
                                        </View>

                                        {/* Row 2: Booking Details */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1.2 }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>BOOKED ON</Text>
                                                <Text style={{ color: ticketText, fontSize: 11, marginTop: 2 }}>{new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                            <View style={{ flex: 0.8, alignItems: 'center' }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>REF CODE</Text>
                                                <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 2, fontWeight: 'bold', letterSpacing: 0.5 }}>RA-{item.id.slice(-4).toUpperCase()}</Text>
                                            </View>
                                            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold', textAlign: 'right' }}>JOURNEY INFO</Text>
                                                <Text style={{ color: ticketText, fontSize: 11, marginTop: 2, textAlign: 'right' }}>{item.ride?.date} at {item.ride?.departureTime}</Text>
                                            </View>
                                        </View>

                                        {/* Row 3: Places and Arrow */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 18 }}>
                                            <View style={{ flex: 1.2 }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>FROM</Text>
                                                <Text style={{ color: ticketText, fontSize: 13, marginTop: 2, fontWeight: '500' }} numberOfLines={1}>{item.ride?.pickup}</Text>
                                            </View>
                                            <View style={{ flex: 0.8, alignItems: 'center', justifyContent: 'center' }}>
                                                <DistanceDisplay pickup={item.ride?.pickup} dropoff={item.ride?.dropoff} color={ticketLabel} />
                                                <Text style={{ color: '#4CAF50', fontSize: 14 }}>➔</Text>
                                            </View>
                                            <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>TO</Text>
                                                <Text style={{ color: ticketText, fontSize: 13, marginTop: 2, textAlign: 'right', fontWeight: '500' }} numberOfLines={1}>{item.ride?.dropoff}</Text>
                                            </View>
                                        </View>

                                        {/* Row 4: Seat No */}
                                        <View style={{ flexDirection: 'row', marginTop: 18 }}>
                                            <View style={{ flex: 1.2 }} />
                                            <View style={{ flex: 0.8, alignItems: 'center' }}>
                                                <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>SEAT NO(S)</Text>
                                                <Text style={{ color: ticketText, fontSize: 14, marginTop: 2, fontWeight: 'bold' }}>
                                                    {item.seatLayout && item.seatLayout.length > 0 ? item.seatLayout.join(', ') : item.seatsRequested}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1.2 }} />
                                        </View>

                                        {/* Footer Dashed Line & Text Row */}
                                        <View style={{ flexDirection: 'row', marginTop: 18 }}>
                                            <View style={{ flex: 0.5 }} />
                                            <View style={{ flex: 2.2, alignItems: 'center' }}>
                                                <View style={{ width: '100%', height: 1, borderStyle: 'dashed', borderColor: ticketDash, borderWidth: 1, marginBottom: 12 }} />
                                                <Text style={{ color: ticketFooter, fontSize: 8.5, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.8 }}>
                                                    SHOW THIS E-TICKET TO YOUR DRIVER
                                                </Text>
                                            </View>
                                            <View style={{ flex: 0.5 }} />
                                        </View>

                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                )}

                {isExpanded && isDriver && (
                    <View style={{ marginTop: 20 }}>
                        <JeepLayout
                            interactive={false}
                            takenSeats={item.acceptedSeats?.filter((s: number) => !item.completedSeats?.includes(s)) || []}
                            completedSeats={item.completedSeats || []}
                            pendingSeats={item.pendingSeats || []}
                            totalSeats={item.seatsTotal}
                            layoutType={item.seatingLayout || 'suv'}
                            isCompleted={isCompleted}
                            dropoff={item.dropoff}
                            completedAt={item.completedAt}
                            date={item.date}
                        />

                        {/* List of active bookings for completion */}
                        {!isCompleted && item.bookings && item.bookings.length > 0 && (
                            <View style={{ marginTop: 20 }}>
                                {(() => {
                                    const hasParcels = item.bookings.some((b: any) => b.type === 'parcel');
                                    const hasPassengers = item.bookings.some((b: any) => b.type === 'passenger' || !b.type);
                                    const heading = hasParcels && !hasPassengers ? 'MANAGE PARCELS' : (hasPassengers && !hasParcels ? 'MANAGE PASSENGERS' : 'MANAGE PASSENGERS & PARCELS');
                                    return <Text style={{ color: colors.textColor, fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>{heading}</Text>;
                                })()}
                                {item.bookings.map((booking: any) => {
                                    const isParcel = booking.type === 'parcel';
                                    return (
                                        <View key={booking.id} style={{
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                            borderRadius: 12,
                                            padding: 12,
                                            marginBottom: 10,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: booking.status === 'completed' ? '#4CAF50' : colors.borderColor
                                        }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.textColor, fontWeight: 'bold', fontSize: 13 }}>
                                                    {isParcel ? 'Parcel' : 'Pass.'} RA-{booking.id.slice(-4).toUpperCase()}
                                                </Text>
                                                <Text style={{ color: colors.subtextColor, fontSize: 11 }}>
                                                    {isParcel ? `Size: ${booking.parcelSize || 'Standard'}` : `Seats: ${booking.seatLayout?.join(', ') || booking.seatsRequested || 0}`}
                                                </Text>
                                            </View>
                                            {booking.status === 'accepted' ? (
                                                <TouchableOpacity
                                                    onPress={() => handleCompleteBooking(booking.id)}
                                                    style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                                                >
                                                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>MARK COMPLETED</Text>
                                                </TouchableOpacity>
                                            ) : booking.status === 'completed' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                                                    <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>FINISHED</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {!isCompleted && (
                            <View style={{ marginTop: 20 }}>
                                <SlideToComplete
                                    title="Finish the ride"
                                    onComplete={() => handleCompleteTrip(item.id)}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    if (isParcelMode) {
        return <TrackPackageView />;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.textColor }]}>
                {isDriver ? t('trips.myRides') : t('trips.myBookings')}
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
                            {isDriver ? t('trips.noPublished') : t('trips.noTrips')}
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
        marginBottom: 2,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 4,
    },
    dateTimeIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    dateTimeText: {
        fontSize: 14,
        fontWeight: 'bold',
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
