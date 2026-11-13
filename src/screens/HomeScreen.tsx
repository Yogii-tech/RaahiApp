import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
    Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest, getAuthSessionGeneration } from '../utils/api';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../utils/json';
import { notify } from '../utils/notify';
import Icon from 'react-native-vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';

import AvailableRidesScreen from './AvailableRidesScreen';
import BookRideScreen from './BookRideScreen';
import ParcelBookingView from './ParcelBookingView';
import LocationInput from '../components/LocationInput';
import {
    saveFormDraft,
    loadFormDraft,
    clearFormDraft,
    getTodayDisplayDate,
    isTodayOrFutureDisplayDate,
    resolveDraftDate,
} from '../utils/formDraftStorage';
import { pushSubViewHistory, popSubViewHistory, useBrowserBack } from '../utils/browserHistory';
import ResubmitDocsView from './ResubmitDocsView';

interface HomeScreenProps {
    onSosPressed?: () => void;
    setParcelMode?: (mode: boolean) => void;
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



type HomeView = 'home' | 'available' | 'book' | 'parcel' | 'resubmit_kyc';

const HomeScreen: React.FC<HomeScreenProps> = ({ onSosPressed, setParcelMode }) => {
    const { isDark, colors } = useTheme();
    const { token, refreshToken, user, logout, setAuth } = useAuth();
    const { t } = useLanguage();
    const isFocused = useIsFocused();


    const isDriver = user?.role === 'driver';
    const isParceller = user?.role === 'parceller';
    const draftScope = user?.id || null;
    const prevDraftScopeRef = useRef(draftScope);
    const isMountedRef = useRef(true);

    const [view, setView] = useState<HomeView>('home');
    const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
    const [pickup, setPickup] = useState(() => loadFormDraft('home_pickup', '', draftScope));
    const [dropoff, setDropoff] = useState(() => loadFormDraft('home_dropoff', '', draftScope));
    const [date, setDate] = useState(() =>
        resolveDraftDate(loadFormDraft('home_date', getTodayDisplayDate(), draftScope))
    );

    // Convert display date DD/MM/YYYY → API format YYYY-MM-DD
    const toApiDate = (displayDate: string): string => {
        const parts = displayDate.trim().split('/');
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            return `${yyyy}-${mm}-${dd}`;
        }
        return displayDate; // fallback: return as-is
    };
    const [departureTime, setDepartureTime] = useState(() => loadFormDraft('home_departureTime', '', draftScope));
    const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>(() => loadFormDraft('home_timePeriod', 'AM', draftScope));
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTimePeriodDropdown, setShowTimePeriodDropdown] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [recentRides, setRecentRides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showPostSuccess, setShowPostSuccess] = useState(false);
    const [discoveredStops, setDiscoveredStops] = useState<any[]>([]);
    const [pickupLandmarks, setPickupLandmarks] = useState<any[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewAttempted, setPreviewAttempted] = useState(false);
    const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);
    const [postingRide, setPostingRide] = useState(false);
    const [findingRides, setFindingRides] = useState(false);
    const [pricePerSeat, setPricePerSeat] = useState(() => loadFormDraft('home_pricePerSeat', '', draftScope));
    const [hideVerificationBanner, setHideVerificationBanner] = useState(false);

    const findingRidesRef = useRef(false);
    const postingRideRef = useRef(false);
    const routePreviewAbortRef = useRef<AbortController | null>(null);
    const landmarksAbortRef = useRef<AbortController | null>(null);
    const recentRidesAbortRef = useRef<AbortController | null>(null);
    const authStateRef = useRef({ token, refreshToken, user, logout, setAuth });
    authStateRef.current = { token, refreshToken, user, logout, setAuth };

    useEffect(() => {
        if (prevDraftScopeRef.current !== draftScope) {
            prevDraftScopeRef.current = draftScope;
            setPickup(loadFormDraft('home_pickup', '', draftScope));
            setDropoff(loadFormDraft('home_dropoff', '', draftScope));
            setDate(resolveDraftDate(loadFormDraft('home_date', getTodayDisplayDate(), draftScope)));
            setDepartureTime(loadFormDraft('home_departureTime', '', draftScope));
            setTimePeriod(loadFormDraft('home_timePeriod', 'AM', draftScope));
            setPricePerSeat(loadFormDraft('home_pricePerSeat', '', draftScope));
        }
    }, [draftScope]);

    // Save draft state to sessionStorage (scoped by user ID)
    useEffect(() => { saveFormDraft('home_pickup', pickup, draftScope); }, [pickup, draftScope]);
    useEffect(() => { saveFormDraft('home_dropoff', dropoff, draftScope); }, [dropoff, draftScope]);
    useEffect(() => { saveFormDraft('home_date', date, draftScope); }, [date, draftScope]);
    useEffect(() => { saveFormDraft('home_departureTime', departureTime, draftScope); }, [departureTime, draftScope]);
    useEffect(() => { saveFormDraft('home_timePeriod', timePeriod, draftScope); }, [timePeriod, draftScope]);
    useEffect(() => { saveFormDraft('home_pricePerSeat', pricePerSeat, draftScope); }, [pricePerSeat, draftScope]);

    const navigateToView = (newView: HomeView) => {
        if (newView === 'book' && !selectedRide) return;
        if (newView !== 'home') {
            pushSubViewHistory(newView);
        }
        setView(newView);
    };

    useBrowserBack(view !== 'home', () => {
        if (view === 'book') {
            setView('available');
        } else if (view === 'available' || view === 'parcel' || view === 'resubmit_kyc') {
            setView('home');
            if (setParcelMode) setParcelMode(false);
        }
    }, isFocused);


    useEffect(() => {
        isMountedRef.current = true;
        fetchRecentRides();
        if (isDriver) refreshDriverProfile();
        return () => {
            isMountedRef.current = false;
            routePreviewAbortRef.current?.abort();
            landmarksAbortRef.current?.abort();
            recentRidesAbortRef.current?.abort();
        };
    }, []);

    // Re-sync verification status whenever screen comes into focus
    useEffect(() => {
        if (isFocused && isDriver) refreshDriverProfile();
    }, [isFocused, isDriver]);

    const refreshDriverProfile = async () => {
        const startGeneration = getAuthSessionGeneration();
        try {
            const { refreshToken: curRefresh, logout: curLogout, setAuth: curSetAuth } = authStateRef.current;
            const response = await apiRequest('/api/user/profile', {}, curLogout);
            if (!isMountedRef.current || getAuthSessionGeneration() !== startGeneration || !response.ok) return;
            const fresh = await parseJsonSafe(response);
            if (!fresh || !isMountedRef.current || getAuthSessionGeneration() !== startGeneration) return;
            const latestUser = authStateRef.current.user;
            if (!latestUser) return;
            if (fresh.verification_status !== latestUser.verification_status ||
                fresh.rejection_reason !== latestUser.rejection_reason) {
                const latestToken = await AsyncStorage.getItem('auth_token').catch(() => null);
                if (!latestToken || !isMountedRef.current || getAuthSessionGeneration() !== startGeneration) return;
                const latestRefresh = (await AsyncStorage.getItem('auth_refresh_token').catch(() => null)) ?? curRefresh;
                await curSetAuth(latestToken, latestRefresh, {
                    ...latestUser,
                    verification_status: fresh.verification_status,
                    rejection_reason: fresh.rejection_reason,
                } as any);
            }
        } catch (_) { /* silent — not critical */ }
    };

    const fetchRecentRides = async () => {
        recentRidesAbortRef.current?.abort();
        const abort = createRequestAbort(10000);
        recentRidesAbortRef.current = abort.controller;
        const startGeneration = getAuthSessionGeneration();
        try {
            setLoading(true);
            setError(false);
            const role = isDriver ? 'driver' : 'passenger';
            const response = await apiRequest(`/api/rides/recent?role=${role}`, { signal: abort.signal }, logout);
            if (!isMountedRef.current || abort.signal.aborted || getAuthSessionGeneration() !== startGeneration) return;
            if (response.ok) {
                const data = await parseJsonSafe(response);
                if (isMountedRef.current && !abort.signal.aborted) {
                    setRecentRides(Array.isArray(data) ? data : []);
                }
            } else {
                if (isMountedRef.current) {
                    setError(true);
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || (abort.signal.aborted && !abort.didTimeout())) return;
            if (isMountedRef.current) {
                setError(true);
            }
        } finally {
            abort.cleanup();
            if (isMountedRef.current && (!abort.signal.aborted || abort.didTimeout())) {
                setLoading(false);
            }
        }
    };

    const fetchRoutePreview = async (p: string, d: string) => {
        if (!p.trim() || !d.trim() || !isDriver) return;
        routePreviewAbortRef.current?.abort();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        routePreviewAbortRef.current = controller;

        setPreviewLoading(true);
        setPreviewAttempted(false);
        try {
            const response = await apiRequest(
                `/api/rides/route-preview?pickup=${encodeURIComponent(p.trim())}&dropoff=${encodeURIComponent(d.trim())}`,
                controller ? { signal: controller.signal } : {},
                logout
            );
            if (controller?.signal.aborted) return;
            if (response.ok) {
                const data = await parseJsonSafe(response);
                if (controller?.signal.aborted) return;
                setDiscoveredStops(data?.stops || []);
                setTotalDistanceKm(data?.totalDistanceKm || null);
            } else {
                setDiscoveredStops([]);
                setTotalDistanceKm(null);
            }
            setPreviewAttempted(true);
        } catch (err: any) {
            if (err?.name === 'AbortError' || controller?.signal.aborted) return;
            console.error('Route preview error:', err);
            setDiscoveredStops([]);
            setTotalDistanceKm(null);
            setPreviewAttempted(true);
        } finally {
            if (!controller?.signal.aborted && isMountedRef.current) {
                setPreviewLoading(false);
            }
        }
    };

    useEffect(() => {
        if (pickup && dropoff && isDriver) {
            setPreviewAttempted(false);
            const timer = setTimeout(() => {
                fetchRoutePreview(pickup, dropoff);
            }, 2000); // 2s debounce — wait for user to finish typing
            return () => {
                clearTimeout(timer);
                routePreviewAbortRef.current?.abort();
            };
        } else {
            routePreviewAbortRef.current?.abort();
            setDiscoveredStops([]);
            setTotalDistanceKm(null);
            setPreviewLoading(false);
            setPreviewAttempted(false);
        }
    }, [pickup, dropoff, isDriver]);

    const handleTimeChange = (text: string) => {
        // Remove non-numeric characters
        const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);

        if (cleaned.length === 0) {
            setDepartureTime('');
            return;
        }

        // Extract hours and minutes, clamping to 23:59 max before 12h AM/PM conversion
        let hrs = cleaned.slice(0, 2);
        let mins = cleaned.slice(2, 4);

        if (hrs.length === 2) {
            let h = parseInt(hrs, 10);
            if (h > 23) h = 23;
            if (h > 12) {
                h = h - 12;
                hrs = h.toString().padStart(2, '0');
                setTimePeriod('PM');
            } else if (h === 12) {
                hrs = '12';
                setTimePeriod('PM');
            } else if (h === 0) {
                hrs = '12';
                setTimePeriod('AM');
            } else {
                hrs = h.toString().padStart(2, '0');
            }
        }

        if (mins.length === 1 && parseInt(mins, 10) > 5) {
            mins = '5';
        } else if (mins.length === 2) {
            const m = Math.min(59, parseInt(mins, 10));
            mins = m.toString().padStart(2, '0');
        }

        let result = hrs;
        if (cleaned.length > 2) {
            result += ':' + mins;
        } else if (cleaned.length === 2 && text.length > departureTime.length) {
            result += ':';
        }

        setDepartureTime(result);
    };

    const handleFindRides = async () => {
        if (findingRidesRef.current) return;
        if (!pickup.trim() || !dropoff.trim()) {
            notify(t('common.error'), 'Please enter pickup and dropoff locations.');
            return;
        }
        if (!isTodayOrFutureDisplayDate(date)) {
            notify(t('common.error'), 'Please select today or a future travel date.');
            return;
        }

        findingRidesRef.current = true;
        setFindingRides(true);
        // Save recent-search telemetry best-effort so telemetry/network failure never blocks searching
        apiRequest('/api/rides/recent', {
            method: 'POST',
            body: JSON.stringify({
                pickup: pickup.trim(),
                dropoff: dropoff.trim(),
                rideType: view === 'parcel' ? 'parcel' : 'seat',
            }),
        }, logout).catch(() => {});

        navigateToView('available');
        findingRidesRef.current = false;
        setFindingRides(false);
    };


    const handlePostRide = async () => {
        if (postingRideRef.current || postingRide) return;

        // Guard: driver must be verified before posting
        if (isDriver && user?.verification_status !== 'verified') {
            if (user?.verification_status === 'rejected') {
                notify(
                    '🚫 Documents Rejected',
                    `Your documents were rejected.\n\nReason: ${user?.rejection_reason || 'Please contact support.'}\n\nPlease resubmit your documents to continue.`
                );
            } else {
                notify(
                    '⏳ Verification Pending',
                    'Your documents are under admin review. You will be notified once your account is approved and you can start posting rides.'
                );
            }
            return;
        }

        if (!pickup.trim() || !dropoff.trim()) return;
        if (!isTodayOrFutureDisplayDate(date)) {
            notify(t('common.error'), 'Cannot post a ride for a past date.');
            return;
        }
        if (!departureTime.trim()) {
            notify(t('common.error'), 'Please enter a departure time.');
            return;
        }
        if (!timePeriod) {
            notify(t('common.error'), 'Please select AM or PM for your departure time.');
            return;
        }

        const finalTime = departureTime.trim().toUpperCase().includes('AM') || departureTime.trim().toUpperCase().includes('PM')
            ? departureTime.trim()
            : `${departureTime.trim()} ${timePeriod}`;

        // Parse & validate time (1..12 and 0..59)
        const timeParts = finalTime.split(' ');
        const timePart = timeParts[0];
        const period = timeParts[1] || timePeriod;
        const [rawHours, rawMinutes] = timePart.split(':').map(Number);
        if (isNaN(rawHours) || rawHours < 1 || rawHours > 12 || (timePart.includes(':') && (isNaN(rawMinutes) || rawMinutes < 0 || rawMinutes > 59))) {
            notify(t('common.error'), 'Please enter a valid departure time (HH:MM).');
            return;
        }

        postingRideRef.current = true;
        setPostingRide(true);
        try {
            // Time Validation
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            const currentDateStr = `${dd}/${mm}/${yyyy}`;

            if (date.trim() === currentDateStr) {
                let hours = rawHours;
                const minutes = rawMinutes || 0;
                if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;

                const selectedTotalMinutes = hours * 60 + minutes;
                const currentTotalMinutes = today.getHours() * 60 + today.getMinutes();

                if (selectedTotalMinutes < currentTotalMinutes) {
                    notify(t('common.error'), 'Cannot post a ride for a past time today.');
                    return;
                }
            }

            const priceNum = parseInt(pricePerSeat.trim(), 10);
            if (isNaN(priceNum) || priceNum <= 0) {
                notify(t('common.error'), 'Please enter a valid passenger cost per seat.');
                return;
            }

            const response = await apiRequest('/api/rides/create', {
                method: 'POST',
                body: JSON.stringify({
                    pickup: pickup.trim(),
                    dropoff: dropoff.trim(),
                    date: toApiDate(date.trim()), // Convert DD/MM/YYYY → YYYY-MM-DD for backend
                    departureTime: finalTime,
                    vehicleModel: user?.vehicle?.vehicle_name || "Vehicle",
                    vehicleNumber: user?.vehicle?.vehicle_number || "UK-00-0000",
                    seatsTotal: user?.vehicle?.seats || 4,
                    seatingLayout: user?.vehicle?.seating_layout || "sedan",
                    pricePerSeat: priceNum,
                }),
            }, logout);

            if (response.ok) {
                setPickup('');
                setDropoff('');
                setPricePerSeat('');
                clearFormDraft('home_pickup', draftScope);
                clearFormDraft('home_dropoff', draftScope);
                clearFormDraft('home_departureTime', draftScope);
                clearFormDraft('home_pricePerSeat', draftScope);
                clearFormDraft('home_date', draftScope);
                setDate(getTodayDisplayDate());
                setDepartureTime('');
                setShowPostSuccess(true);
                fetchRecentRides(); // Refresh recent list
            } else {
                const data = await parseJsonSafe(response);
                notify(
                    response.status === 429 ? 'Please Wait' : t('common.error'),
                    getApiErrorMessage(data, 'Failed to post ride', response)
                );
            }
        } catch (err) {
            console.error('Post ride error:', err);
            notify(t('common.error'), t('login.connectionError'));
        } finally {
            postingRideRef.current = false;
            if (isMountedRef.current) {
                setPostingRide(false);
            }
        }
    };

    if (view === 'resubmit_kyc') {
        return <ResubmitDocsView disableBrowserBack onClose={() => {
            setView('home');
            popSubViewHistory();
        }} />;
    }

    if (isParceller || view === 'parcel') {
        return <ParcelBookingView onBack={isParceller ? undefined : () => {
            setView('home');
            if (setParcelMode) setParcelMode(false);
            popSubViewHistory();
        }} />;
    }

    if (view === 'available') {
        return (
            <AvailableRidesScreen
                searchPickup={pickup.trim()}
                searchDropoff={dropoff.trim()}
                searchDate={date.trim()}
                onBack={() => {
                    setView('home');
                    popSubViewHistory();
                }}
                onSelectRide={(ride) => {
                    setSelectedRide(ride);
                    pushSubViewHistory('book');
                    setView('book');
                }}
            />
        );
    }

    if (view === 'book' && selectedRide) {
        return (
            <BookRideScreen
                ride={selectedRide}
                searchPickup={pickup.trim()}
                searchDropoff={dropoff.trim()}
                onBack={() => {
                    setView('available');
                    popSubViewHistory();
                }}
                onBookingComplete={() => {
                    clearFormDraft('home_pickup', draftScope);
                    clearFormDraft('home_dropoff', draftScope);
                    clearFormDraft('home_departureTime', draftScope);
                    clearFormDraft('home_date', draftScope);
                    setSelectedRide(null);
                    setView('home');
                    popSubViewHistory();
                }}
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

            {/* ── Verification Status Banner (drivers only) ─────────────── */}
            {isDriver && user?.verification_status !== 'verified' && !hideVerificationBanner && (
                <View style={{
                    borderRadius: 14,
                    borderWidth: 1.5,
                    marginBottom: 20,
                    overflow: 'hidden',
                    ...(user?.verification_status === 'rejected'
                        ? { backgroundColor: isDark ? 'rgba(244,67,54,0.1)' : '#FFF5F5', borderColor: '#F44336' }
                        : { backgroundColor: isDark ? 'rgba(255,193,7,0.08)' : '#FFFBEC', borderColor: '#FFC107' }
                    ),
                }}>
                    {/* Coloured top strip */}
                    <View style={{
                        height: 4,
                        backgroundColor: user?.verification_status === 'rejected' ? '#F44336' : '#FFC107',
                    }} />
                    <View style={{ padding: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 26, marginRight: 12 }}>
                            {user?.verification_status === 'rejected' ? '❌' : '🕐'}
                        </Text>
                        <View style={{ flex: 1 }}>
                            <Text style={{
                                fontWeight: '800', fontSize: 14,
                                color: user?.verification_status === 'rejected' ? '#F44336' : '#F59E0B',
                                marginBottom: 4, letterSpacing: 0.3,
                            }}>
                                {user?.verification_status === 'rejected'
                                    ? 'Documents Rejected — Action Required'
                                    : 'Documents Under Review'}
                            </Text>
                            <Text style={{ fontSize: 13, color: isDark ? '#CBD5E1' : '#475569', lineHeight: 19 }}>
                                {user?.verification_status === 'rejected'
                                    ? `Reason: ${user?.rejection_reason || 'Please contact support for details.'}\n\nPlease resubmit your documents or contact support.`
                                    : 'Our admin team is reviewing your vehicle documents. You will be notified once approved. Ride posting will be enabled after verification.'}
                            </Text>
                            {user?.verification_status === 'rejected' && (
                                <TouchableOpacity 
                                    style={{ marginTop: 12, backgroundColor: '#F44336', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' }}
                                    onPress={() => navigateToView('resubmit_kyc')}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Resubmit Documents</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setHideVerificationBanner(true)} style={{ padding: 4 }}>
                            <Icon name="close" size={20} color={isDark ? '#CBD5E1' : '#475569'} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Ride Card */}
            <View
                style={[
                    styles.rideCard,
                    {
                        backgroundColor: colors.cardColor,
                        borderColor: colors.borderColor,
                        shadowColor: isDark ? '#000' : '#5B4FFF',
                        zIndex: 9999, // Ensure absolute children of this card overlap subsequent elements
                    },
                ]}>

                <LocationInput
                    label={t('home.pickupLabel')}
                    value={pickup}
                    onChangeText={(text) => {
                        setPickup(text);
                        setPickupLandmarks([]);
                        landmarksAbortRef.current?.abort();
                    }}
                    onSelect={async (res) => {
                        setPickup(res.display_name.split(',')[0].trim());
                        // Fetch the 3km local landmarks using our new Overpass API!
                        if (!isDriver && res.lat && res.lon) {
                            landmarksAbortRef.current?.abort();
                            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                            landmarksAbortRef.current = controller;
                            try {
                                const response = await apiRequest(
                                    `/api/location/landmarks?lat=${res.lat}&lon=${res.lon}`,
                                    controller ? { signal: controller.signal } : {},
                                    logout
                                );
                                if (!controller?.signal.aborted && response.ok) {
                                    const data = await parseJsonSafe(response);
                                    if (!controller?.signal.aborted) {
                                        setPickupLandmarks(Array.isArray(data) ? data : []);
                                    }
                                }
                            } catch (e: any) {
                                if (e?.name !== 'AbortError') { /* silent */ }
                            }
                        }
                    }}
                    labelColor={pickupLabelColor}
                    containerZIndex={3000}
                />

                {!isDriver && pickupLandmarks.length > 0 && (
                    <View style={{ marginTop: 12, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.subtextColor, marginBottom: 8, letterSpacing: 1 }}>
                            SUGGESTED NEARBY LANDMARKS
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {pickupLandmarks.slice(0, 5).map((l, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={{
                                        backgroundColor: isDark ? 'rgba(0,255,255,0.06)' : 'rgba(91,79,255,0.06)',
                                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8,
                                        borderWidth: 1, borderColor: isDark ? 'rgba(0,255,255,0.1)' : 'rgba(91,79,255,0.1)'
                                    }}
                                    onPress={() => setPickup(l.name)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ marginRight: 4 }}>
                                            {l.type.includes('bus') ? '🚌' : l.type.includes('viewpoint') ? '⛰️' : l.type.includes('worship') ? '⛩️' : '📍'}
                                        </Text>
                                        <View>
                                            <Text style={{ color: colors.textColor, fontSize: 12, fontWeight: 'bold' }}>{l.name}</Text>
                                            <Text style={{ color: colors.subtextColor, fontSize: 10 }}>{l.distanceM}m away</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.spacer14} />

                <LocationInput
                    label={t('home.dropoffLabel')}
                    value={dropoff}
                    onChangeText={setDropoff}
                    onSelect={(res) => setDropoff(res.display_name.split(',')[0].trim())}
                    labelColor={dropoffLabelColor}
                    containerZIndex={2000}
                />

                {isDriver && (
                    <>
                        <View style={styles.spacer14} />
                        <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                            {t('home.pricePerSeat').toUpperCase()}
                        </Text>
                        <View style={styles.spacer6} />
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.inputFillColor,
                                    borderColor: pricePerSeat ? colors.primary : colors.inputBorderColor,
                                    color: colors.textColor
                                }
                            ]}
                            value={pricePerSeat}
                            onChangeText={setPricePerSeat}
                            placeholder="e.g. 350"
                            placeholderTextColor={colors.subtextColor}
                            keyboardType="numeric"
                        />
                    </>
                )}

                <View style={styles.spacer14} />
                <View style={{ flexDirection: 'row', zIndex: 10, elevation: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                            {t('home.rideDate').toUpperCase()}
                        </Text>
                        <View style={styles.spacer6} />
                        <TouchableOpacity
                            onPress={() => {
                                const parts = date.trim().split('/');
                                if (parts.length === 3) {
                                    const m = parseInt(parts[1], 10) - 1;
                                    const y = parseInt(parts[2], 10);
                                    if (!isNaN(m) && m >= 0 && m <= 11 && !isNaN(y)) {
                                        setCalendarMonth(m);
                                        setCalendarYear(y);
                                    }
                                }
                                setShowCalendar(true);
                            }}
                            activeOpacity={0.8}
                            style={[styles.textInput, styles.datePickerButton, { backgroundColor: colors.inputFillColor, borderColor: date ? colors.primary : colors.inputBorderColor }]}>
                            <Text style={[styles.datePickerText, { color: date ? colors.textColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(34,34,96,0.35)') }]}>
                                {date || t('home.datePlaceholder')}
                            </Text>
                            <Icon name="calendar-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {isDriver && (
                        <>
                            <View style={{ width: 12 }} />
                            <View style={{ flex: 1, zIndex: 11, elevation: 11 }}>
                                <Text style={[styles.fieldLabel, { color: colors.primary }]}>
                                    {t('home.departureTime').toUpperCase()}
                                </Text>
                                <View style={styles.spacer6} />
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: departureTime ? colors.primary : colors.inputBorderColor,
                                    backgroundColor: colors.inputFillColor,
                                    height: 50,
                                    width: '100%',
                                    zIndex: 100,
                                    overflow: 'visible',
                                }}>
                                    <View style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
                                        <TextInput
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                paddingHorizontal: 12,
                                                fontSize: 15,
                                                color: colors.textColor,
                                                backgroundColor: 'transparent',
                                                borderWidth: 0,
                                                // @ts-ignore - web specific
                                                outlineWidth: 0,
                                            } as any}
                                            value={departureTime}
                                            onChangeText={handleTimeChange}
                                            placeholder="10:00"
                                            placeholderTextColor={colors.subtextColor}
                                            keyboardType="numeric"
                                            maxLength={5}
                                        />
                                    </View>
                                    <View style={{ width: 1, height: '60%', backgroundColor: colors.inputBorderColor }} />
                                    <TouchableOpacity
                                        style={{
                                            width: 60,
                                            height: '100%',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            backgroundColor: 'transparent'
                                        }}
                                        onPress={() => setShowTimePeriodDropdown(!showTimePeriodDropdown)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ color: colors.textColor, fontWeight: 'bold', fontSize: 14 }}>
                                            {timePeriod}
                                        </Text>
                                        <Icon name="chevron-down" size={14} color={colors.textColor} style={{ marginLeft: 2 }} />
                                    </TouchableOpacity>

                                    {showTimePeriodDropdown && (
                                        <View style={{
                                            position: 'absolute',
                                            top: 52,
                                            right: 0,
                                            width: 80,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            backgroundColor: colors.cardColor,
                                            borderColor: colors.borderColor,
                                            zIndex: 1000,
                                            elevation: 10,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 8,
                                            overflow: 'hidden'
                                        }}>
                                            <TouchableOpacity
                                                style={{ paddingVertical: 12, alignItems: 'center', backgroundColor: timePeriod === 'AM' ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(91,79,255,0.1)') : 'transparent' }}
                                                onPress={() => { setTimePeriod('AM'); setShowTimePeriodDropdown(false); }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textColor }}>AM</Text>
                                            </TouchableOpacity>
                                            <View style={{ height: 1, width: '100%', backgroundColor: colors.inputBorderColor }} />
                                            <TouchableOpacity
                                                style={{ paddingVertical: 12, alignItems: 'center', backgroundColor: timePeriod === 'PM' ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(91,79,255,0.1)') : 'transparent' }}
                                                onPress={() => { setTimePeriod('PM'); setShowTimePeriodDropdown(false); }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textColor }}>PM</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>


                            </View>

                        </>
                    )}
                </View>

                <View style={styles.spacer18} />

                <TouchableOpacity
                    style={[styles.findButton, { backgroundColor: colors.primary }, ((isDriver && postingRide) || (!isDriver && findingRides)) && { opacity: 0.6 }]}
                    onPress={isDriver ? handlePostRide : handleFindRides}
                    activeOpacity={0.85}
                    disabled={(isDriver && postingRide) || (!isDriver && findingRides)}>
                    {(isDriver && postingRide) || (!isDriver && findingRides) ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.findButtonText}>
                            {isDriver ? t('home.postRide') : t('home.findRides')}
                        </Text>
                    )}
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
                <TouchableOpacity onPress={fetchRecentRides} activeOpacity={0.7}>
                    <Text style={styles.errorText}>{t('home.errorRecent')} (Tap to retry)</Text>
                </TouchableOpacity>
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
                                <View style={{ width: 8 }} />
                                <Icon name="time-outline" size={14} color={colors.subtextColor} style={styles.detailIcon} />
                                <Text style={[styles.detailText, { color: colors.subtextColor }]}>{ride.departureTime || '—'}</Text>
                            </View>
                            {isDriver && ride.seatsTotal !== undefined && (
                                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: colors.subtextColor, fontWeight: '500' }}>
                                        {t('home.availableSeats')}: {Math.max(0, ride.seatsTotal - (ride.takenSeats?.length || 0))}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: isDark ? '#FF4081' : '#D81B60', fontWeight: 'bold' }}>
                                        {t('home.takenSeats')}: {ride.takenSeats?.length || 0}
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

                <TouchableOpacity
                    style={[
                        styles.whyCard,
                        {
                            backgroundColor: isDark ? colors.cardColor : '#F8F9FF',
                            borderColor: colors.borderColor,
                        },
                    ]}
                    onPress={() => {
                        // Temporary Coming Soon alert without removing internal functionality
                        // navigateToView('parcel');
                        // if (setParcelMode) setParcelMode(true);
                        notify('Coming Soon 🔒', 'Send a Parcel service will be available soon!');
                    }}
                    activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Icon name="cube-outline" size={28} color={colors.accentColor} />
                        <Icon name="lock-closed" size={20} color={colors.accentColor} />
                    </View>
                    <View style={styles.spacer8} />
                    <Text style={[styles.whyTitle, { color: colors.textColor }]}>
                        {t('login.iAmParceller')}
                    </Text>
                    <Text style={[styles.whyDesc, { color: colors.subtextColor }]}>
                        {t('login.shipGoods')}
                    </Text>
                </TouchableOpacity>
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
                                const current = new Date();
                                if (calendarYear < current.getFullYear() || (calendarYear === current.getFullYear() && calendarMonth <= current.getMonth())) {
                                    return; // Prevent navigating to past months
                                }
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
                                const current = new Date();
                                const isToday = day === current.getDate() && calendarMonth === current.getMonth() && calendarYear === current.getFullYear();
                                const isSelected = date === `${day < 10 ? '0' : ''}${day}/${calendarMonth + 1 < 10 ? '0' : ''}${calendarMonth + 1}/${calendarYear}`;
                                const isPast = new Date(calendarYear, calendarMonth, day) < new Date(current.getFullYear(), current.getMonth(), current.getDate());

                                return (
                                    <TouchableOpacity
                                        key={`day-${day}`}
                                        disabled={isPast}
                                        style={[
                                            styles.calendarDay,
                                            isToday && { backgroundColor: 'rgba(31, 175, 99, 0.15)' },
                                            isSelected && { backgroundColor: colors.primary, borderRadius: 8 },
                                            isPast && { opacity: 0.3 }
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
        // overflow: 'hidden', // Removed to prevent dropdown clipping
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
        // Redundant as gap is used
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
        flexWrap: 'wrap',
        marginTop: 8,
        rowGap: 4,
    },
    detailIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    detailText: {
        fontSize: 13,
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
    periodDropdown: {
        width: 60,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        marginLeft: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    unifiedInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        height: 50,
    },
    flexInput: {
        flex: 1,
        paddingHorizontal: 14,
        fontSize: 15,
        height: '100%',
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
    },
    verticalSeparator: {
        width: 1,
        height: '60%',
    },
    periodDropdownUnified: {
        width: 60,
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 55,
        right: 0,
        width: 60,
        borderRadius: 12,
        borderWidth: 1,
        zIndex: 1000,
        elevation: 10,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        overflow: 'hidden',
    },
    dropdownMenuWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 2000,
        elevation: 20,
        // pointerEvents: 'box-none',
    },
    dropdownItem: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    dropdownItemText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    dropdownSeparator: {
        height: 1,
        width: '100%',
    },
});

export default HomeScreen;
