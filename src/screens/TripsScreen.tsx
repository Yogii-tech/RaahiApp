import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, AppState, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../apiConfig';
import { useLanguage } from '../context/LanguageContext';
import JeepLayout from '../components/JeepLayout';
import SlideToComplete from '../components/SlideToComplete';

import { apiRequest } from '../utils/api';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../utils/json';
import { notify } from '../utils/notify';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPackageView from '../components/TrackPackageView';
import { startDriverTracking } from '../modern_map/services/socket';

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

// Hardcoded coordinates for villages missing from OSM/Nominatim
const KNOWN_LOCATIONS: Record<string, { lat: string; lon: string }> = {
    reema: { lat: '29.833', lon: '79.800' },
    rima: { lat: '29.833', lon: '79.800' },
};

const geocodeLocation = async (name: string, signal?: AbortSignal): Promise<{ lat: string; lon: string } | null> => {
    const key = name.toLowerCase().trim();
    if (KNOWN_LOCATIONS[key]) return KNOWN_LOCATIONS[key];
    const query = `${name}, Uttarakhand, India`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { signal });
    if (!res.ok) return null;
    const data = await parseJsonSafe<any[]>(res);
    if (!data || data.length === 0) return null;
    return { lat: data[0].lat, lon: data[0].lon };
};

const DistanceDisplay = ({ pickup, dropoff, color }: { pickup?: string, dropoff?: string, color: string }) => {
    const [info, setInfo] = useState<string>('...');
    useEffect(() => {
        if (!pickup || !dropoff) return;
        let mounted = true;
        const abort = createRequestAbort(8000);
        const fetchDist = async () => {
            try {
                const pCoords = await geocodeLocation(pickup, abort.signal);
                if (!pCoords || !mounted || abort.signal.aborted) return;
                const dCoords = await geocodeLocation(dropoff, abort.signal);
                if (!dCoords || !mounted || abort.signal.aborted) return;

                const url = `https://router.project-osrm.org/route/v1/driving/${pCoords.lon},${pCoords.lat};${dCoords.lon},${dCoords.lat}?overview=false`;
                const rRes = await fetch(url, { signal: abort.signal });
                if (!rRes.ok) return;
                const rData = await parseJsonSafe(rRes);

                if (rData?.routes && rData.routes.length > 0 && mounted) {
                    const km = Math.round(rData.routes[0].distance / 1000);
                    const hrs = Math.round(rData.routes[0].duration / 3600);
                    setInfo(`${km} KM · ${hrs}h`);
                }
            } catch (e) {
                // Ignore geocoding / routing network error quietly
            } finally {
                abort.cleanup();
            }
        };
        fetchDist();
        return () => {
            mounted = false;
            abort.cleanup();
            abort.controller.abort();
        };
    }, [pickup, dropoff]);

    return <Text style={{ fontSize: 8, color: color, marginBottom: 2 }}>{info}</Text>;
};

interface TripsScreenProps {
    isParcelMode?: boolean;
    isParcelHistory?: boolean;
    isRideHistory?: boolean;
    title?: string;
    onOpenChat?: (booking: any) => void;
}

