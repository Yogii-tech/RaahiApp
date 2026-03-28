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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import JeepLayout from '../components/JeepLayout';

const API_BASE = 'http://localhost:8081';

interface BookRideScreenProps {
    ride: {
        id: string;
        vehicleModel: string;
        pricePerSeat: number;
        seatsTotal: number;
        takenSeats?: number[];
    };
    onBack: () => void;
    onBookingComplete: () => void;
}

const BookRideScreen: React.FC<BookRideScreenProps> = ({ ride: initialRide, onBack, onBookingComplete }) => {
    const { colors, isDark } = useTheme();
    const { token } = useAuth();
    const { t } = useLanguage();
    const [ride, setRide] = useState(initialRide);
    const [numSeats, setNumSeats] = useState(1);
    const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
    const [roofCarrier, setRoofCarrier] = useState(false);
    const [motionSickness, setMotionSickness] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [bookingId, setBookingId] = useState('');

    useEffect(() => {
        fetchRideDetails();
        const interval = setInterval(fetchRideDetails, 5000); // Poll every 5 seconds for real-time
        return () => clearInterval(interval);
    }, []);

    const fetchRideDetails = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/rides/${initialRide.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setRide(data);
            }
        } catch (err) {
            console.error('Fetch ride details error:', err);
        }
    };

    const toggleSeat = (index: number) => {
        if (selectedSeats.includes(index)) {
            setSelectedSeats(selectedSeats.filter(s => s !== index));
        } else {
            if (selectedSeats.length < numSeats) {
                setSelectedSeats([...selectedSeats, index]);
            } else {
                Alert.alert(t('book.limitReached'), t('book.selectedSeatsMsg').replace('{{num}}', numSeats.toString()));
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
            const response = await fetch(`${API_BASE}/api/rides/${ride.id}/book`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    seatsRequested: numSeats,
                    seatLayout: selectedSeats,
                    roofCarrier,
                    motionSickness,
                }),
            });

            if (response.ok) {
                const randomId = Math.floor(1000 + Math.random() * 9000);
                setBookingId(`RA-${randomId}`);
                setShowSuccessModal(true);
            } else {
                Alert.alert(t('common.error'), t('book.failBook'));
            }
        } catch (err) {
            console.error('Booking error:', err);
            Alert.alert(t('common.error'), t('book.errorConnect'));
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
                <Text style={[styles.sectionTitle, { color: colors.subtextColor }]}>{t('book.numSeats')}</Text>
                <View style={styles.numSeatsRow}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                        <TouchableOpacity
                            key={n}
                            style={[
                                styles.numSeatBtn,
                                {
                                    backgroundColor: numSeats === n ? colors.primary : colors.cardColor,
                                    borderColor: colors.borderColor,
                                },
                            ]}
                            onPress={() => {
                                setNumSeats(n);
                                if (selectedSeats.length > n) setSelectedSeats(selectedSeats.slice(0, n));
                            }}>
                            <Text style={[styles.numSeatText, { color: numSeats === n ? '#FFFFFF' : colors.textColor }]}>{n}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <JeepLayout
                    selectedSeats={selectedSeats}
                    takenSeats={ride.takenSeats}
                    onSeatPress={toggleSeat}
                    numSeatsRequested={numSeats}
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
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleIcon}>🚙</Text>
                        <Text style={[styles.toggleText, { color: colors.textColor }]}>{t('book.motionSickness')}</Text>
                        <Switch
                            value={motionSickness}
                            onValueChange={setMotionSickness}
                            trackColor={{ false: '#222', true: colors.primary }}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: loading ? '#555' : colors.primary }]}
                    onPress={handleBook}
                    disabled={loading}>
                    <Text style={styles.bookBtnText}>
                        {loading ? t('book.processing') : `${t('book.confirmBooking')} (₹ ${ride.pricePerSeat * numSeats})`}
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
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    numSeatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    numSeatBtn: {
        width: 45,
        height: 45,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    numSeatText: {
        fontSize: 16,
        fontWeight: 'bold',
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
