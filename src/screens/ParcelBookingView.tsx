import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Dimensions,
    Platform,
    Image,
    ActivityIndicator,
    Modal,
    useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import LocationInput from '../components/LocationInput';
import { apiRequest, getAuthSessionGeneration } from '../utils/api';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../utils/json';
import { uploadDocumentFile, notify } from '../utils/documentUpload';
import {
    saveFormDraft,
    loadFormDraft,
    clearFormDraft,
    getTodayDisplayDate,
    resolveDraftDate,
    isTodayOrFutureDisplayDate,
} from '../utils/formDraftStorage';
import { pushSubViewHistory, popSubViewHistory, useBrowserBack } from '../utils/browserHistory';

const { width } = Dimensions.get('window');

type ParcelStep = 'search' | 'details' | 'rides' | 'calculator';

interface ParcelBookingViewProps {
    onBack?: () => void;
}

const ParcelBookingView: React.FC<ParcelBookingViewProps> = ({ onBack }) => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    const { token, refreshToken, setAuth, user, logout } = useAuth();
    const { width } = useWindowDimensions();
    const isFocused = useIsFocused();

    // Step state (explicit 4-step wizard: search -> details -> rides -> calculator)
    const [step, setStep] = useState<ParcelStep>('search');
    const [geocoding, setGeocoding] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [fetchingRides, setFetchingRides] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableRides, setAvailableRides] = useState<any[]>([]);
    const [selectedRide, setSelectedRide] = useState<any | null>(null);

    const geocodingRef = useRef(false);
    const fetchingRidesRef = useRef(false);
    const submittingRef = useRef(false);
    const isMountedRef = useRef(true);
    const roadMetricsAbortRef = useRef<AbortController | null>(null);
    const userRef = useRef(user);
    userRef.current = user;
    const draftScope = user?.id || null;
    const prevDraftScopeRef = useRef(draftScope);

    React.useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            roadMetricsAbortRef.current?.abort();
        };
    }, []);

    // Form state - Step 1
    const [pickup, setPickup] = useState(() => loadFormDraft('parcel_pickup', '', draftScope));
    const [dropoff, setDropoff] = useState(() => loadFormDraft('parcel_dropoff', '', draftScope));
    const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
    const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
    const [roadDistance, setRoadDistance] = useState<number | null>(null);
    const [roadDuration, setRoadDuration] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState(() =>
        resolveDraftDate(loadFormDraft('parcel_date', getTodayDisplayDate(), draftScope))
    );
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');

    // Form state - Step 2 (Recipient Details)
    const [recipientName, setRecipientName] = useState(() => loadFormDraft('parcel_recipientName', '', draftScope));
    const [contactNumber, setContactNumber] = useState(() => loadFormDraft('parcel_contactNumber', '', draftScope));
    const [dropLocation, setDropLocation] = useState(() => loadFormDraft('parcel_dropLocation', '', draftScope));
    const [notes, setNotes] = useState(() => loadFormDraft('parcel_notes', '', draftScope));
    const [parcelPhoto, setParcelPhoto] = useState<string | null>(null);

    // Reload user-scoped drafts if authenticated user switches
    React.useEffect(() => {
        if (prevDraftScopeRef.current !== draftScope) {
            prevDraftScopeRef.current = draftScope;
            setPickup(loadFormDraft('parcel_pickup', '', draftScope));
            setDropoff(loadFormDraft('parcel_dropoff', '', draftScope));
            setPickupCoords(null);
            setDropoffCoords(null);
            setRoadDistance(null);
            setRoadDuration(null);
            setSelectedDate(resolveDraftDate(loadFormDraft('parcel_date', getTodayDisplayDate(), draftScope)));
            setRecipientName(loadFormDraft('parcel_recipientName', '', draftScope));
            setContactNumber(loadFormDraft('parcel_contactNumber', '', draftScope));
            setDropLocation(loadFormDraft('parcel_dropLocation', '', draftScope));
            setNotes(loadFormDraft('parcel_notes', '', draftScope));
        }
    }, [draftScope]);

    // Save draft state to sessionStorage (scoped by user ID)
    React.useEffect(() => { saveFormDraft('parcel_pickup', pickup, draftScope); }, [pickup, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_dropoff', dropoff, draftScope); }, [dropoff, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_date', selectedDate, draftScope); }, [selectedDate, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_recipientName', recipientName, draftScope); }, [recipientName, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_contactNumber', contactNumber, draftScope); }, [contactNumber, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_dropLocation', dropLocation, draftScope); }, [dropLocation, draftScope]);
    React.useEffect(() => { saveFormDraft('parcel_notes', notes, draftScope); }, [notes, draftScope]);

    const clearParcelDrafts = () => {
        clearFormDraft('parcel_pickup', draftScope);
        clearFormDraft('parcel_dropoff', draftScope);
        clearFormDraft('parcel_date', draftScope);
        clearFormDraft('parcel_recipientName', draftScope);
        clearFormDraft('parcel_contactNumber', draftScope);
        clearFormDraft('parcel_dropLocation', draftScope);
        clearFormDraft('parcel_notes', draftScope);
    };

    const navigateToStep = (newStep: ParcelStep) => {
        if (newStep === 'calculator' && !selectedRide) return;
        if (newStep !== 'search') {
            pushSubViewHistory(`parcel_${newStep}`);
        }
        setStep(newStep);
    };

    const stepBack = () => {
        if (step === 'calculator') {
            setStep('rides');
            popSubViewHistory();
        } else if (step === 'rides') {
            setStep('details');
            popSubViewHistory();
        } else if (step === 'details') {
            setStep('search');
            popSubViewHistory();
        }
    };

    useBrowserBack(step !== 'search', () => {
        if (step === 'calculator') {
            setStep('rides');
        } else if (step === 'rides') {
            setStep('details');
        } else if (step === 'details') {
            setStep('search');
        }
    }, isFocused);

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

    const fetchRoadMetrics = async (from: [number, number], to: [number, number]): Promise<number | null> => {
        roadMetricsAbortRef.current?.abort();
        const abort = createRequestAbort(10000);
        roadMetricsAbortRef.current = abort.controller;
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
            const res = await fetch(url, { signal: abort.signal });
            if (!res.ok || abort.signal.aborted) return null;
            const data = await parseJsonSafe(res);
            if (abort.signal.aborted || !data?.routes || data.routes.length === 0) return null;
            const route = data.routes[0];
            const km = Math.max(1, Math.round(route.distance / 1000));
            const hrs = Math.max(1, Math.round(route.duration / 3600) || 1);
            if (isMountedRef.current) {
                setRoadDistance(km);
                setRoadDuration(hrs);
            }
            return km;
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                console.error("Failed to fetch road metrics", e);
            }
            return null;
        } finally {
            abort.cleanup();
        }
    };

    const getRatePerKm = (size: 'small' | 'medium' | 'large'): number =>
        size === 'small' ? 2 : size === 'medium' ? 2.5 : 3;

    const calculateParcelPrice = (distanceKm: number, size: 'small' | 'medium' | 'large'): number =>
        Math.ceil(distanceKm * getRatePerKm(size));

    const getEffectivePickup = (ride?: any): string => {
        if (!ride) return pickup.trim();
        if (ride.matchedPickup) return ride.matchedPickup;
        if (ride.isPartialMatch && ride.matchType === 'common_dropoff') {
            return ride.pickup || pickup.trim();
        }
        return pickup.trim() || ride.pickup || '';
    };

    const getEffectiveDropoff = (ride?: any): string => {
        if (!ride) return dropoff.trim();
        if (ride.matchedDropoff) return ride.matchedDropoff;
        if (ride.isPartialMatch && ride.matchType === 'common_pickup') {
            return ride.dropoff || dropoff.trim();
        }
        return dropoff.trim() || ride.dropoff || '';
    };

    const getTravelStats = (p: string, d: string, depTime: string, ride?: any) => {
        const segmentKm = ride?.segmentDistanceKm && ride.segmentDistanceKm > 0
            ? Math.round(ride.segmentDistanceKm)
            : null;
        // Require verified segment or road distance; never fall back to arbitrary hardcoded KM
        const distance = segmentKm !== null ? segmentKm : (roadDistance !== null ? roadDistance : 0);
        const durationHours = segmentKm !== null
            ? Math.max(1, Math.ceil(distance / 30))
            : (roadDuration !== null ? roadDuration : (distance > 0 ? Math.ceil(distance / 30) + 1 : 1));

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
        if (fetchingRidesRef.current) return;
        if (!pickup.trim() || !dropoff.trim()) {
            notify(t('common.error'), 'Please enter pickup and dropoff locations.');
            return;
        }

        fetchingRidesRef.current = true;
        setFetchingRides(true);
        try {
            const dateParts = selectedDate.trim().split('/');
            const apiDate = dateParts.length === 3
                ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
                : selectedDate.trim();
            const endpoint = `/api/rides/available?pickup=${encodeURIComponent(pickup.trim())}&dropoff=${encodeURIComponent(dropoff.trim())}&date=${encodeURIComponent(apiDate)}`;
            const response = await apiRequest(endpoint, {}, logout);
            const data = await parseJsonSafe(response);
            if (!isMountedRef.current) return;
            if (response.ok) {
                setAvailableRides(Array.isArray(data) ? data : []);
                navigateToStep('rides');
            } else {
                notify(t('common.error'), getApiErrorMessage(data, 'Failed to fetch vehicles', response));
            }
        } catch (err) {
            notify(t('common.error'), 'Connection error');
        } finally {
            fetchingRidesRef.current = false;
            if (isMountedRef.current) {
                setFetchingRides(false);
            }
        }
    };

    const handlePhotoUpload = () => {
        if (uploadingPhoto) return;
        if (Platform.OS === 'web') {
            // @ts-ignore
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file = e.target.files?.[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        notify(t('common.error'), 'Image must be under 5MB.');
                        return;
                    }
                    const startGeneration = getAuthSessionGeneration();
                    setUploadingPhoto(true);
                    try {
                        const url = await uploadDocumentFile(file, token, {
                            refreshToken,
                            onTokenRefreshed: async (newToken: string, newRefreshToken?: string | null) => {
                                if (getAuthSessionGeneration() !== startGeneration) return;
                                const latestStoredToken = await AsyncStorage.getItem('auth_token').catch(() => null);
                                const latestUser = userRef.current;
                                if (!latestStoredToken || !latestUser || getAuthSessionGeneration() !== startGeneration) return;
                                const latestRefresh =
                                    newRefreshToken ??
                                    (await AsyncStorage.getItem('auth_refresh_token').catch(() => null)) ??
                                    refreshToken;
                                await setAuth(newToken, latestRefresh, latestUser);
                            },
                            onAuthFailure: () => {
                                if (getAuthSessionGeneration() === startGeneration) {
                                    logout();
                                }
                            },
                        });
                        if (isMountedRef.current && getAuthSessionGeneration() === startGeneration) {
                            setParcelPhoto(url);
                        }
                    } catch (err: any) {
                        if (isMountedRef.current && getAuthSessionGeneration() === startGeneration) {
                            notify(t('common.error'), err?.message || 'Upload failed');
                        }
                    } finally {
                        if (isMountedRef.current) {
                            setUploadingPhoto(false);
                        }
                    }
                }
            };
            input.click();
        } else {
            notify('Mobile Upload', 'Image picker would be triggered here.');
        }
    };

    const handleConfirmDetails = async () => {
        if (fetchingRidesRef.current || uploadingPhoto) return;
        if (!recipientName.trim() || !contactNumber.trim() || !dropLocation.trim()) {
            notify(t('common.error'), 'Please fill in all required recipient details.');
            return;
        }

        // After filling details, we now search for vehicles
        await fetchAvailableRides();
    };

    const handleFinalBooking = (ride: any) => {
        setSelectedRide(ride);
        pushSubViewHistory('parcel_calculator');
        setStep('calculator');
    };

    const confirmBooking = async () => {
        if (submittingRef.current || submitting) return;
        if (!selectedRide) {
            console.error("No ride selected for booking");
            return;
        }

        const effectivePickup = getEffectivePickup(selectedRide);
        const effectiveDropoff = getEffectiveDropoff(selectedRide);

        const stats = getTravelStats(effectivePickup, effectiveDropoff, selectedRide.departureTime, selectedRide);
        const distNum = parseInt(stats.distance, 10) || 0;
        if (distNum <= 0) {
            notify(t('common.error'), 'Route distance could not be verified. Please go back and re-select your route.');
            return;
        }
        const calculatedPrice = calculateParcelPrice(distNum, selectedSize);

        submittingRef.current = true;
        setSubmitting(true);
        try {
            const rideId = selectedRide.id || selectedRide._id;
            const response = await apiRequest(`/api/rides/${rideId}/book`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'parcel',
                    pickup: effectivePickup,
                    dropoff: effectiveDropoff,
                    parcelSize: selectedSize,
                    recipientName,
                    contactNumber,
                    dropLocation,
                    notes,
                    date: selectedDate,
                    photoUrl: parcelPhoto,
                    price: calculatedPrice.toString()
                })
            }, logout);

            if (response.ok) {
                const data = await parseJsonSafe(response);
                const rawId = data?.bookingId || data?.id || data?._id;
                if (!rawId) {
                    notify(
                        t('common.error'),
                        'Booking confirmation was incomplete. Please check your notifications before retrying.'
                    );
                    return;
                }
                const displayId = `RA-P-${String(rawId).slice(-4).toUpperCase()}`;

                clearParcelDrafts();
                if (isMountedRef.current) {
                    setSelectedRide(null);
                    setParcelPhoto(null);
                    setPickup('');
                    setDropoff('');
                    setPickupCoords(null);
                    setDropoffCoords(null);
                    setRoadDistance(null);
                    setRoadDuration(null);
                    setRecipientName('');
                    setContactNumber('');
                    setDropLocation('');
                    setNotes('');
                    setStep('search');
                }
                notify(
                    t('common.success'),
                    `Your parcel was successfully scheduled!\n\nBooking ID: ${displayId}\n\nYou can track this in your notifications.`
                );
                if (onBack) {
                    onBack();
                }
            } else {
                const errorData = await parseJsonSafe(response);
                console.error("Booking failed:", errorData);
                notify(t('common.error'), getApiErrorMessage(errorData, 'Failed to schedule pickup. Please try again.', response));
            }
        } catch (err) {
            console.error("Booking catch error:", err);
            notify(t('common.error'), t('login.connectionError'));
        } finally {
            submittingRef.current = false;
            if (isMountedRef.current) {
                setSubmitting(false);
            }
        }
    };

    const renderPriceCalculator = () => {
        if (!selectedRide) return renderRideSelection();
        const effectivePickup = getEffectivePickup(selectedRide);
        const effectiveDropoff = getEffectiveDropoff(selectedRide);
        const stats = getTravelStats(effectivePickup, effectiveDropoff, selectedRide.departureTime, selectedRide);
        const distNum = parseInt(stats.distance, 10) || 0;
        const rate = getRatePerKm(selectedSize);
        const totalPrice = calculateParcelPrice(distNum, selectedSize);

        return (
            <View style={styles.content}>
                <TouchableOpacity onPress={stepBack} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.primary }]}>← {t('common.back')}</Text>
                </TouchableOpacity>

                <Text style={[styles.title, { color: colors.textColor }]}>Price Calculator</Text>
                <Text style={[styles.routeSummary, { color: colors.subtextColor }]}>
                    {`${effectivePickup} → ${effectiveDropoff}`}
                </Text>

                {selectedRide.isPartialMatch && (
                    <View
                        style={{
                            borderWidth: 1,
                            borderRadius: 14,
                            padding: 14,
                            marginTop: 16,
                            backgroundColor: isDark ? 'rgba(255, 179, 0, 0.12)' : 'rgba(255, 143, 0, 0.1)',
                            borderColor: '#FFB300',
                        }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8, marginBottom: 4, color: isDark ? '#FFD54F' : '#EF6C00' }}>
                            COMMON-POINT SEGMENT BOOKING
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textColor }}>
                            {`Shipping parcel on route segment: ${effectivePickup} → ${effectiveDropoff}`}
                        </Text>
                    </View>
                )}

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
                    style={[styles.scheduleButton, { backgroundColor: colors.primary, zIndex: 9999 }, submitting && { opacity: 0.7 }]}
                    onPress={() => {
                        confirmBooking();
                    }}
                    disabled={submitting}>
                    {submitting ? (
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
            <TouchableOpacity onPress={stepBack} style={styles.backButton}>
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
                            {t('parcel.pickupScheduled')} · {roadDistance !== null
                                ? `${t('parcel.estPrice')}: ₹${calculateParcelPrice(roadDistance, selectedSize)}`
                                : `Rate: ₹${getRatePerKm(selectedSize)}/km`}
                        </Text>
                    </View>
                    <Text style={[styles.priceTag, { color: colors.primary }]}>
                        {roadDistance !== null
                            ? `₹${calculateParcelPrice(roadDistance, selectedSize)}`
                            : `₹${getRatePerKm(selectedSize)}/km`}
                    </Text>
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
                disabled={uploadingPhoto}>
                {uploadingPhoto ? (
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
                style={[styles.scheduleButton, { backgroundColor: colors.primary }, (fetchingRides || uploadingPhoto) && { opacity: 0.7 }]}
                onPress={handleConfirmDetails}
                disabled={fetchingRides || uploadingPhoto}>
                {fetchingRides ? (
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

    const renderRideSelection = () => {
        const getEffectivePrice = (r: any): number =>
            r.segmentPricePerSeat && r.segmentPricePerSeat > 0 ? r.segmentPricePerSeat : (r.pricePerSeat || 0);
        const directRides = (availableRides || [])
            .filter((r) => !r.isPartialMatch)
            .sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
        const commonPointRides = (availableRides || [])
            .filter((r) => r.isPartialMatch)
            .sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
        const orderedRides = [...directRides, ...commonPointRides];

        return (
            <View style={styles.content}>
                <TouchableOpacity onPress={stepBack} style={styles.backButton}>
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

                {fetchingRides ? (
                    <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
                ) : orderedRides.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Icon name="car-outline" size={64} color={colors.borderColor} />
                        <Text style={{ color: colors.subtextColor, marginTop: 16, fontSize: 16 }}>No vehicles available for this route.</Text>
                        <TouchableOpacity
                            style={{ marginTop: 24, padding: 12 }}
                            onPress={stepBack}>
                            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>GO BACK & CHANGE DETAILS</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {directRides.length === 0 && commonPointRides.length > 0 && (
                            <View
                                style={{
                                    borderWidth: 1,
                                    borderRadius: 14,
                                    padding: 14,
                                    marginBottom: 16,
                                    backgroundColor: isDark ? 'rgba(255, 179, 0, 0.12)' : 'rgba(255, 143, 0, 0.1)',
                                    borderColor: '#FFB300',
                                }}>
                                <Text style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8, marginBottom: 4, color: isDark ? '#FFD54F' : '#EF6C00' }}>
                                    COMMON ROUTE POINT DRIVERS
                                </Text>
                                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textColor }}>
                                    {`No direct vehicles from ${pickup || 'your pickup'} to ${dropoff || 'your destination'}, but these drivers share a common point on your route:`}
                                </Text>
                            </View>
                        )}
                        {orderedRides.map((ride, index) => {
                            const effectivePickup = getEffectivePickup(ride);
                            const effectiveDropoff = getEffectiveDropoff(ride);
                            const stats = getTravelStats(effectivePickup, effectiveDropoff, ride.departureTime, ride);
                            const distNum = parseInt(stats.distance, 10) || 0;
                            const estimatedPrice = calculateParcelPrice(distNum, selectedSize);
                            const showCommonPointDivider =
                                directRides.length > 0 && commonPointRides.length > 0 && index === directRides.length;
                            const badgeLabel =
                                ride.matchType === 'common_dropoff'
                                    ? `COMMON DESTINATION · STARTS FROM ${effectivePickup.toUpperCase()}`
                                    : `COMMON STARTING POINT · GOES UP TO ${effectiveDropoff.toUpperCase()}`;

                            return (
                                <View key={ride.id || ride._id || String(index)}>
                                    {showCommonPointDivider && (
                                        <View style={{ borderTopWidth: 1, borderTopColor: colors.borderColor, paddingTop: 18, marginTop: 6, marginBottom: 14 }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: colors.textColor }}>
                                                Other Drivers from Common Point
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.subtextColor }}>
                                                Drivers starting from or passing through your route points
                                            </Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.rideCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                                        onPress={() => handleFinalBooking(ride)}>
                                        {ride.isPartialMatch && (
                                            <View
                                                style={{
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    borderRadius: 10,
                                                    marginBottom: 12,
                                                    alignSelf: 'flex-start',
                                                    backgroundColor: isDark ? 'rgba(255, 179, 0, 0.16)' : 'rgba(255, 143, 0, 0.12)',
                                                    borderWidth: 1,
                                                    borderColor: '#FFB300',
                                                }}>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 0.6, color: isDark ? '#FFD54F' : '#EF6C00' }}>
                                                    {badgeLabel}
                                                </Text>
                                            </View>
                                        )}
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
                                                <Text style={[styles.label, { color: colors.subtextColor }]}>EST. FARE</Text>
                                                <Text style={[styles.priceText, { color: '#00C853' }]}>₹ {estimatedPrice}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.routeRow}>
                                            <Text style={[styles.routePoint, { color: colors.textColor }]}>{effectivePickup.toUpperCase()}</Text>
                                            <Text style={[styles.routeArrow, { color: colors.subtextColor }]}>→</Text>
                                            <Text style={[styles.routePoint, { color: colors.textColor }]}>{effectiveDropoff.toUpperCase()}</Text>
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
                                                    <Text style={[styles.arrowText, { color: colors.textColor }]}>›</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                        <View style={styles.spacer40} />
                    </ScrollView>
                )}
            </View>
        );
    };

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
                            onChangeText={(text) => {
                                setPickup(text);
                                setPickupCoords(null);
                                setRoadDistance(null);
                                setRoadDuration(null);
                            }}
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
                            onChangeText={(text) => {
                                setDropoff(text);
                                setDropoffCoords(null);
                                setRoadDistance(null);
                                setRoadDuration(null);
                            }}
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
                            onPress={() => {
                                const parts = selectedDate.trim().split('/');
                                if (parts.length === 3) {
                                    const m = parseInt(parts[1], 10) - 1;
                                    const y = parseInt(parts[2], 10);
                                    if (!isNaN(m) && m >= 0 && m <= 11 && !isNaN(y)) {
                                        setCalendarMonth(m);
                                        setCalendarYear(y);
                                    }
                                }
                                setShowCalendar(true);
                            }}>
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
                        style={[styles.scheduleButton, { backgroundColor: colors.primary }, geocoding && { opacity: 0.7 }]}
                        activeOpacity={0.8}
                        disabled={geocoding}
                        onPress={async () => {
                            if (geocodingRef.current) return;
                            if (!pickup.trim() || !dropoff.trim()) {
                                notify(t('common.error'), 'Please enter pickup and dropoff locations.');
                                return;
                            }
                            if (!isTodayOrFutureDisplayDate(selectedDate)) {
                                notify(t('common.error'), 'Please select today or a future pickup date.');
                                return;
                            }

                            geocodingRef.current = true;
                            setGeocoding(true);
                            let pCoords = pickupCoords;
                            let dCoords = dropoffCoords;
                            let resolvedDistanceKm = roadDistance;

                            const abort = createRequestAbort(12000);
                            try {
                                if (!pCoords) {
                                    const res = await apiRequest(
                                        `/api/location/search?q=${encodeURIComponent(pickup.trim() + ', Uttarakhand, India')}`,
                                        { signal: abort.signal },
                                        logout
                                    );
                                    if (res.ok) {
                                        const data = await parseJsonSafe<any[]>(res);
                                        if (data && data.length > 0) {
                                            pCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                            if (isMountedRef.current) setPickupCoords(pCoords);
                                        }
                                    }
                                }
                                if (!dCoords) {
                                    const res = await apiRequest(
                                        `/api/location/search?q=${encodeURIComponent(dropoff.trim() + ', Uttarakhand, India')}`,
                                        { signal: abort.signal },
                                        logout
                                    );
                                    if (res.ok) {
                                        const data = await parseJsonSafe<any[]>(res);
                                        if (data && data.length > 0) {
                                            dCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                                            if (isMountedRef.current) setDropoffCoords(dCoords);
                                        }
                                    }
                                }

                                if (pCoords && dCoords && resolvedDistanceKm === null) {
                                    const km = await fetchRoadMetrics(pCoords, dCoords);
                                    if (km !== null) {
                                        resolvedDistanceKm = km;
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to geocode or fetch route:', e);
                            } finally {
                                abort.cleanup();
                                geocodingRef.current = false;
                                if (isMountedRef.current) {
                                    setGeocoding(false);
                                }
                            }

                            if (!isMountedRef.current) return;
                            if (resolvedDistanceKm === null || resolvedDistanceKm <= 0) {
                                notify(
                                    t('common.error'),
                                    'Could not determine route distance between pickup and dropoff. Please select valid locations from suggestions or check your connection.'
                                );
                                return;
                            }

                            navigateToStep('details');
                        }}>
                        {geocoding ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.scheduleButtonText}>
                                🚀 {t('parcel.schedulePickup').toUpperCase()}
                            </Text>
                        )}
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
