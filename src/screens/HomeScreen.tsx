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
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';
import Icon from 'react-native-vector-icons/Ionicons';

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

import { API_BASE } from '../apiConfig';

const HomeScreen: React.FC<HomeScreenProps> = ({ onSosPressed }) => {
    const { isDark, colors } = useTheme();
    const { token, user, logout } = useAuth();
    const { t } = useLanguage();
    const [view, setView] = useState<string>('home');
    const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
    const [rideType, setRideType] = useState<0 | 1>(0);
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [date, setDate] = useState(() => {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    });
    const [departureTime, setDepartureTime] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
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
            const response = await apiRequest('/api/rides/recent', {}, logout);
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
            await apiRequest('/api/rides/recent', {
                method: 'POST',
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
            const response = await apiRequest('/api/rides/create', {
                method: 'POST',
                body: JSON.stringify({
                    pickup: pickup.trim(),
                    dropoff: dropoff.trim(),
                    date: date.trim(),
                    departureTime: departureTime.trim(),
                    vehicleModel: user?.vehicle?.vehicle_name || "Mountain SUV",
                    vehicleNumber: user?.vehicle?.vehicle_number || "UK07-AX-4421",
                    seatsTotal: user?.vehicle?.seats || 5,
                    seatingLayout: user?.vehicle?.seating_layout || "suv",
                    pricePerSeat: 350,
                }),
            });

            if (response.ok) {
                setPickup('');
                setDropoff('');
                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yyyy = today.getFullYear();
                setDate(`${dd}/${mm}/${yyyy}`);
                setDepartureTime('');
                setShowPostSuccess(true);
                fetchRecentRides(); // Refresh recent list
            } else {
                const data = await response.json();
                Alert.alert(t('common.error'), data.error || 'Failed to post ride');
            }
        } catch (err) {
            console.error('Post ride error:', err);
            Alert.alert(t('common.error'), t('login.connectionError'));
        }
    };

    const isDriver = user?.role === 'driver';

    if (view === 'available') {
        return (
            <AvailableRidesScreen
                searchPickup={pickup.trim()}
                searchDropoff={dropoff.trim()}
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
                {isDriver ? t('home.greetingDriver') : t('home.greetingPassenger')}
            </Text>
            <View style={styles.spacer6} />
            <Text style={[styles.subGreeting, { color: colors.subtextColor }]}>
                {isDriver ? t('home.subGreetingDriver') : t('home.subGreetingPassenger')}
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
                    {t('home.pickupLabel')}
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
                    {t('home.dropoffLabel')}
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

                {isDriver && (
                    <>
                        <View style={styles.spacer14} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                                    {t('home.rideDate').toUpperCase()}
                                </Text>
                                <View style={styles.spacer6} />
                                <TouchableOpacity
                                    onPress={() => setShowCalendar(true)}
                                    activeOpacity={0.8}
                                    style={[styles.textInput, styles.datePickerButton, { backgroundColor: colors.inputFillColor, borderColor: date ? colors.primary : colors.inputBorderColor }]}>
                                    <Text style={[styles.datePickerText, { color: date ? colors.textColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(34,34,96,0.35)') }]}>
                                        {date || t('home.datePlaceholder')}
                                    </Text>
                                    <Icon name="calendar-outline" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ width: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                                    {t('home.departureTime').toUpperCase()}
                                </Text>
                                <View style={styles.spacer6} />
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: colors.inputFillColor, color: colors.textColor, borderColor: colors.inputBorderColor }]}
                                    placeholder={t('home.departureTimePlaceholder')}
                                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(34,34,96,0.3)'}
                                    value={departureTime}
                                    onChangeText={setDepartureTime}
                                />
                            </View>
                        </View>
                    </>
                )}

                <View style={styles.spacer18} />

                <TouchableOpacity
                    style={[styles.findButton, { backgroundColor: colors.primary }]}
                    onPress={isDriver ? handlePostRide : handleFindRides}
                    activeOpacity={0.85}>
                    <Text style={styles.findButtonText}>
                        {isDriver ? t('home.postRide') : t('home.findRides')}
                    </Text>
                </TouchableOpacity>

            </View>

            <View style={styles.spacer28} />

            {/* Recent Routes */}
            <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
                {t('home.recentRoutes')}
            </Text>
            <View style={styles.spacer14} />

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" />
            ) : error ? (
                <Text style={styles.errorText}>{t('home.errorRecent')}</Text>
            ) : (recentRides || []).length === 0 ? (
                <Text style={{ color: colors.textColor }}>{t('home.noRecentRides')}</Text>
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
                                    {t('home.recent')}
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
                                {t('home.from')} {ride.pickup ?? 'Unknown'}
                            </Text>
                            <View style={styles.detailRow}>
                                <Icon name="calendar-outline" size={14} color={colors.subtextColor} style={styles.detailIcon} />
                                <Text style={[styles.detailText, { color: colors.subtextColor }]}>{ride.date || '—'}</Text>
                                <View style={{ width: 12 }} />
                                <Icon name="time-outline" size={14} color={colors.subtextColor} style={styles.detailIcon} />
                                <Text style={[styles.detailText, { color: colors.subtextColor }]}>{ride.departureTime || '—'}</Text>
                            </View>
                            {isDriver && ride.seatsTotal !== undefined && (
                                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: colors.subtextColor, fontWeight: '500' }}>
                                        {t('home.availableSeats')}: {Math.max(0, ride.seatsTotal - (ride.seatsBooked || 0))}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: isDark ? '#FF4081' : '#D81B60', fontWeight: 'bold' }}>
                                        {t('home.takenSeats')}: {ride.seatsBooked || 0}
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
                {t('home.whyChoose')}
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
                    <Icon name="shield-checkmark-outline" size={28} color={colors.accentColor} />
                    <View style={styles.spacer8} />
                    <Text style={[styles.whyTitle, { color: colors.textColor }]}>
                        {t('home.safeTravel')}
                    </Text>
                    <Text style={[styles.whyDesc, { color: colors.subtextColor }]}>
                        {t('home.verifiedExperts')}
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
                    <Icon name="people-outline" size={28} color={colors.accentColor} />
                    <View style={styles.spacer8} />
                    <Text style={[styles.whyTitle, { color: colors.textColor }]}>
                        {t('home.shareSave')}
                    </Text>
                    <Text style={[styles.whyDesc, { color: colors.subtextColor }]}>
                        {t('home.splitCosts')}
                    </Text>
                </View>
            </View>

            <View style={styles.spacer24} />

            {/* Calendar Modal */}
            <Modal
                visible={showCalendar}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCalendar(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.calendarContent, { backgroundColor: colors.background, borderColor: colors.borderColor }]}>
                        {/* Calendar Header */}
                        <View style={styles.calendarHeader}>
                            <TouchableOpacity onPress={() => {
                                if (calendarMonth === 0) {
                                    setCalendarMonth(11);
                                    setCalendarYear(calendarYear - 1);
                                } else {
                                    setCalendarMonth(calendarMonth - 1);
                                }
                            }}>
                                <Text style={[styles.calendarNav, { color: colors.primary }]}>‹</Text>
                            </TouchableOpacity>
                            <Text style={[styles.calendarTitle, { color: colors.textColor }]}>
                                {t(`calendar.${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][calendarMonth]}`)} {calendarYear}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                if (calendarMonth === 11) {
                                    setCalendarMonth(0);
                                    setCalendarYear(calendarYear + 1);
                                } else {
                                    setCalendarMonth(calendarMonth + 1);
                                }
                            }}>
                                <Text style={[styles.calendarNav, { color: colors.primary }]}>›</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Days Header */}
                        <View style={styles.daysHeader}>
                            {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => (
                                <Text key={d} style={[styles.dayLabel, { color: colors.subtextColor }]}>{t(`calendar.${d}`).charAt(0)}</Text>
                            ))}
                        </View>

                        {/* Calendar Grid */}
                        <View style={styles.calendarGrid}>
                            {Array.from({ length: new Date(calendarYear, calendarMonth, 1).getDay() }).map((_, i) => (
                                <View key={`empty-${i}`} style={styles.calendarDay} />
                            ))}
                            {Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }).map((_, i) => {
                                const day = i + 1;
                                const isToday = day === new Date().getDate() && calendarMonth === new Date().getMonth() && calendarYear === new Date().getFullYear();
                                const isSelected = date === `${day < 10 ? '0' : ''}${day}/${calendarMonth + 1 < 10 ? '0' : ''}${calendarMonth + 1}/${calendarYear}`;

                                return (
                                    <TouchableOpacity
                                        key={`day-${day}`}
                                        style={[
                                            styles.calendarDay,
                                            isToday && { backgroundColor: 'rgba(31, 175, 99, 0.15)' },
                                            isSelected && { backgroundColor: colors.primary, borderRadius: 8 }
                                        ]}
                                        onPress={() => {
                                            const formattedDate = `${day < 10 ? '0' : ''}${day}/${calendarMonth + 1 < 10 ? '0' : ''}${calendarMonth + 1}/${calendarYear}`;
                                            setDate(formattedDate);
                                            setShowCalendar(false);
                                        }}>
                                        <Text style={[
                                            styles.dayText,
                                            { color: isSelected ? '#FFFFFF' : colors.textColor },
                                            isToday && !isSelected && { color: '#1FAF63', fontWeight: 'bold' }
                                        ]}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={{ marginTop: 20, padding: 10 }}
                            onPress={() => setShowCalendar(false)}>
                            <Text style={{ color: colors.subtextColor, fontWeight: 'bold' }}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>{t('home.ridePostedTitle')}</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subtextColor }]}>
                            {t('home.ridePostedSub')}
                        </Text>

                        <TouchableOpacity
                            style={styles.returnHomeBtn}
                            onPress={() => setShowPostSuccess(false)}>
                            <Text style={styles.returnHomeBtnText}>{t('common.ok')}</Text>
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
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    detailIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    detailText: {
        fontSize: 14,
        fontWeight: '500',
    },
    row: {
        flexDirection: 'row',
    },
    datePickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
    },
    datePickerText: {
        fontSize: 15,
        flex: 1,
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
    calendarContent: {
        width: '90%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    calendarHeader: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    calendarNav: {
        fontSize: 32,
        paddingHorizontal: 10,
    },
    calendarTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    daysHeader: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 10,
    },
    dayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 'bold',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
    },
    calendarDay: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 15,
        fontWeight: '500',
    },
});

export default HomeScreen;
