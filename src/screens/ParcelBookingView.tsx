import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Alert,
    Platform,
    Image,
    ActivityIndicator,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../apiConfig';
import LocationInput from '../components/LocationInput';
import { apiRequest } from '../utils/api';
const { width } = Dimensions.get('window');


interface ParcelBookingViewProps {
    onBack?: () => void;
}

const ParcelBookingView: React.FC<ParcelBookingViewProps> = ({ onBack }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { token } = useAuth();
    const { width } = useWindowDimensions();

    // Step state
    const [step, setStep] = useState<'search' | 'rides' | 'details' | 'calculator'>('search');
    const [loading, setLoading] = useState(false);
    const [availableRides, setAvailableRides] = useState<any[]>([]);
    const [selectedRide, setSelectedRide] = useState<any | null>(null);

    // Form state - Step 1
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
    const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
    const [roadDistance, setRoadDistance] = useState<number | null>(null);
    const [roadDuration, setRoadDuration] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    });
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');

    // Form state - Step 2 (Recipient Details)
    const [recipientName, setRecipientName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [dropLocation, setDropLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [parcelPhoto, setParcelPhoto] = useState<string | null>(null);

    const sizes = [
        { id: 'small', label: 'parcel.sizeSmall', desc: 'parcel.sizeSmallDesc', icon: 'mail-open-outline' }, // Mailbox-like
        { id: 'medium', label: 'parcel.sizeMedium', desc: 'parcel.sizeMediumDesc', icon: 'cube-outline' }, // Box
        { id: 'large', label: 'parcel.sizeLarge', desc: 'parcel.sizeLargeDesc', icon: 'archive-outline' }, // Cabinet/Archive
    ];

    const popularRoutes = [
        { from: 'Rishikesh', to: 'Tehri', price: '320' },
        { from: 'Dehradun', to: 'Mussoorie', price: '180' },
        { from: 'Bageshwar', to: 'Haldwani', price: '450' },
    ];

    const pickupLabelColor = isDark ? '#00FFFF' : '#5B4FFF';
    const dropoffLabelColor = isDark ? '#FF4081' : '#5B4FFF';

    const fetchRoadMetrics = async (from: [number, number], to: [number, number]) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                setRoadDistance(Math.round(route.distance / 1000)); // KM
                setRoadDuration(Math.round(route.duration / 3600) || 1); // Hours (min 1)
            }
        } catch (e) {
            console.error("Failed to fetch road metrics", e);
        }
    };

    const getTravelStats = (p: string, d: string, depTime: string) => {
        // Use real road distance if fetched, otherwise fallback to estimates
        const distance = roadDistance !== null ? roadDistance : 35;
        const durationHours = roadDuration !== null ? roadDuration : Math.ceil(distance / 30) + 1;

        // Calculate Arrival Time
        let arrivalTime = '—';
        if (depTime) {
            try {
                // Parse "06:00 AM"
                const [time, period] = depTime.split(' ');
                let [hours, minutes] = time.split(':').map(Number);
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                const depDate = new Date();
                depDate.setHours(hours, minutes, 0, 0);
                const arrDate = new Date(depDate.getTime() + durationHours * 60 * 60 * 1000);

                let arrHours = arrDate.getHours();
                const arrMinutes = String(arrDate.getMinutes()).padStart(2, '0');
                const arrPeriod = arrHours >= 12 ? 'PM' : 'AM';
                arrHours = arrHours % 12 || 12;
                arrivalTime = `${String(arrHours).padStart(2, '0')}:${arrMinutes} ${arrPeriod}`;
            } catch (e) {
                arrivalTime = '—';
            }
        }

        return {
            distance: `${distance} KM`,
            duration: `${durationHours}h`,
            arrival: arrivalTime
        };
    };

    const fetchAvailableRides = async () => {
        if (!pickup.trim() || !dropoff.trim()) {
            Alert.alert(t('common.error'), 'Please enter pickup and dropoff locations.');
            return;
        }

        setLoading(true);
        try {
            const url = `${API_BASE}/api/rides/available?pickup=${encodeURIComponent(pickup)}&dropoff=${encodeURIComponent(dropoff)}&date=${encodeURIComponent(selectedDate)}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setAvailableRides(data);
                setStep('rides');
            } else {
                Alert.alert(t('common.error'), data.error || 'Failed to fetch vehicles');
            }
        } catch (err) {
            Alert.alert(t('common.error'), 'Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = () => {
        if (Platform.OS === 'web') {
            // @ts-ignore
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (file) {
                    setLoading(true);
                    try {
                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(`${API_BASE}/api/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });

                        const data = await response.json();
                        if (response.ok) {
                            setParcelPhoto(data.url);
                        } else {
                            Alert.alert(t('common.error'), data.error || 'Upload failed');
                        }
                    } catch (err) {
                        Alert.alert(t('common.error'), 'Upload failed');
                    } finally {
                        setLoading(false);
                    }
                }
            };
            input.click();
        } else {
            Alert.alert('Mobile Upload', 'Image picker would be triggered here.');
        }
    };

    const handleConfirmDetails = async () => {
        if (!recipientName.trim() || !contactNumber.trim() || !dropLocation.trim()) {
            Alert.alert(t('common.error'), 'Please fill in all required recipient details.');
            return;
        }

        // After filling details, we now search for vehicles
        await fetchAvailableRides();
    };

    const handleFinalBooking = (ride: any) => {
        setSelectedRide(ride);
        setStep('calculator');
    };

    const confirmBooking = async () => {
        if (!selectedRide) {
            console.error("No ride selected for booking");
            return;
        }

        const stats = getTravelStats(pickup, dropoff, selectedRide.departureTime);
        const distNum = parseInt(stats.distance) || 0;
        const rate = selectedSize === 'small' ? 2 : selectedSize === 'medium' ? 2.5 : 3;
        const price = Math.ceil(distNum * rate);



        setLoading(true);
        try {
            const rideId = selectedRide.id || selectedRide._id;
            const fullUrl = `${API_BASE}/api/rides/${rideId}/book`;
            const stats = getTravelStats(pickup, dropoff, selectedRide.departureTime);
            const distNum = parseInt(stats.distance) || 0;
            const rate = selectedSize === 'small' ? 2 : selectedSize === 'medium' ? 2.5 : 3;
            const calculatedPrice = Math.ceil(distNum * rate);

            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: 'parcel',
                    pickup,
                    dropoff,
                    parcelSize: selectedSize,
                    recipientName,
                    contactNumber,
                    dropLocation,
                    notes,
                    date: selectedDate,
                    photoUrl: parcelPhoto,
                    price: calculatedPrice.toString()
                })
            });

            if (response.ok) {
                const data = await response.json();
                const displayId = data.bookingId ? `RA-P-${data.bookingId.slice(-4).toUpperCase()}` : 'Booked';

                Alert.alert(
                    t('common.success'),
                    `Your parcel was successfully scheduled!\n\nBooking ID: ${displayId}\n\nYou can track this in your notifications.`,
                    [{ text: 'OK', onPress: () => onBack && onBack() }]
                );
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("Booking failed:", errorData);
                Alert.alert(t('common.error'), errorData.error || 'Failed to schedule pickup. Please try again.');
            }
        } catch (err) {
            console.error("Booking catch error:", err);
            Alert.alert(t('common.error'), t('login.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const renderPriceCalculator = () => {
        if (!selectedRide) return null;
        const stats = getTravelStats(pickup, dropoff, selectedRide.departureTime);
        const distNum = parseInt(stats.distance);
        const rate = selectedSize === 'small' ? 2 : selectedSize === 'medium' ? 2.5 : 3;
        const baseCharge = distNum * 2;
        const weightPremium = selectedSize === 'small' ? 0 : selectedSize === 'medium' ? distNum * 0.5 : distNum * 1;
        const totalPrice = Math.ceil(distNum * rate);

        return (
            <View style={styles.content}>
                <TouchableOpacity onPress={() => setStep('rides')} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.primary }]}>← {t('common.back')}</Text>
                </TouchableOpacity>

                <Text style={[styles.title, { color: colors.textColor }]}>Price Calculator</Text>
                <Text style={[styles.routeSummary, { color: colors.subtextColor }]}>
                    Freight calculation for your shipment
                </Text>

                <View style={styles.spacer32} />

                {/* Calculation Card */}
                <View style={[styles.summaryCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, padding: 24 }]}>
                    <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { color: colors.subtextColor }]}>Distance</Text>
                        <Text style={[styles.calcValue, { color: colors.textColor }]}>{stats.distance}</Text>
                    </View>
                    <View style={styles.calcDivider} />
                    <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { color: colors.subtextColor }]}>Weight Category</Text>
                        <Text style={[styles.calcValue, { color: colors.primary, fontWeight: 'bold' }]}>
                            {selectedSize.toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.calcRow}>
                        <Text style={[styles.calcLabel, { color: colors.subtextColor }]}>Rate per KM</Text>
                        <Text style={[styles.calcValue, { color: colors.textColor }]}>₹{rate}/km</Text>
                    </View>

                    <View style={[styles.hr, { marginVertical: 20, opacity: 0.1 }]} />

                    <View style={styles.calcRow}>
                        <Text style={[styles.totalLabel, { color: colors.textColor }]}>Total Freight</Text>
                        <Text style={[styles.totalValue, { color: '#00C853' }]}>₹{totalPrice}</Text>
                    </View>
                </View>

                <View style={styles.spacer40} />

                <View style={[styles.infoBox, { backgroundColor: 'rgba(0, 191, 165, 0.05)', borderColor: 'rgba(0, 191, 165, 0.2)' }]}>
                    <Icon name="information-circle-outline" size={20} color="#00BFA5" />
                    <Text style={[styles.infoText, { color: colors.subtextColor }]}>
                        Price is calculated based on hilly terrain distance and parcel volume/weight.
                    </Text>
                </View>

                <View style={styles.spacer40} />

                <TouchableOpacity
                    style={[styles.scheduleButton, { backgroundColor: colors.primary, zIndex: 9999 }, loading && { opacity: 0.7 }]}
                    onPress={() => {
                        confirmBooking();
                    }}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.scheduleButtonText}>
                            💳 CONFIRM & BOOK FOR ₹{totalPrice}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    // Auto-fetch road metrics when coords change
    React.useEffect(() => {
        if (pickupCoords && dropoffCoords) {
            fetchRoadMetrics(pickupCoords, dropoffCoords);
        }
    }, [pickupCoords, dropoffCoords]);

    const renderRecipientDetails = () => (
        <View style={styles.content}>
            <TouchableOpacity onPress={() => setStep('search')} style={styles.backButton}>
                <Text style={[styles.backText, { color: colors.primary }]}>
                    ← {t('common.back')}
                </Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.textColor }]}>{t('parcel.recipientDetails')}</Text>
            <View style={styles.spacer6} />
            <Text style={[styles.routeSummary, { color: colors.subtextColor }]}>
                {pickup} → {dropoff} · {t(`parcel.size${selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}` as any)}
            </Text>

            <View style={styles.spacer24} />

            {/* Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                <View style={styles.row}>
                    <Icon name="cube-outline" size={24} color={colors.primary} />
                    <View style={styles.summaryInfo}>
                        <Text style={[styles.summaryTitle, { color: colors.textColor }]}>
                            {t(`parcel.size${selectedSize.charAt(0).toUpperCase() + selectedSize.slice(1)}` as any)} · {selectedSize === 'small' ? '< 2 kg' : selectedSize === 'medium' ? '2-10 kg' : '> 10 kg'}
                        </Text>
                        <Text style={[styles.summarySubtitle, { color: colors.subtextColor }]}>
                            {t('parcel.pickupScheduled')} · {t('parcel.estPrice')}: ₹{selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450'}
                        </Text>
                    </View>
                    <Text style={[styles.priceTag, { color: colors.primary }]}>₹{selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450'}</Text>
                </View>
            </View>

            <View style={styles.spacer32} />

            {/* Form Fields */}
            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.recipientName')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder={t('parcel.recipientNamePlaceholder')}
                placeholderTextColor={colors.subtextColor}
            />

            <View style={styles.spacer16} />

            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.contactNumber')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}
                value={contactNumber}
                onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setContactNumber(numericValue);
                }}
                placeholder={t('parcel.contactPlaceholder')}
                placeholderTextColor={colors.subtextColor}
                keyboardType="phone-pad"
                maxLength={10}
            />

            <View style={styles.spacer16} />

            <LocationInput
                label={t('parcel.dropLocation')}
                value={dropLocation}
                onChangeText={setDropLocation}
                onSelect={(res) => setDropLocation(res.display_name)}
                labelColor={colors.subtextColor}
            />

            <View style={styles.spacer16} />

            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.notes')}</Text>
            <View style={styles.spacer6} />
            <TextInput
                style={[styles.input, { color: colors.textColor, backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor, height: 100 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('parcel.notesPlaceholder')}
                placeholderTextColor={colors.subtextColor}
                multiline
                textAlignVertical="top"
            />

            <View style={styles.spacer24} />

            {/* Photo Upload */}
            <Text style={[styles.fieldLabel, { color: colors.subtextColor }]}>{t('parcel.photoTitle')}</Text>
            <View style={styles.spacer12} />
            <TouchableOpacity
                style={[styles.photoBox, { borderColor: colors.primary, backgroundColor: colors.inputFillColor }]}
                onPress={handlePhotoUpload}
                disabled={loading}>
                {loading ? (
                    <ActivityIndicator color={colors.primary} />
                ) : parcelPhoto ? (
                    <Image source={{ uri: parcelPhoto.startsWith('http') ? parcelPhoto : `${API_BASE}${parcelPhoto}` }} style={styles.uploadedPhoto} />
                ) : (
                    <View style={styles.photoPlaceholder}>
                        <Icon name="camera-outline" size={32} color={colors.primary} />
                        <Text style={[styles.photoActionText, { color: colors.primary }]}>{t('parcel.photoAction')}</Text>
                        <Text style={[styles.photoHint, { color: colors.subtextColor }]}>{t('parcel.photoHint')}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.spacer40} />

            <TouchableOpacity
                style={[styles.scheduleButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
                onPress={handleConfirmDetails}
                disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.scheduleButtonText}>
                        🚀 {t('parcel.schedulePickup').toUpperCase()}
                    </Text>
                )}
            </TouchableOpacity>
            <View style={styles.spacer40} />
        </View>
    );

    const renderRideSelection = () => (
        <View style={styles.content}>
            <TouchableOpacity onPress={() => setStep('search')} style={styles.backButton}>
                <Text style={[styles.backText, { color: colors.primary }]}>
                    ← {t('common.back')}
                </Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.textColor }]}>{t('available.title') || 'Select Vehicle'}</Text>
            <View style={styles.spacer6} />
            <Text style={[styles.routeSummary, { color: colors.subtextColor }]}>
                {pickup} → {dropoff} · {selectedDate}
            </Text>

            <View style={styles.spacer24} />

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
            ) : (availableRides || []).length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Icon name="car-outline" size={64} color={colors.borderColor} />
                    <Text style={{ color: colors.subtextColor, marginTop: 16, fontSize: 16 }}>No vehicles available for this route.</Text>
                    <TouchableOpacity
                        style={{ marginTop: 24, padding: 12 }}
                        onPress={() => setStep('search')}>
                        <Text style={{ color: colors.primary, fontWeight: 'bold' }}>GO BACK & CHANGE DETAILS</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {(availableRides || []).map((ride) => {
                        const price = selectedSize === 'small' ? '150' : selectedSize === 'medium' ? '280' : '450';
                        const stats = getTravelStats(pickup, dropoff, ride.departureTime);

                        return (
                            <TouchableOpacity
                                key={ride.id}
                                style={[styles.rideCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                                onPress={() => handleFinalBooking(ride)}>
                                <View style={styles.rideHeader}>
                                    <View style={styles.timeContainer}>
                                        <Text style={[styles.label, { color: colors.subtextColor }]}>DEPARTS</Text>
                                        <Text style={[styles.timeText, { color: colors.textColor }]}>{ride.departureTime}</Text>
                                    </View>
                                    <View style={styles.vehicleContainer}>
                                        <Text style={[styles.vehicleModel, { color: colors.textColor }]}>{ride.vehicleModel}</Text>
                                        <Text style={[styles.vehicleNumber, { color: colors.subtextColor }]}>{ride.vehicleNumber}</Text>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={[styles.label, { color: colors.subtextColor }]}>FIXED FAIR</Text>
                                        <Text style={[styles.priceText, { color: '#00C853' }]}>₹ {price}</Text>
                                    </View>
                                </View>

                                <View style={styles.routeRow}>
                                    <Text style={[styles.routePoint, { color: colors.textColor }]}>{pickup.toUpperCase()}</Text>
                                    <Text style={[styles.routeArrow, { color: colors.subtextColor }]}>→</Text>
                                    <Text style={[styles.routePoint, { color: colors.textColor }]}>{dropoff.toUpperCase()}</Text>
                                </View>

                                <View style={styles.dateTimeRow}>
                                    <View style={styles.dateTimeChip}>
                                        <Text style={styles.dateTimeChipIcon}>📅</Text>
                                        <Text style={[styles.dateTimeChipText, { color: colors.textColor }]}>{selectedDate}</Text>
                                    </View>
                                    <View style={[styles.dateTimeChip, { marginLeft: 10 }]}>
                                        <Text style={styles.dateTimeChipIcon}>🕒</Text>
                                        <Text style={[styles.dateTimeChipText, { color: colors.textColor }]}>{ride.departureTime}</Text>
                                    </View>
                                    <View style={[styles.dateTimeChip, { marginLeft: 10, backgroundColor: 'rgba(31, 175, 99, 0.1)' }]}>
                                        <Text style={styles.dateTimeChipIcon}>🏁</Text>
                                        <Text style={[styles.dateTimeChipText, { color: colors.textColor }]}>{stats.arrival}</Text>
                                    </View>
                                </View>

                                <View style={styles.rideFooter}>
                                    <View style={styles.driverInfo}>
                                        <View style={[styles.avatar, { backgroundColor: isDark ? '#37474F' : '#EEE' }]}>
                                            <Text style={[styles.avatarText, { color: colors.textColor }]}>{(ride.driverName || 'V')[0].toUpperCase()}</Text>
                                        </View>
                                        <View>
                                            <Text style={[styles.driverName, { color: colors.textColor }]}>{ride.driverName || 'Verified Driver'} ✅</Text>
                                            <Text style={[styles.driverRole, { color: colors.subtextColor }]}>PARCEL PARTNER</Text>
                                        </View>
                                    </View>
                                    <View style={styles.seatsInfo}>
                                        <Text style={[styles.seatsLeft, { color: '#00C853' }]}>{stats.distance} • {stats.duration}</Text>
                                        <View style={[styles.arrowBtn, { backgroundColor: colors.borderColor }]}>
                                            <Text style={styles.arrowText}>›</Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    <View style={styles.spacer40} />
                </ScrollView>
            )}
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false} scrollEnabled={step !== 'rides'}>
            {step === 'details' ? renderRecipientDetails() : step === 'rides' ? renderRideSelection() : step === 'calculator' ? renderPriceCalculator() : (
                <View style={styles.content}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={[styles.backText, { color: colors.primary }]}>
                                {t('common.back')}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Greeting */}
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textColor }}>
                        {t('home.greetingParceller' as any) || 'Namaste, Sender 🙏'}
                    </Text>
                    <View style={styles.spacer6} />
                    <Text style={{ fontSize: 16, color: colors.subtextColor }}>
                        {t('home.subGreetingParceller' as any) || 'Ready to ship something today?'}
                    </Text>

                    <View style={styles.spacer24} />

                    {/* Step 1 Search UI - Existing */}
                    <View style={[styles.inputCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor, zIndex: 10 }]}>
                        <LocationInput
                            label={t('parcel.pickupLabel')}
                            value={pickup}
                            onChangeText={setPickup}
                            onSelect={(res) => {
                                setPickup(res.display_name);
                                setPickupCoords([parseFloat(res.lat), parseFloat(res.lon)]);
                            }}
                            labelColor={pickupLabelColor}
                            containerZIndex={3000}
                        />

                        <View style={styles.spacer14} />

                        <LocationInput
                            label={t('parcel.dropoffLabel')}
                            value={dropoff}
                            onChangeText={setDropoff}
                            onSelect={(res) => {
                                setDropoff(res.display_name);
                                setDropoffCoords([parseFloat(res.lat), parseFloat(res.lon)]);
                            }}
                            labelColor={dropoffLabelColor}
                            containerZIndex={2000}
                        />

                        <View style={styles.spacer14} />

                        <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                            {t('PICKUP DATE') || 'PICKUP DATE'}
                        </Text>
                        <View style={styles.spacer6} />
                        <TouchableOpacity
                            style={[
                                styles.input,
                                styles.row,
                                {
                                    backgroundColor: colors.inputFillColor,
                                    borderColor: colors.inputBorderColor,
                                    justifyContent: 'space-between',
                                },
                            ]}
                            onPress={() => setShowCalendar(true)}>
                            <Text style={{ color: colors.textColor, fontSize: 16, fontWeight: '500' }}>
                                {selectedDate}
                            </Text>
                            <Icon name="calendar-outline" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.spacer32} />

                    {/* Parcel Size Section */}
                    <Text style={[styles.sectionTitle, { color: colors.subtextColor }]}>{t('parcel.sizeTitle')}</Text>
                    <View style={styles.spacer12} />
                    <View style={styles.sizeRow}>
                        {sizes.map((size) => (
                            <TouchableOpacity
                                key={size.id}
                                style={[
                                    styles.sizeCard,
                                    {
                                        width: width > 600 ? (width - 60) / 3 : width - 40,
                                        backgroundColor: colors.cardColor,
                                        borderColor: selectedSize === size.id ? colors.primary : colors.borderColor,
                                        borderWidth: selectedSize === size.id ? 2 : 1,
                                    }
                                ]}
                                onPress={() => setSelectedSize(size.id as any)}>
                                <Icon
                                    name={size.icon}
                                    size={28}
                                    color={selectedSize === size.id ? colors.primary : (isDark ? '#FF4081' : colors.primary)}
                                    style={styles.sizeIcon}
                                />
                                <Text style={[styles.sizeLabel, { color: selectedSize === size.id ? colors.primary : colors.textColor }]}>
                                    {t(size.label as any)}
                                </Text>
                                <Text style={[styles.sizeDesc, { color: colors.subtextColor }]}>
                                    {t(size.desc as any)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ height: 40 }} />

                    <TouchableOpacity
                        style={[styles.scheduleButton, { backgroundColor: colors.primary }]}
                        activeOpacity={0.8}
                        onPress={async () => {
                            if (pickup && dropoff) {
                                setLoading(true);
                                let pCoords = pickupCoords;
                                let dCoords = dropoffCoords;

                                try {
                                    if (!pCoords) {
                                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(pickup)}&format=json&limit=1`);
                                        const data = await res.json();
                                        if (data && data.length > 0) {
                                            pCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                            setPickupCoords(pCoords);
                                        }
                                    }
                                    if (!dCoords) {
                                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dropoff)}&format=json&limit=1`);
                                        const data = await res.json();
                                        if (data && data.length > 0) {
                                            dCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                            setDropoffCoords(dCoords);
                                        }
                                    }

                                    if (pCoords && dCoords) {
                                        const url = `https://router.project-osrm.org/route/v1/driving/${pCoords[1]},${pCoords[0]};${dCoords[1]},${dCoords[0]}?overview=false`;
                                        const res = await fetch(url);
                                        const data = await res.json();
                                        if (data.routes && data.routes.length > 0) {
                                            setRoadDistance(Math.round(data.routes[0].distance / 1000));
                                            setRoadDuration(Math.round(data.routes[0].duration / 3600) || 1);
                                        }
                                    }
                                } catch (e) {
                                    console.error('Failed to geocode or fetch route:', e);
                                }

                                setLoading(false);
                                setStep('details');
                            } else {
                                Alert.alert(t('common.error'), 'Please enter pickup and dropoff locations.');
                            }
                        }}>
                        <Text style={styles.scheduleButtonText}>
                            🚀 {t('parcel.schedulePickup').toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.spacer40} />
                </View>
            )}

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
                                const now = new Date();
                                if (calendarYear < now.getFullYear() || (calendarYear === now.getFullYear() && calendarMonth <= now.getMonth())) {
                                    return; // Don't go back further than current month
                                }

                                if (calendarMonth === 0) {
                                    setCalendarMonth(11);
                                    setCalendarYear(calendarYear - 1);
                                } else {
                                    setCalendarMonth(calendarMonth - 1);
                                }
                            }}>
                                <Text style={[styles.calendarNav, { color: (calendarYear < new Date().getFullYear() || (calendarYear === new Date().getFullYear() && calendarMonth <= new Date().getMonth())) ? colors.borderColor : colors.primary }]}>‹</Text>
                            </TouchableOpacity>
                            <Text style={[styles.calendarTitle, { color: colors.textColor }]}>
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][calendarMonth]} {calendarYear}
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
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <Text key={i} style={[styles.dayLabel, { color: colors.subtextColor }]}>{d}</Text>
                            ))}
                        </View>

                        {/* Calendar Grid */}
                        <View style={styles.calendarGrid}>
                            {Array.from({ length: new Date(calendarYear, calendarMonth, 1).getDay() }).map((_, i) => (
                                <View key={`empty-${i}`} style={styles.calendarDay} />
                            ))}
                            {Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }).map((_, i) => {
                                const day = i + 1;
                                const current = new Date();
                                const isToday = day === current.getDate() && calendarMonth === current.getMonth() && calendarYear === current.getFullYear();
                                const formattedDay = `${day < 10 ? '0' : ''}${day}/${calendarMonth + 1 < 10 ? '0' : ''}${calendarMonth + 1}/${calendarYear}`;
                                const isSelected = selectedDate === formattedDay;

                                const cellDate = new Date(calendarYear, calendarMonth, day);
                                const todayDate = new Date(current.getFullYear(), current.getMonth(), current.getDate());
                                const isPast = cellDate < todayDate;

                                return (
                                    <TouchableOpacity
                                        key={`day-${day}`}
                                        disabled={isPast}
                                        style={[
                                            styles.calendarDay,
                                            isToday && { backgroundColor: 'rgba(31, 175, 99, 0.1)' },
                                            isSelected && { backgroundColor: colors.primary, borderRadius: 8 },
                                            isPast && { opacity: 0.2 }
                                        ]}
                                        onPress={() => {
                                            setSelectedDate(formattedDay);
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
                        <TouchableOpacity onPress={() => setShowCalendar(false)} style={{ marginTop: 20, alignItems: 'center' }}>
                            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>CANCEL</Text>
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
        padding: 20,
    },
    backButton: {
        marginBottom: 20,
    },
    backText: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarContent: {
        width: width - 40,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    calendarHeader: {
        flexDirection: 'row',
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
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    dayLabel: {
        width: (width - 80) / 7,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: 'bold',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarDay: {
        width: (width - 80) / 7,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 14,
    },
    inputCard: {
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fieldLabel: {
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 1,
    },
    input: {
        fontSize: 16,
        fontWeight: '500',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 15,
        paddingVertical: 12,
        minHeight: 50,
    },
    spacer6: { height: 6 },
    spacer16: { height: 16 },
    spacer24: { height: 24 },
    spacer32: { height: 32 },
    spacer40: { height: 40 },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1.2,
    },
    sizeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    sizeCard: {
        width: '100%', // Default for smallest screens
        marginBottom: 10,
        paddingVertical: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
    },
    sizeIcon: {
        marginBottom: 8,
    },
    sizeLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    sizeDesc: {
        fontSize: 12,
        opacity: 0.8,
    },
    scheduleButton: {
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    scheduleButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    routesScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    miniRouteCard: {
        width: 180,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginRight: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    miniRouteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    smallDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    routeName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    miniRouteFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingLeft: 20,
    },
    miniRouteArrow: {
        marginHorizontal: 10,
        fontSize: 15,
        opacity: 0.6,
    },
    miniRouteToName: {
        fontSize: 14,
        fontWeight: '500',
    },
    miniRoutePrice: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    routeSummary: {
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.8,
    },
    summaryCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    summaryInfo: {
        flex: 1,
        marginLeft: 12,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summarySubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    priceTag: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    photoBox: {
        height: 160,
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    photoPlaceholder: {
        alignItems: 'center',
    },
    photoActionText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
    },
    photoHint: {
        fontSize: 12,
        marginTop: 4,
    },
    uploadedPhoto: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    rideCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    timeContainer: { flex: 1.2 },
    vehicleContainer: { flex: 2, alignItems: 'center' },
    priceContainer: { flex: 1.2, alignItems: 'flex-end' },
    timeText: {
        fontSize: 20,
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
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    routePoint: {
        fontWeight: 'bold',
        fontSize: 15,
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
        backgroundColor: 'rgba(91, 79, 255, 0.08)',
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
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    driverName: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    driverRole: {
        fontSize: 11,
    },
    seatsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seatsLeft: {
        fontSize: 11,
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
    calcRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    calcLabel: {
        fontSize: 14,
    },
    calcValue: {
        fontSize: 16,
    },
    calcDivider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 8,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    hr: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    spacer12: {
        height: 12,
    },
    spacer14: {
        height: 14,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

export default ParcelBookingView;