const TripsScreen: React.FC<TripsScreenProps> = ({ isParcelMode, isParcelHistory, isRideHistory, title, onOpenChat }) => {

    const { colors, isDark } = useTheme();
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const isFocused = useIsFocused();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRideId, setExpandedRideId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'detailed'>('detailed');
    const [startingRideId, setStartingRideId] = useState<string | null>(null);
    const startingRideRef = useRef<string | null>(null);
    const completingRideRef = useRef<Set<string>>(new Set());
    const togglingSeatRef = useRef<Set<string>>(new Set());
    const fetchSeqRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            abortRef.current?.abort();
        };
    }, []);
    const [isAppActive, setIsAppActive] = useState<boolean>(() => {
        if (Platform.OS === 'web') {
            return typeof document === 'undefined' || document.visibilityState === 'visible';
        }
        return AppState.currentState === 'active';
    });

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return;
            const handleVisibility = () => {
                setIsAppActive(document.visibilityState === 'visible');
            };
            document.addEventListener('visibilitychange', handleVisibility);
            return () => document.removeEventListener('visibilitychange', handleVisibility);
        }
        const sub = AppState.addEventListener('change', (nextState) => {
            setIsAppActive(nextState === 'active');
        });
        return () => sub?.remove?.();
    }, []);

    const isDriver = user?.role === 'driver';

    const fetchData = React.useCallback(async () => {
        abortRef.current?.abort();
        const abort = createRequestAbort(12000);
        abortRef.current = abort.controller;
        const seq = ++fetchSeqRef.current;

        try {
            const endpoint = isDriver ? '/api/rides/recent?role=driver&limit=100' : '/api/rides/bookings';
            const response = await apiRequest(endpoint, { signal: abort.signal }, logout);
            if (!isMountedRef.current || seq !== fetchSeqRef.current || abort.signal.aborted) return;
            if (response.ok) {
                let data = (await parseJsonSafe<any[]>(response)) || [];
                if (!isMountedRef.current || seq !== fetchSeqRef.current || abort.signal.aborted) return;

                // If this is the "History" tab in parcel mode, filter for parcels only
                if (isParcelHistory) {
                    data = data.filter((b: any) => b.type === 'parcel' || b.ride?.type === 'parcel');
                }
                // If this is the ride history tab (non-parcel), show completed/cancelled rides/bookings
                else if (isRideHistory) {
                    if (isDriver) {
                        // Driver: show completed or cancelled rides (non-parcel)
                        data = data.filter((b: any) => b.type !== 'parcel' && (b.status === 'completed' || b.status === 'cancelled'));
                    } else {
                        // Passenger: show completed or cancelled bookings (non-parcel)
                        data = data.filter((b: any) =>
                            b.type !== 'parcel' && 
                            b.ride?.type !== 'parcel' && 
                            (b.status === 'completed' || b.status === 'rejected' || b.status === 'cancelled' || b.ride?.status === 'completed' || b.ride?.status === 'cancelled')
                        );
                    }
                }
                // Regular active Trips view: show available/pending/ongoing ones
                else {
                    if (isDriver) {
                        // Driver: show active/available/ongoing rides (non-parcel)
                        data = data.filter((b: any) => b.type !== 'parcel' && (b.status === 'available' || b.status === 'ongoing'));
                    } else {
                        // Passenger: show pending or accepted bookings where the ride itself is still available or ongoing
                        data = data.filter((b: any) =>
                            b.type !== 'parcel' &&
                            b.ride?.type !== 'parcel' &&
                            (b.status === 'pending' || b.status === 'accepted') &&
                            (b.ride?.status === 'available' || b.ride?.status === 'ongoing')
                        );
                    }
                }

                setBookings(data);
                setError(null);
            } else {
                const errData = await parseJsonSafe(response);
                if (isMountedRef.current && seq === fetchSeqRef.current) {
                    setError(getApiErrorMessage(errData, 'Failed to load trips.', response));
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || abort.signal.aborted) {
                if (abort.didTimeout() && isMountedRef.current && seq === fetchSeqRef.current) {
                    setError('Connection timed out while loading trips.');
                }
                return;
            }
            console.error('Fetch error:', err);
            if (isMountedRef.current && seq === fetchSeqRef.current) {
                setError('Could not load trips. Please check your connection.');
            }
        } finally {
            abort.cleanup();
            if (isMountedRef.current && seq === fetchSeqRef.current && (!abort.signal.aborted || abort.didTimeout())) {
                setLoading(false);
            }
        }
    }, [isDriver, isParcelHistory, isRideHistory, logout]);

    useEffect(() => {
        if (isParcelMode || !isFocused || !isAppActive) {
            abortRef.current?.abort();
            return;
        }
        fetchData();
        const interval = setInterval(() => {
            if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            if (Platform.OS !== 'web' && AppState.currentState !== 'active') return;
            fetchData();
        }, 5000); // Poll only when tab is focused and app is foregrounded
        return () => {
            clearInterval(interval);
            abortRef.current?.abort();
        };
    }, [fetchData, isFocused, isAppActive, isParcelMode]);

    // For driver, auto-expand if there's only one active ride and in detailed mode
    useEffect(() => {
        if (isDriver && bookings && bookings.length === 1 && !expandedRideId && viewMode === 'detailed') {
            setExpandedRideId(bookings[0].id);
        }
    }, [isDriver, bookings, expandedRideId, viewMode]);

    // Start GPS tracking for driver (depend on active ride ID, not bookings array reference)
    const activeTrackedRide = isDriver
        ? (bookings.find(b => b.status === 'ongoing') || bookings.find(b => b.status === 'available'))
        : undefined;
    const activeTrackedRideId = activeTrackedRide?.id || null;

    useEffect(() => {
        if (isDriver && user?.id && activeTrackedRideId) {
            const stopTracking = startDriverTracking(activeTrackedRideId, user.id);
            return () => stopTracking();
        }
    }, [isDriver, activeTrackedRideId, user?.id]);

    const handleCompleteTrip = async (rideId: string): Promise<boolean> => {
        if (completingRideRef.current.has(rideId)) return false;
        completingRideRef.current.add(rideId);
        try {
            const response = await apiRequest(`/api/rides/${rideId}/complete`, {
                method: 'PUT',
            }, logout);
            if (response.ok) {
                const msg = t('trips.tripCompleted') || 'Trip marked successfully';
                notify(t('common.success') || 'Success', msg);
                fetchData();
                return true;
            } else {
                const data = await parseJsonSafe(response);
                const errorMsg = getApiErrorMessage(data, 'Failed to complete trip', response);
                notify(t('common.error') || 'Error', errorMsg);
                return false;
            }
        } catch (err) {
            console.error('Error completing trip:', err);
            notify(t('common.error') || 'Error', 'Failed to complete trip. Please try again.');
            return false;
        } finally {
            completingRideRef.current.delete(rideId);
        }
    };

    const handleStartTrip = async (rideId: string) => {
        if (startingRideRef.current === rideId) return;
        startingRideRef.current = rideId;
        setStartingRideId(rideId);
        try {
            const response = await apiRequest(`/api/rides/${rideId}/start`, {
                method: 'PUT',
            }, logout);
            if (response.ok) {
                const msg = t('trips.tripStarted') || 'Trip started successfully';
                notify(t('common.success') || 'Success', msg);
                fetchData();
            } else {
                const data = await parseJsonSafe(response);
                const errorMsg = getApiErrorMessage(data, 'Failed to start trip', response);
                notify(t('common.error') || 'Error', errorMsg);
            }
        } catch (err) {
            console.error('Error starting trip:', err);
            notify(t('common.error') || 'Error', 'Failed to start trip. Please try again.');
        } finally {
            startingRideRef.current = null;
            if (isMountedRef.current) {
                setStartingRideId(prev => (prev === rideId ? null : prev));
            }
        }
    };

    const handleToggleBlockSeat = async (rideId: string, seatIndex: number) => {
        const key = `${rideId}:${seatIndex}`;
        if (togglingSeatRef.current.has(key)) return;
        togglingSeatRef.current.add(key);
        try {
            const response = await apiRequest(`/api/rides/${rideId}/block-seat`, {
                method: 'POST',
                body: JSON.stringify({ seatIndex }),
            }, logout);

            if (response.ok) {
                fetchData(); // Refresh to show new state
            } else {
                const data = await parseJsonSafe(response);
                notify(t('common.error'), getApiErrorMessage(data, 'Failed to toggle seat', response));
            }
        } catch (err) {
            console.error('Toggle block error:', err);
            notify(t('common.error'), 'Could not update seat availability. Please try again.');
        } finally {
            togglingSeatRef.current.delete(key);
        }
    };

    const renderRequestItem = ({ item }: { item: any }) => {
        const isExpanded = expandedRideId === item.id;
        const isParcel = item.type === 'parcel';
        const isCompleted = item.status === 'completed';
        const isCancelled = item.status === 'cancelled';
        const isTerminal = isCompleted || isCancelled;
        const cardBgColor = isTerminal ? (isDark ? '#1C2939' : '#F5F5F5') : colors.cardColor;
        const cardOpacity = isTerminal ? 0.7 : 1;

        const rawCompletedAt = item.completedAt || item.ride?.completedAt;
        let finishedTimeStr = '';
        if (rawCompletedAt) {
            try {
                const compDate = new Date(rawCompletedAt);
                if (!isNaN(compDate.getTime())) {
                    finishedTimeStr = compDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                }
            } catch (_) {}
        }

        return (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor: colors.borderColor, opacity: cardOpacity }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        {item.bookingId ? (
                            <View style={{ backgroundColor: 'rgba(0,191,165,0.15)', borderWidth: 1, borderColor: '#00BFA5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ color: '#00BFA5', fontSize: 11, fontWeight: 'bold' }}>{item.bookingId}</Text>
                            </View>
                        ) : null}
                        <Text style={[styles.requestTitle, { color: colors.textColor }]}>
                            {isParcel
                                ? `Parcel to ${item.ride?.dropoff || item.dropoff || 'Recipient'}`
                                : (isDriver ? `${t('trips.rideTo')} ${item.dropoff}` : `${t('trips.bookingFor')} ${item.ride?.vehicleModel || 'SUV'}`)}
                        </Text>
                    </View>
                    <Text style={[styles.statusTag, { color: isCompleted ? '#4CAF50' : (isCancelled ? '#9E9E9E' : colors.primary), backgroundColor: isCompleted ? 'rgba(76, 175, 80, 0.1)' : (isCancelled ? 'rgba(158, 158, 158, 0.14)' : 'rgba(91, 79, 255, 0.1)') }]}>
                        {isCompleted ? 'COMPLETED' : (isCancelled ? 'CANCELLED' : t(`requests.${item.status || 'pending'}`).toUpperCase())}
                    </Text>
                </View>

                <View style={styles.details}>
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {t('book.pickup')}: {isDriver ? item.pickup : item.ride?.pickup}
                    </Text>
                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                        {t('book.dropoff') || 'Dropoff'}: {isDriver ? item.dropoff : item.ride?.dropoff}
                    </Text>

                    <View style={styles.dateTimeRow}>
                        <Icon name="calendar-outline" size={14} color={colors.textColor} style={styles.dateTimeIcon} />
                        <Text style={[styles.dateTimeText, { color: colors.textColor }]}>
                            {isDriver ? item.date : item.ride?.date}
                        </Text>
                        <View style={{ width: 12 }} />
                        <Icon name="time-outline" size={14} color={colors.textColor} style={styles.dateTimeIcon} />
                        <Text style={[styles.dateTimeText, { color: colors.textColor }]}>
                            Start: {isDriver ? item.departureTime : item.ride?.departureTime}
                        </Text>
                        {isCompleted && (
                            <>
                                <View style={{ width: 12 }} />
                                <Icon name="checkmark-done-circle-outline" size={14} color="#4CAF50" style={styles.dateTimeIcon} />
                                <Text style={[styles.dateTimeText, { color: '#4CAF50', fontWeight: 'bold' }]}>
                                    Finished: {finishedTimeStr || 'Completed'}
                                </Text>
                            </>
                        )}
                    </View>

                    {isParcel ? (
                        <>
                            <View style={{ height: 8 }} />
                            <Text style={[styles.detailText, { color: colors.textColor, fontWeight: 'bold' }]}>
                                Recipient: {item.recipientName || 'N/A'}
                            </Text>
                            <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                                Size: {item.parcelSize || 'Standard'}
                            </Text>
                        </>
                    ) : (
                        <Text style={[styles.detailText, { color: colors.subtextColor }]}>
                            {isDriver ? `${t('trips.seatsBooked')}: ${item.takenSeats?.length || 0} / ${item.seatsTotal}` : `${t('trips.seatsRequested')}: ${item.seatsRequested}`}
                        </Text>
                    )}
                    {item.roofCarrier && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• {t('trips.needsRoofCarrier')}</Text>}
                </View>

                {isDriver && viewMode === 'list' && (
                    <TouchableOpacity
                        style={[styles.viewLayoutBtn, { borderColor: colors.primary, marginTop: 10 }]}
                        onPress={() => setExpandedRideId(isExpanded ? null : item.id)}>
                        <Text style={[styles.viewLayoutText, { color: colors.primary }]}>
                            {isExpanded ? (t('trips.hideSeating') || 'Hide Seating & Actions ▴') : (t('trips.viewSeating') || 'View Seating & Actions ▾')}
                        </Text>
                    </TouchableOpacity>
                )}

                 {/* For Passengers - Expandable in List Mode or always open in Detailed Mode */}
                {!isDriver && !isParcel && !isParcelHistory && (
                    <View style={{ marginTop: 10 }}>
                        {viewMode === 'list' && (
                            <TouchableOpacity
                                style={[styles.viewLayoutBtn, { borderColor: colors.primary, marginTop: 4 }]}
                                onPress={() => setExpandedRideId(isExpanded ? null : item.id)}>
                                <Text style={[styles.viewLayoutText, { color: colors.primary }]}>
                                    {isExpanded ? 'Hide Ticket & Seating ▴' : 'View Ticket & Seating ▾'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {(viewMode === 'detailed' || isExpanded) && (
                            <View style={{ marginTop: viewMode === 'list' ? 14 : 0 }}>
                                {item.ride?.status === 'ongoing' && (
                                    <View style={{
                                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                        borderColor: '#4CAF50',
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        padding: 12,
                                        marginBottom: 15,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <Icon name="car-outline" size={20} color="#4CAF50" style={{ marginRight: 10 }} />
                                        <Text style={{ color: '#4CAF50', fontSize: 13, fontWeight: 'bold', flex: 1 }}>
                                            {t('trips.driverMoving') || 'Driver started moving to destination!'}
                                        </Text>
                                    </View>
                                )}
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
                                                        {rawCompletedAt ? new Date(rawCompletedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={{ color: colors.subtextColor, fontSize: 10, fontWeight: 'bold' }}>FINISHED TIME</Text>
                                                    <Text style={{ color: colors.textColor, fontSize: 12, marginTop: 2 }}>
                                                        {finishedTimeStr || (rawCompletedAt ? new Date(rawCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}
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
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>BOOKED ON</Text>
                                                        <Text style={{ color: ticketText, fontSize: 11, marginTop: 2 }}>{new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                                    </View>
                                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                                        <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold', textAlign: 'right' }}>JOURNEY INFO</Text>
                                                        <Text style={{ color: ticketText, fontSize: 11, marginTop: 2, textAlign: 'right' }}>{item.ride?.date} at {item.ride?.departureTime}</Text>
                                                    </View>
                                                </View>

                                                {/* Row 3: Places and Arrow */}
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                                                    <View style={{ flex: 1.2 }}>
                                                        <Text style={{ color: ticketLabel, fontSize: 9, fontWeight: 'bold' }}>FROM</Text>
                                                        <Text style={{ color: ticketText, fontSize: 13, marginTop: 2, fontWeight: '500' }} numberOfLines={1}>{item.ride?.pickup}</Text>
                                                    </View>
                                                    <View style={{ flex: 0.6, alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ color: '#4CAF50', fontSize: 16 }}>➔</Text>
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
                    </View>
                )}

                {isDriver && (viewMode === 'detailed' || isExpanded) && (
                    <View style={{ marginTop: 20 }}>
                        <JeepLayout
                            interactive={!isTerminal && item.status === 'available'}
                            onSeatDoublePress={(seatIdx) => {
                                if (!isTerminal && item.status === 'available') {
                                    handleToggleBlockSeat(item.id, seatIdx);
                                }
                            }}
                            takenSeats={item.takenSeats || []}
                            manualBlockedSeats={item.manualBlockedSeats || []}
                            completedSeats={item.completedSeats || []}
                            pendingSeats={item.pendingSeats || []}
                            totalSeats={item.seatsTotal}
                            layoutType={item.seatingLayout || 'suv'}
                            isCompleted={isCompleted}
                            dropoff={item.dropoff}
                            completedAt={item.completedAt}
                            date={item.date}
                        />

                        {/* Tip for Driver */}
                        {!isTerminal && item.status === 'available' && (
                            <Text style={{ color: colors.subtextColor, fontSize: 10, textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
                                Tip: Double tap a free seat to block it for offline passengers
                            </Text>
                        )}

                        {/* List of active bookings for completion */}
                        {!isTerminal && item.bookings && item.bookings.length > 0 && (
                            <View style={{ marginTop: 20 }}>
                                {(() => {
                                    const hasParcels = item.bookings.some((b: any) => b.type === 'parcel');
                                    const hasPassengers = item.bookings.some((b: any) => b.type === 'seat' || b.type === 'passenger' || !b.type);
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
                                                    {isParcel ? `Size: ${booking.parcelSize || 'Standard'}` : `Seats: ${booking.seatsRequested || (booking.seatLayout ? booking.seatLayout.length : 0)}`}
                                                </Text>
                                            </View>
                                            {booking.status === 'accepted' ? (
                                                <View style={{ backgroundColor: 'rgba(91, 79, 255, 0.12)', borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>CONFIRMED</Text>
                                                </View>
                                            ) : booking.status === 'pending' ? (
                                                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                                    <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: 'bold' }}>PENDING</Text>
                                                </View>
                                            ) : booking.status === 'rejected' ? (
                                                <View style={{ backgroundColor: 'rgba(244, 67, 54, 0.12)', borderWidth: 1, borderColor: '#F44336', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                                    <Text style={{ color: '#F44336', fontSize: 10, fontWeight: 'bold' }}>REJECTED</Text>
                                                </View>
                                            ) : booking.status === 'cancelled' ? (
                                                <View style={{ backgroundColor: 'rgba(158, 158, 158, 0.12)', borderWidth: 1, borderColor: '#9E9E9E', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}>
                                                    <Text style={{ color: '#9E9E9E', fontSize: 10, fontWeight: 'bold' }}>CANCELLED</Text>
                                                </View>
                                            ) : booking.status === 'completed' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                                                    <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>FINISHED</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })}
                                <Text style={{ color: colors.subtextColor, fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                                    Slide "Finish the ride" below when the trip ends to complete all active bookings.
                                </Text>
                            </View>
                        )}

                        {!isTerminal && (
                            <View style={{ marginTop: 20 }}>
                                {item.status !== 'ongoing' && (
                                    <TouchableOpacity
                                        onPress={() => handleStartTrip(item.id)}
                                        disabled={startingRideId === item.id}
                                        style={{
                                            backgroundColor: '#4CAF50',
                                            opacity: startingRideId === item.id ? 0.65 : 1,
                                            paddingVertical: 8,
                                            paddingHorizontal: 20,
                                            borderRadius: 8,
                                            alignSelf: 'center',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 15,
                                            shadowColor: '#4CAF50',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 3,
                                            elevation: 2,
                                        }}
                                    >
                                        {startingRideId === item.id ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <>
                                                <Icon name="play-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                                                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>
                                                    {(t('trips.startRide') || 'Start Ride').toUpperCase()}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={[styles.title, { color: colors.textColor, marginBottom: 0 }]}>
                    {title || (isDriver ? t('trips.myRides') : t('trips.myBookings'))}
                </Text>

                <View style={{
                    flexDirection: 'row',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 10,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: colors.borderColor
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            setViewMode('list');
                            setExpandedRideId(null);
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: viewMode === 'list' ? colors.primary : 'transparent',
                        }}>
                        <Icon name="list-outline" size={14} color={viewMode === 'list' ? '#FFF' : colors.subtextColor} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: viewMode === 'list' ? '#FFF' : colors.subtextColor }}>
                            List
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            setViewMode('detailed');
                            setExpandedRideId(null);
                        }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: viewMode === 'detailed' ? colors.primary : 'transparent',
                        }}>
                        <Icon name="grid-outline" size={14} color={viewMode === 'detailed' ? '#FFF' : colors.subtextColor} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: viewMode === 'detailed' ? '#FFF' : colors.subtextColor }}>
                            Detailed
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />
            ) : error && bookings.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 16 }}>
                    <Text style={{ color: '#F44336', fontSize: 15, textAlign: 'center', marginBottom: 14 }}>
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={() => {
                            setLoading(true);
                            fetchData();
                        }}
                        style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 }}
                    >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {error ? (
                        <TouchableOpacity
                            onPress={() => fetchData()}
                            style={{ backgroundColor: 'rgba(244, 67, 54, 0.12)', borderRadius: 8, padding: 10, marginBottom: 12 }}
                        >
                            <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                                ⚠️ {error} Tap to retry.
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <FlatList
                        data={bookings}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRequestItem}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={[styles.empty, { color: colors.subtextColor }]}>
                                {isParcelHistory || isRideHistory || title === t('tab.history') ? t('trips.noHistory') : (isDriver ? t('trips.noPublished') : t('trips.noTrips'))}
                            </Text>
                        }
                    />
                </View>
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
