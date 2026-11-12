import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ScrollView,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../apiConfig';
import JeepLayout from '../components/JeepLayout';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';

interface BookRideScreenProps {
    ride: {
        id: string;
        vehicleModel: string;
        pricePerSeat: number;
        seatsTotal: number;
        seatingLayout?: string;
        seatsBooked?: number;
        takenSeats?: number[];
        date?: string;
        departureTime?: string;
        segmentPricePerSeat?: number;
        segmentDistanceKm?: number;
        matchedPickup?: string;
        matchedDropoff?: string;
        pickup?: string;
        dropoff?: string;
        matchType?: string;
        isPartialMatch?: boolean;
        route?: string[];
    };
    searchPickup?: string;
    searchDropoff?: string;
    onBack: () => void;
    onBookingComplete: () => void;
}

const BookRideScreen: React.FC<BookRideScreenProps> = ({ ride: initialRide, searchPickup, searchDropoff, onBack, onBookingComplete }) => {
    const { colors, isDark } = useTheme();
    const { token, logout } = useAuth();
    const { t } = useLanguage();
    const [ride, setRide] = useState(initialRide);
    const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
    const [roofCarrier, setRoofCarrier] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [bookingId, setBookingId] = useState('');

    const isPartialMatch = Boolean(ride.isPartialMatch ?? initialRide.isPartialMatch);
    const matchType = ride.matchType || initialRide.matchType;
    const effectivePickup =
        ride.matchedPickup ||
        initialRide.matchedPickup ||
        (isPartialMatch && matchType === 'common_dropoff'
            ? ride.pickup || initialRide.pickup || searchPickup || ''
            : searchPickup || ride.pickup || initialRide.pickup || '');
    const effectiveDropoff =
        ride.matchedDropoff ||
        initialRide.matchedDropoff ||
        (isPartialMatch && matchType === 'common_pickup'
            ? ride.dropoff || initialRide.dropoff || searchDropoff || ''
            : searchDropoff || ride.dropoff || initialRide.dropoff || '');
    const unitPrice =
        ride.segmentPricePerSeat && ride.segmentPricePerSeat > 0
            ? ride.segmentPricePerSeat
            : initialRide.segmentPricePerSeat && initialRide.segmentPricePerSeat > 0
                ? initialRide.segmentPricePerSeat
                : ride.pricePerSeat || initialRide.pricePerSeat || 0;
    const totalPrice = Math.round(unitPrice * selectedSeats.length);

    useEffect(() => {
        fetchRideDetails();
        const interval = setInterval(fetchRideDetails, 5000); // Poll every 5 seconds for real-time
        return () => clearInterval(interval);
    }, []);

    const fetchRideDetails = async () => {
        try {
            const rideId = initialRide.id || (initialRide as any)._id;
            let url = `/api/rides/${rideId}`;
            const queryParams = [];
            if (effectivePickup) queryParams.push(`pickup=${encodeURIComponent(effectivePickup)}`);
            if (effectiveDropoff) queryParams.push(`dropoff=${encodeURIComponent(effectiveDropoff)}`);
            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }

            const response = await apiRequest(url, {}, logout);
            if (response.ok) {
                const data = await response.json();
                setRide(prev => ({
                    ...prev,
                    ...data,
                    segmentPricePerSeat: data.segmentPricePerSeat ?? initialRide.segmentPricePerSeat,
                    segmentDistanceKm: data.segmentDistanceKm ?? initialRide.segmentDistanceKm,
                    matchedPickup: data.matchedPickup ?? initialRide.matchedPickup,
                    matchedDropoff: data.matchedDropoff ?? initialRide.matchedDropoff,
                    matchType: data.matchType ?? initialRide.matchType,
                    isPartialMatch: data.isPartialMatch ?? initialRide.isPartialMatch,
                }));
                if (Array.isArray(data.takenSeats)) {
                    setSelectedSeats(prev => prev.filter(s => !data.takenSeats.includes(s)));
                }
            }
        } catch (err) {
            console.error('Fetch ride details error:', err);
        }
    };

    const toggleSeat = (index: number) => {
        if (selectedSeats.includes(index)) {
            setSelectedSeats(selectedSeats.filter(s => s !== index));
        } else {
            // Check if there's a reason to limit, like max 6 per person or just based on available
            if (selectedSeats.length < ((ride.seatsTotal || 0) - (ride.takenSeats?.length || 0))) {
                setSelectedSeats([...selectedSeats, index]);
            }
        }
    };

    const handleBook = async () => {
        if (selectedSeats.length === 0) {
            Alert.alert(t('book.wait'), t('book.selectAtLeastOne'));
            return;
        }

        setLoading(true);
        try {
            const rideId = ride.id || (ride as any)._id || initialRide.id;
            const response = await apiRequest(`/api/rides/${rideId}/book`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'seat',
                    pickup: effectivePickup,
                    dropoff: effectiveDropoff,
                    seatsRequested: selectedSeats.length,
                    seatLayout: selectedSeats,
                    roofCarrier,
                }),
            }, logout);

            if (response.ok) {
                const randomId = Math.floor(1000 + Math.random() * 9000);
                setBookingId(`RA-${randomId}`);
                setShowSuccessModal(true);
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || t('book.failBook') || 'Failed to book ride';
                if (Platform.OS === 'web') {
                    window.alert(errorMsg);
                } else {
                    Alert.alert(t('common.error'), errorMsg);
                }
            }
        } catch (err) {
            console.error('Booking error:', err);
            const errStr = t('book.errorConnect') || 'Error connecting to server';
            if (Platform.OS === 'web') {
                window.alert(errStr);
            } else {
                Alert.alert(t('common.error'), errStr);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Text style={[styles.backText, { color: colors.textColor }]}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textColor }]}>{t('book.bookMySeat')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                {(effectivePickup || effectiveDropoff) ? (
                    <View
                        style={[
                            styles.headerInfoRow,
                            {
                                backgroundColor: colors.cardColor,
                                borderWidth: 1,
                                borderColor: colors.borderColor,
                                justifyContent: 'space-between',
                            },
                        ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={styles.headerIcon}>📍</Text>
                            <Text style={[styles.headerInfoText, { color: colors.textColor }]}>
                                {`${effectivePickup} → ${effectiveDropoff}`}
                            </Text>
                        </View>
                        <Text style={[styles.headerInfoText, { color: '#00C853', marginLeft: 8 }]}>
                            {`₹ ${Math.round(unitPrice)} / seat`}
                        </Text>
                    </View>
                ) : null}

                {isPartialMatch && (
                    <View
                        style={[
                            styles.partialSegmentNotice,
                            {
                                backgroundColor: isDark ? 'rgba(255, 179, 0, 0.12)' : 'rgba(255, 143, 0, 0.1)',
                                borderColor: '#FFB300',
                            },
                        ]}>
                        <Text style={[styles.partialSegmentTitle, { color: isDark ? '#FFD54F' : '#EF6C00' }]}>
                            COMMON-POINT SEGMENT BOOKING
                        </Text>
                        <Text style={[styles.partialSegmentText, { color: colors.textColor }]}>
                            {`Booking route segment: ${effectivePickup} → ${effectiveDropoff}`}
                        </Text>
                    </View>
                )}

                <JeepLayout
                    selectedSeats={selectedSeats}
                    takenSeats={ride.takenSeats}
                    onSeatPress={toggleSeat}
                    numSeatsRequested={selectedSeats.length}
                    totalSeats={ride.seatsTotal}
                    layoutType={ride.seatingLayout || 'suv'}
                    date={ride.date}
                    departureTime={ride.departureTime}
                />

                <View style={[styles.logisticsCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                    <Text style={[styles.logisticsTitle, { color: colors.subtextColor }]}>{t('book.hillLogistics')}</Text>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleIcon}>🧳</Text>
                        <Text style={[styles.toggleText, { color: colors.textColor }]}>{t('book.roofCarrierBaggage')}</Text>
                        <Switch
                            value={roofCarrier}
                            onValueChange={setRoofCarrier}
                            trackColor={{ false: '#222', true: colors.primary }}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: loading ? '#555' : colors.primary }]}
                    onPress={handleBook}
                    disabled={loading}>
                    <Text style={styles.bookBtnText}>
                        {loading ? t('book.processing') : `${t('book.confirmBooking')} (₹ ${totalPrice})`}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.successIconContainer}>
                            <Text style={styles.successIcon}>✓</Text>
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>{t('book.requestSent')}</Text>
                        {effectivePickup && effectiveDropoff ? (
                            <Text style={[styles.partialSegmentText, { color: colors.primary, marginBottom: 8, textAlign: 'center' }]}>
                                {`${effectivePickup} → ${effectiveDropoff}`}
                            </Text>
                        ) : null}
                        <Text style={[styles.modalSubtitle, { color: colors.subtextColor }]}>
                            {t('book.awaitingApproval')}
                        </Text>

                        <TouchableOpacity
                            style={styles.returnHomeBtn}
                            onPress={() => {
                                setShowSuccessModal(false);
                                onBookingComplete();
                            }}>
                            <Text style={styles.returnHomeBtnText}>{t('common.ok')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    backText: {
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.7,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    partialSegmentNotice: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    partialSegmentTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    partialSegmentText: {
        fontSize: 13,
        fontWeight: '600',
    },
    layoutCard: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 24,
        marginBottom: 20,
    },
    layoutHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    layoutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    layoutStatus: {
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: 'rgba(91, 79, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    layoutSubtitle: {
        fontSize: 10,
        marginBottom: 25,
    },
    seatContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    seatRow: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 15,
    },
    seatBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatPlaceholder: {
        width: 50,
    },
    seatIcon: {
        fontSize: 20,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    logisticsCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 25,
    },
    logisticsTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    toggleIcon: { fontSize: 20, marginRight: 15 },
    headerInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12,
        borderRadius: 12,
    },
    headerIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    headerInfoText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    toggleText: { flex: 1, fontSize: 13, fontWeight: 'bold' },
    bookBtn: {
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    bookBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
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
    bookingIdCard: {
        backgroundColor: '#111822',
        width: '100%',
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
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
        marginBottom: 15,
    },
    bookingIdFooter: {
        color: '#4B5C6B',
        fontSize: 9,
        fontWeight: 'bold',
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

export default BookRideScreen;
