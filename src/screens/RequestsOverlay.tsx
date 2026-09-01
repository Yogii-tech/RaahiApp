import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, Alert, Animated, Easing
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';

interface RequestsOverlayProps {
    onClose?: () => void;
    onOpenChat: (booking: any) => void;
}

// Format a time-ago string
const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

// Is this booking within 24 hours?
const isWithin24h = (dateStr: string) => {
    return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
};

const RequestsOverlay: React.FC<RequestsOverlayProps> = ({ onClose, onOpenChat }) => {
    const { colors, isDark } = useTheme();
    const { user, logout } = useAuth();
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [systemNotifs, setSystemNotifs] = useState<any[]>([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);

    const isDriver = user?.role === 'driver';

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchSystemNotifs();
    }, []);

    const fetchSystemNotifs = async () => {
        setNotifLoading(true);
        try {
            const response = await apiRequest('/api/notifications/', {}, logout);
            if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data) ? data : [];
                setSystemNotifs(list);
                list.filter((n: any) => !n.read).forEach(async (n: any) => {
                    try { await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PUT' }, logout); } catch (_) {}
                });
            }
        } catch (err) {
            console.error('Notif fetch error:', err);
        } finally {
            setNotifLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            const endpoint = isDriver ? '/api/rides/requests' : '/api/rides/bookings';
            const response = await apiRequest(endpoint, {}, logout);
            if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data) ? data : [];
                // Filter to last 24h only
                const recent = list.filter((b: any) => isWithin24h(b.createdAt));
                recent.sort((a: any, b: any) => {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setBookings(recent);
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
                fetchData();
            }
        } catch (err) {
            Alert.alert(t('common.error'), 'Could not update status.');
        }
    };

    const handleClearAll = async () => {
        Alert.alert(
            'Clear All Notifications',
            'This will remove all your document notifications. Booking requests will still be visible for 24 hours.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        setClearing(true);
                        try {
                            await apiRequest('/api/notifications/clear', { method: 'DELETE' }, logout);
                            setSystemNotifs([]);
                        } catch (_) {}
                        setClearing(false);
                    },
                },
            ]
        );
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // ─── Driver booking card ────────────────────────────────────────────────
    const renderDriverCard = (item: any) => {
        const isExpanded = expandedId === item.id;
        const statusColor = item.status === 'accepted' ? '#00C853'
            : item.status === 'rejected' ? '#F44336' : colors.primary;
        const statusIcon = item.status === 'accepted' ? '✓'
            : item.status === 'rejected' ? '✗' : '⏳';

        const seatList = item.seatLayout && item.seatLayout.length > 0
            ? item.seatLayout.map((s: number) => `Seat ${s + 1}`).join(', ')
            : `${item.seatsRequested || 1} seat(s)`;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.85}
            >
                {/* Collapsed header — always visible */}
                <View style={styles.cardRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.textColor }]}>
                            {item.type === 'parcel' ? '📦 Parcel Request' : '🎫 Seat Request'}
                            {item.passengerName ? ` · ${item.passengerName}` : ''}
                        </Text>
                        <Text style={[styles.cardMeta, { color: colors.subtextColor }]}>
                            {item.ride?.pickup || item.pickup} → {item.ride?.dropoff || item.dropoff}
                            {'  ·  '}{timeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {statusIcon} {item.status?.toUpperCase()}
                        </Text>
                    </View>
                    <Text style={[styles.chevron, { color: colors.subtextColor }]}>
                        {isExpanded ? '▲' : '▼'}
                    </Text>
                </View>

                {/* Expanded detail */}
                {isExpanded && (
                    <View style={[styles.expanded, { borderTopColor: colors.borderColor }]}>
                        {/* Info rows */}
                        <View style={styles.infoGrid}>
                            <InfoRow icon="📅" label="Date" value={item.ride?.date || '—'} colors={colors} />
                            <InfoRow icon="🕒" label="Time" value={item.ride?.departureTime || '—'} colors={colors} />
                            {item.type !== 'parcel' && (
                                <InfoRow icon="💺" label="Seats" value={seatList} colors={colors} />
                            )}
                            {item.type === 'parcel' && (
                                <>
                                    <InfoRow icon="📏" label="Size" value={item.parcelSize?.toUpperCase() || '—'} colors={colors} />
                                    <InfoRow icon="👤" label="Recipient" value={item.recipientName || '—'} colors={colors} />
                                    <InfoRow icon="📞" label="Contact" value={item.contactNumber || '—'} colors={colors} />
                                </>
                            )}
                            {item.roofCarrier && <InfoRow icon="🎒" label="Roof Carrier" value="Required" colors={colors} />}
                            <InfoRow icon="🚗" label="Vehicle" value={item.ride?.vehicleModel || '—'} colors={colors} />
                        </View>

                        {/* Action buttons */}
                        {item.status === 'pending' ? (
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#00C853' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'accepted')}>
                                    <Text style={styles.btnText}>✓ Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#F44336' }]}
                                    onPress={() => handleUpdateStatus(item.id, 'rejected')}>
                                    <Text style={styles.btnText}>✗ Reject</Text>
                                </TouchableOpacity>
                            </View>
                        ) : item.status === 'accepted' && (
                            <TouchableOpacity
                                style={[styles.chatBtn, { backgroundColor: colors.primary }]}
                                onPress={() => { onOpenChat(item); }}>
                                <Text style={styles.chatBtnText}>💬 Chat with Passenger</Text>
                                {item.unreadChatCount > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadCount}>{item.unreadChatCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // ─── Passenger booking card ─────────────────────────────────────────────
    const renderPassengerCard = (item: any) => {
        const isExpanded = expandedId === item.id;
        const isAccepted = item.status === 'accepted';
        const isRejected = item.status === 'rejected';
        const statusColor = isAccepted ? '#00C853' : isRejected ? '#F44336' : colors.primary;
        const statusIcon = isAccepted ? '✓' : isRejected ? '✗' : '⏳';

        const seatList = item.seatLayout && item.seatLayout.length > 0
            ? item.seatLayout.map((s: number) => `Seat ${s + 1}`).join(', ')
            : `${item.seatsRequested || 1} seat(s)`;

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.cardColor,
                        borderColor: isAccepted ? '#00C85322' : isRejected ? '#F4433622' : colors.borderColor,
                        borderLeftWidth: 4,
                        borderLeftColor: statusColor,
                    }
                ]}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.85}
            >
                {/* Collapsed header */}
                <View style={styles.cardRow}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>
                        {isAccepted ? '✅' : isRejected ? '❌' : '⏳'}
                    </Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.textColor }]}>
                            {isAccepted
                                ? (item.type === 'parcel' ? 'Parcel Scheduled' : 'Seat Confirmed!')
                                : isRejected
                                    ? 'Booking Declined'
                                    : 'Booking Pending'}
                        </Text>
                        <Text style={[styles.cardMeta, { color: colors.subtextColor }]}>
                            {item.ride?.pickup || item.pickup} → {item.ride?.dropoff || item.dropoff}
                            {'  ·  '}{timeAgo(item.createdAt)}
                        </Text>
                    </View>
                    <Text style={[styles.chevron, { color: colors.subtextColor }]}>
                        {isExpanded ? '▲' : '▼'}
                    </Text>
                </View>

                {/* Expanded detail */}
                {isExpanded && (
                    <View style={[styles.expanded, { borderTopColor: colors.borderColor }]}>
                        {isAccepted && (
                            <View style={[styles.bookingIdRow, { backgroundColor: isDark ? '#0D1F2D' : '#EEF7FF' }]}>
                                <Text style={[styles.bookingIdLabel, { color: colors.subtextColor }]}>BOOKING ID</Text>
                                <Text style={[styles.bookingIdValue, { color: '#00C853' }]}>
                                    {item.type === 'parcel' ? 'RA-P-' : 'RA-'}{item.id?.slice(-4).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        <View style={styles.infoGrid}>
                            <InfoRow icon="📅" label="Date" value={item.ride?.date || '—'} colors={colors} />
                            <InfoRow icon="🕒" label="Departure" value={item.ride?.departureTime || '—'} colors={colors} />
                            <InfoRow icon="🚗" label="Driver" value={item.ride?.driverName || '—'} colors={colors} />
                            <InfoRow icon="🚙" label="Vehicle" value={item.ride?.vehicleModel || '—'} colors={colors} />
                            {item.type !== 'parcel' && (
                                <InfoRow icon="💺" label="Your Seats" value={seatList} colors={colors} />
                            )}
                            {item.type === 'parcel' && (
                                <InfoRow icon="📦" label="Parcel Size" value={item.parcelSize?.toUpperCase() || '—'} colors={colors} />
                            )}
                            {item.roofCarrier && <InfoRow icon="🎒" label="Roof Carrier" value="Requested" colors={colors} />}
                        </View>

                        {isAccepted && (
                            <TouchableOpacity
                                style={[styles.chatBtn, { backgroundColor: colors.primary }]}
                                onPress={() => { onOpenChat(item); }}>
                                <Text style={styles.chatBtnText}>💬 Chat with Driver</Text>
                                {item.unreadChatCount > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadCount}>{item.unreadChatCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}

                        {isRejected && (
                            <View style={[styles.rejectedNote, { backgroundColor: isDark ? 'rgba(244,67,54,0.08)' : 'rgba(244,67,54,0.06)' }]}>
                                <Text style={{ color: '#F44336', fontSize: 13, lineHeight: 19 }}>
                                    Your booking was not accepted by the driver. Please try searching for another ride.
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        if (!isDriver && item.status === 'pending') return null;
        return isDriver ? renderDriverCard(item) : renderPassengerCard(item);
    };

    const hasAnyNotifs = systemNotifs.length > 0 || bookings.length > 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.textColor }]}>
                        {isDriver ? t('requests.title') : t('requests.notifications')}
                    </Text>
                    <Text style={[styles.headerSub, { color: colors.subtextColor }]}>Last 24 hours · Tap to expand</Text>
                </View>
                <View style={styles.headerRight}>
                    {hasAnyNotifs && (
                        <TouchableOpacity
                            style={[styles.clearBtn, { borderColor: colors.borderColor }]}
                            onPress={handleClearAll}
                            disabled={clearing}
                        >
                            {clearing
                                ? <ActivityIndicator size="small" color={colors.primary} />
                                : <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '700' }}>🗑 Clear</Text>
                            }
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={{ color: colors.primary, fontWeight: 'bold' }}>✕ Close</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* System notifications */}
            {systemNotifs.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.sectionLabel, { color: colors.subtextColor }]}>
                        {isDriver ? '📋 DOCUMENT STATUS' : '📋 SYSTEM NOTIFICATIONS'}
                    </Text>
                    {notifLoading
                        ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
                        : systemNotifs.map((notif: any) => {
                            const isApproved = notif.title?.toLowerCase().includes('approved');
                            const isRejectedNotif = notif.title?.toLowerCase().includes('rejected');
                            const accent = isApproved ? '#00BFA5' : isRejectedNotif ? '#F44336' : colors.primary;
                            const isExpanded = expandedId === `notif_${notif.id}`;
                            return (
                                <TouchableOpacity
                                    key={notif.id}
                                    style={[styles.notifCard, {
                                        backgroundColor: colors.cardColor,
                                        borderLeftColor: accent,
                                    }]}
                                    onPress={() => toggleExpand(`notif_${notif.id}`)}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.cardRow}>
                                        <Text style={{ fontSize: 22, marginRight: 10 }}>
                                            {isApproved ? '✅' : isRejectedNotif ? '❌' : '🔔'}
                                        </Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.notifTitle, { color: accent }]}>{notif.title}</Text>
                                            <Text style={[styles.cardMeta, { color: colors.subtextColor }]}>
                                                {timeAgo(notif.createdAt)}
                                                {!notif.read && <Text style={{ color: accent }}> · NEW</Text>}
                                            </Text>
                                        </View>
                                        <Text style={[styles.chevron, { color: colors.subtextColor }]}>
                                            {isExpanded ? '▲' : '▼'}
                                        </Text>
                                    </View>
                                    {isExpanded && (
                                        <View style={[styles.expanded, { borderTopColor: colors.borderColor }]}>
                                            <Text style={[styles.notifMessage, { color: colors.textColor }]}>
                                                {notif.message}
                                            </Text>
                                            <Text style={[styles.cardMeta, { color: colors.subtextColor, marginTop: 4 }]}>
                                                {new Date(notif.createdAt).toLocaleString()}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    }
                    <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
                </View>
            )}

            {/* Booking requests */}
            {loading ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={bookings.filter(b => isDriver || b.status !== 'pending')}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
                            <Text style={[styles.empty, { color: colors.subtextColor }]}>
                                {isDriver ? t('requests.emptyDriver') : 'No recent notifications\nin the last 24 hours'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

// ─── Shared InfoRow component ────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, colors }: { icon: string, label: string, value: string, colors: any }) => (
    <View style={infoRowStyle.row}>
        <Text style={infoRowStyle.icon}>{icon}</Text>
        <Text style={[infoRowStyle.label, { color: colors.subtextColor }]}>{label}</Text>
        <Text style={[infoRowStyle.value, { color: colors.textColor }]}>{value}</Text>
    </View>
);

const infoRowStyle = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    icon: { fontSize: 14, marginRight: 8, width: 20 },
    label: { fontSize: 12, fontWeight: '600', width: 80 },
    value: { fontSize: 13, fontWeight: '500', flex: 1 },
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 16,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    title: { fontSize: 22, fontWeight: 'bold' },
    headerSub: { fontSize: 11, marginTop: 2, opacity: 0.7 },
    clearBtn: {
        borderWidth: 1, borderRadius: 8, paddingHorizontal: 10,
        paddingVertical: 5, flexDirection: 'row', alignItems: 'center',
    },
    closeBtn: { padding: 6 },
    list: { paddingBottom: 24 },
    sectionLabel: {
        fontSize: 10, fontWeight: '800', letterSpacing: 1,
        marginBottom: 8, textTransform: 'uppercase',
    },
    divider: { height: 1, marginVertical: 12 },
    // Cards
    card: {
        borderRadius: 14, borderWidth: 1, marginBottom: 12,
        overflow: 'hidden',
    },
    cardRow: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 8,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
    cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    cardMeta: { fontSize: 11, lineHeight: 15 },
    statusBadge: {
        borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    },
    statusBadgeText: { fontSize: 10, fontWeight: '800' },
    chevron: { fontSize: 10, marginLeft: 4, fontWeight: 'bold' },
    // Expanded panel
    expanded: {
        borderTopWidth: 1, padding: 14, paddingTop: 12,
    },
    infoGrid: { marginBottom: 12 },
    bookingIdRow: {
        borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center',
    },
    bookingIdLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
    bookingIdValue: {
        fontSize: 28, fontWeight: '900', letterSpacing: 3, marginTop: 4,
    },
    rejectedNote: {
        borderRadius: 10, padding: 12, marginTop: 4,
    },
    // Actions
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    actionBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        alignItems: 'center',
    },
    btnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    chatBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
        marginTop: 4, gap: 8,
    },
    chatBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    unreadBadge: {
        backgroundColor: '#FF4444', borderRadius: 10, minWidth: 20, height: 20,
        paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#FFF',
    },
    unreadCount: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    // Notif card
    notifCard: {
        borderRadius: 12, borderLeftWidth: 4, borderWidth: 1,
        marginBottom: 8, overflow: 'hidden',
    },
    notifTitle: { fontSize: 14, fontWeight: '700', marginBottom: 1 },
    notifMessage: { fontSize: 13, lineHeight: 20 },
    // Empty
    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
    empty: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default RequestsOverlay;
