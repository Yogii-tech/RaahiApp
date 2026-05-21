import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
import { useLanguage } from '../context/LanguageContext';
import JeepLayout from '../components/JeepLayout';
import { apiRequest } from '../utils/api';

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
    onOpenChat: (booking: any) => void;
}

const RequestsOverlay: React.FC<RequestsOverlayProps> = ({ onClose, onOpenChat }) => {
    const { colors, isDark } = useTheme();
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const isDriver = user?.role === 'driver';

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s for updates
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const endpoint = isDriver ? '/api/rides/requests' : '/api/rides/bookings';
            const response = await apiRequest(endpoint, {}, logout);
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
            const response = await apiRequest(`/api/rides/bookings/${bookingId}`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            }, logout);
            if (response.ok) {
                Alert.alert(t('requests.success'), t('requests.bookingStatus').replace('{{status}}', t(`requests.${status}`)));
                fetchData();
            }
        } catch (err) {
            console.error('Update error:', err);
            Alert.alert(t('common.error'), 'Could not update status.');
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
                                {t('requests.newRequestTitle')}
                            </Text>
                            <Text style={[styles.statusTag, { color: colors.primary }]}>{t(`requests.${item.status}`).toUpperCase()}</Text>
                        </View>

                        <View style={styles.details}>
                            <View style={styles.dateTimeRow}>
                                <Text style={styles.dateTimeIcon}>📅</Text>
                                <Text style={[styles.dateTimeText, { color: colors.textColor }]}>{item.ride?.date || item.date}</Text>
                                <View style={{ width: 12 }} />
                                <Text style={styles.dateTimeIcon}>🕒</Text>
                                <Text style={[styles.dateTimeText, { color: colors.textColor }]}>{item.ride?.departureTime}</Text>
                            </View>
                            <View style={{ height: 4 }} />

                            {item.type === 'parcel' ? (
                                <View style={{ marginTop: 8 }}>
                                    <Text style={[styles.detailText, { color: colors.primary, fontWeight: 'bold' }]}>📦 PARCEL DELIVERY</Text>
                                    <Text style={[styles.detailText, { color: colors.textColor }]}>Route: {item.pickup} → {item.dropoff}</Text>
                                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>Recipient: {item.recipientName} ({item.contactNumber})</Text>
                                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>Size: {item.parcelSize?.toUpperCase()}</Text>
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.detailText, { color: colors.subtextColor }]}>{t('requests.seatsTitle')}{item.seatsRequested}</Text>
                                    {item.roofCarrier && <Text style={[styles.detailText, { color: colors.subtextColor }]}>• {t('trips.needsRoofCarrier')}</Text>}
                                </>
                            )}

                            <Text style={{ fontSize: 11, color: colors.subtextColor, marginTop: 4, fontStyle: 'italic' }}>
                                {t('trips.bookedOn') || 'Booked on: '}
                                {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>

                        {/* Layout for Driver to see requested seats (Hide for parcels) */}
                        {item.type !== 'parcel' && (
                            <View style={{ marginBottom: 20 }}>
                                <JeepLayout
                                    interactive={false}
                                    takenSeats={item.status === 'accepted' ? (item.seatLayout || []) : []}
                                    pendingSeats={item.status === 'pending' ? (item.seatLayout || []) : []}
                                    numSeatsRequested={item.seatsRequested}
                                    totalSeats={item.ride?.seatsTotal}
                                    layoutType={item.ride?.seatingLayout || 'suv'}
                                />
                            </View>
                        )}

                        {item.status === 'pending' ? (
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'accepted')}>
                                    <Text style={styles.btnText}>{t('requests.accept')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#F44336' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'rejected')}>
                                    <Text style={styles.btnText}>{t('requests.reject')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: item.status === 'accepted' ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
                                    {item.status === 'accepted' ? `✓ ${t('requests.accepted').toUpperCase()}` : `✗ ${t('requests.rejected').toUpperCase()}`}
                                </Text>
                                {item.status === 'accepted' && (
                                    <TouchableOpacity
                                        style={styles.chatBtn}
                                        onPress={() => onOpenChat(item)}>
                                        <View style={styles.chatBtnContent}>
                                            <Text style={styles.chatBtnText}>💬 {t('chat.withPassenger')}</Text>
                                            {item.unreadChatCount > 0 && (
                                                <View style={styles.unreadBadge}>
                                                    <Text style={styles.unreadCount}>{item.unreadChatCount}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </>
                ) : item.status === 'accepted' ? (
                    <>
                        <View style={styles.successHeader}>
                            <View style={styles.successIconOuter}>
                                <Text style={styles.successIconInner}>✓</Text>
                            </View>
                            <Text style={[styles.successText, { color: colors.textColor }]}>
                                {item.type === 'parcel' ? (t('parcel.parcelScheduled') || 'Parcel Scheduled') : t('requests.seatReserved')}
                            </Text>
                            <View style={[styles.dateTimeRow, { marginTop: 4 }]}>
                                <Text style={styles.dateTimeIcon}>📅</Text>
                                <Text style={[styles.dateTimeText, { color: colors.textColor }]}>{item.ride?.date || item.date}</Text>
                                <View style={{ width: 12 }} />
                                <Text style={styles.dateTimeIcon}>🕒</Text>
                                <Text style={[styles.dateTimeText, { color: colors.textColor }]}>{item.ride?.departureTime}</Text>
                            </View>
                            {item.type === 'parcel' && (
                                <Text style={[styles.routeText, { color: colors.textColor, fontWeight: 'bold', marginTop: 8 }]}>
                                    {item.pickup} → {item.dropoff}
                                </Text>
                            )}
                            <Text style={[styles.successSubtitle, { color: colors.subtextColor }]}>
                                {item.type === 'parcel' ? 'Your parcel is being tracked' : t('requests.verifiedSubtitle')}
                            </Text>
                        </View>

                        <View style={[styles.bookingIdCard, { backgroundColor: isDark ? '#111822' : '#EEF2FF' }]}>
                            <View style={styles.bookingIdHeader}>
                                <Text style={[styles.bookingIdLabel, { color: isDark ? '#607D8B' : '#7986A3' }]}>
                                    {item.type === 'parcel' ? 'UNIQUE PARCEL ID' : t('trips.offlineBookingId')}
                                </Text>
                                <View style={styles.verifiedTag}>
                                    <Text style={styles.verifiedTagText}>{item.type === 'parcel' ? 'PARCEL SECURED' : t('trips.verifiedDriver')}</Text>
                                </View>
                            </View>
                            <Text style={styles.bookingIdText}>
                                {item.type === 'parcel' ? 'RA-P-' : 'RA-'}{item.id.slice(-4).toUpperCase()}
                            </Text>
                            <Text style={[styles.bookingIdFooter, { color: isDark ? '#4B5C6B' : '#8A96BB' }]}>
                                {item.type === 'parcel' ? 'Show this ID to the parcel partner' : t('trips.showDriverOffline')}
                            </Text>

                            <TouchableOpacity
                                style={[styles.chatBtn, { marginTop: 12, width: '100%' }]}
                                onPress={() => onOpenChat(item)}>
                                <View style={styles.chatBtnContent}>
                                    <Text style={styles.chatBtnText}>💬 {t('chat.withDriver')}</Text>
                                    {item.unreadChatCount > 0 && (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadCount}>{item.unreadChatCount}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <View style={styles.rejectionContainer}>
                        <View style={styles.rejectionIconOuter}>
                            <Text style={styles.rejectionIconInner}>✗</Text>
                        </View>
                        <Text style={[styles.rejectionText, { color: colors.textColor }]}>{t('requests.seatsNotBooked')}</Text>
                        <Text style={[styles.rejectionSubtitle, { color: colors.subtextColor }]}>
                            {t('requests.declinedSubtitle')}
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
                    {isDriver ? t('requests.title') : t('requests.notifications')}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('requests.closeBtn')}</Text>
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
                            {isDriver ? t('requests.emptyDriver') : t('requests.noNotifications')}
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
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
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
    empty: {
        textAlign: 'center',
        padding: 40,
        fontSize: 16,
    },
    chatBtn: {
        backgroundColor: '#4285F4',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 10,
        alignItems: 'center',
    },
    chatBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    chatBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadBadge: {
        backgroundColor: '#FF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    unreadCount: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
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
    routeText: {
        fontSize: 14,
        textAlign: 'center',
    },
});

export default RequestsOverlay;
