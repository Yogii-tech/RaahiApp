import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, TextInput, Modal, Image, Alert
} from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';

interface Booking {
    id: string;
    bookingId?: string;
    passengerName: string;
    passengerPhone?: string;
    status: string;
    driverName: string;
    ride: string;
    seats?: number;
    createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: '#1FAF63',
    ACCEPTED: '#1FAF63',
    ASSIGNED: '#3B82F6',
    PENDING: '#F59E0B',
    COMPLETED: '#8B5CF6',
    CANCELLED: '#EF4444',
    REJECTED: '#EF4444',
    'ON TRIP': '#3B82F6',
};

export default function AdminBookingsView({ token, searchQuery = '' }: { token: string; searchQuery?: string }) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [bidSearchInput, setBidSearchInput] = useState('');
    const [selectedBookingDetails, setSelectedBookingDetails] = useState<any | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);

    const { fetchWithAuth } = useAuth();

    useEffect(() => {
        loadBookings();
    }, []);

    const loadBookings = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/api/admin/bookings`);
            const d = await res.json();
            setBookings(Array.isArray(d) ? d : []);
        } catch {
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchBookingDetails = async (queryVal: string) => {
        if (!queryVal.trim()) return;
        setFetchingDetails(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/api/admin/bookings/detail?bid=${encodeURIComponent(queryVal.trim())}`);
            const data = await res.json();
            if (res.ok) {
                setSelectedBookingDetails(data);
                setDetailModalVisible(true);
            } else {
                alert(data.error || 'Booking not found with specified BID');
            }
        } catch {
            alert('Failed to fetch booking details');
        } finally {
            setFetchingDetails(false);
        }
    };

    const handleRowClick = (item: Booking) => {
        const queryId = item.bookingId || item.id;
        fetchBookingDetails(queryId);
    };

    const renderHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>BOOKING ID (BID)</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>PASSENGER</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>STATUS</Text>
            <Text style={[styles.headerCell, { flex: 2.5 }]}>ROUTE</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>DRIVER</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>ACTION</Text>
        </View>
    );

    const renderRow = ({ item }: { item: Booking }) => {
        const statusUpper = (item.status || 'PENDING').toUpperCase();
        const statusColor = STATUS_COLORS[statusUpper] ?? '#6B7280';
        const displayBID = item.bookingId ? item.bookingId : `ID: ${item.id.slice(-6).toUpperCase()}`;

        return (
            <TouchableOpacity style={styles.tableRow} onPress={() => handleRowClick(item)} activeOpacity={0.7}>
                <View style={{ flex: 1.5, justifyContent: 'center' }}>
                    <Text style={[styles.cell, styles.idCell]}>{displayBID}</Text>
                </View>
                <View style={{ flex: 2, justifyContent: 'center' }}>
                    <Text style={[styles.cell, styles.nameCell]}>{item.passengerName || '—'}</Text>
                    {item.passengerPhone ? <Text style={styles.subtextCell}>{item.passengerPhone}</Text> : null}
                </View>
                <View style={{ flex: 1.5, justifyContent: 'center' }}>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusUpper}</Text>
                    </View>
                </View>
                <Text style={[styles.cell, { flex: 2.5, fontSize: 13, color: '#9CA3AF' }]} numberOfLines={1}>{item.ride || '—'}</Text>
                <View style={{ flex: 2, justifyContent: 'center' }}>
                    <Text style={[styles.cell, { color: item.driverName ? '#E5E7EB' : '#6B7280' }]}>
                        {item.driverName || 'Unassigned'}
                    </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={styles.viewBtn}>
                        <Text style={styles.viewBtnText}>Details 👁</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const filteredBookings = bookings.filter(b => {
        const search = searchQuery.toLowerCase();
        return (
            b.passengerName?.toLowerCase().includes(search) ||
            b.bookingId?.toLowerCase().includes(search) ||
            b.id?.toLowerCase().includes(search) ||
            b.ride?.toLowerCase().includes(search)
        );
    });

    if (loading) return <ActivityIndicator color="#1FAF63" size="large" style={{ marginTop: 60 }} />;

    return (
        <View style={styles.container}>
            {/* Header & Export Row */}
            <View style={styles.headerRow}>
                <Text style={styles.sectionLabel}>BOOKING MANAGEMENT HUB</Text>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(bookings, 'Bookings_Report')}
                >
                    <Text style={styles.exportBtnText}>Excel Export</Text>
                </TouchableOpacity>
            </View>

            {/* BID Search Box Bar */}
            <View style={styles.searchBarCard}>
                <Text style={styles.searchLabel}>🔍 LOOKUP BOOKING BY BID:</Text>
                <View style={styles.searchInputRow}>
                    <TextInput
                        style={styles.bidInput}
                        placeholder="Enter Booking ID (e.g. Go-0047 or 0047)..."
                        placeholderTextColor="#6B7280"
                        value={bidSearchInput}
                        onChangeText={setBidSearchInput}
                        onSubmitEditing={() => fetchBookingDetails(bidSearchInput)}
                    />
                    <TouchableOpacity
                        style={styles.searchBtn}
                        onPress={() => fetchBookingDetails(bidSearchInput)}
                        disabled={fetchingDetails}
                    >
                        {fetchingDetails ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.searchBtnText}>Fetch BID Details</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Table Card */}
            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ minWidth: 900, flex: 1 }}>
                        {renderHeader()}
                        <FlatList
                            data={filteredBookings}
                            keyExtractor={item => item.id}
                            renderItem={renderRow}
                            ListEmptyComponent={
                                <Text style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No confirmed or pending bookings found.</Text>
                            }
                        />
                    </View>
                </ScrollView>
            </View>

            {/* Comprehensive Booking Details Modal */}
            {detailModalVisible && selectedBookingDetails && (
                <Modal
                    visible={detailModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setDetailModalVisible(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <View style={styles.detailCard}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.bidHeaderTitle}>
                                        BOOKING DETAILS: {selectedBookingDetails.bookingId || `ID: ${selectedBookingDetails.id}`}
                                    </Text>
                                    <Text style={styles.modalSubTitle}>
                                        Type: {selectedBookingDetails.type === 'parcel' ? '📦 Parcel Delivery' : '🚗 Passenger Seat'} | Created: {new Date(selectedBookingDetails.createdAt).toLocaleString()}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                                    <Text style={{ color: '#9CA3AF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                                {/* Status Banner */}
                                <View style={[
                                    styles.statusBanner,
                                    { backgroundColor: (STATUS_COLORS[(selectedBookingDetails.status || 'pending').toUpperCase()] || '#6B7280') + '22' }
                                ]}>
                                    <Text style={styles.bannerLabel}>BOOKING STATUS:</Text>
                                    <Text style={[
                                        styles.bannerVal,
                                        { color: STATUS_COLORS[(selectedBookingDetails.status || 'pending').toUpperCase()] || '#6B7280' }
                                    ]}>
                                        {(selectedBookingDetails.status || 'pending').toUpperCase()}
                                    </Text>
                                </View>

                                {/* Grid Details Section */}
                                <View style={styles.gridRow}>
                                    {/* Passenger Info */}
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.blockTitle}>👤 PASSENGER DETAILS</Text>
                                        <Text style={styles.infoLabel}>Name: <Text style={styles.infoVal}>{selectedBookingDetails.passenger?.name || 'N/A'}</Text></Text>
                                        <Text style={styles.infoLabel}>Phone: <Text style={styles.infoVal}>{selectedBookingDetails.passenger?.phone || 'N/A'}</Text></Text>
                                        <Text style={styles.infoLabel}>User ID: <Text style={styles.subInfoVal}>{selectedBookingDetails.passenger?.id || 'N/A'}</Text></Text>
                                    </View>

                                    {/* Driver & Vehicle Info */}
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.blockTitle}>🚗 DRIVER & VEHICLE</Text>
                                        <Text style={styles.infoLabel}>Driver: <Text style={styles.infoVal}>{selectedBookingDetails.driver?.name || 'Unassigned'}</Text></Text>
                                        <Text style={styles.infoLabel}>Driver Phone: <Text style={styles.infoVal}>{selectedBookingDetails.driver?.phone || 'N/A'}</Text></Text>
                                        <Text style={styles.infoLabel}>Vehicle Model: <Text style={styles.infoVal}>{selectedBookingDetails.driver?.vehicleModel || 'N/A'}</Text></Text>
                                        <Text style={styles.infoLabel}>Vehicle No: <Text style={styles.infoVal}>{selectedBookingDetails.driver?.vehicleNumber || 'N/A'}</Text></Text>
                                    </View>
                                </View>

                                <View style={styles.gridRow}>
                                    {/* Route & Schedule */}
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.blockTitle}>🗺️ ROUTE & SCHEDULE</Text>
                                        <Text style={styles.infoLabel}>Pickup: <Text style={styles.infoVal}>{selectedBookingDetails.pickup || selectedBookingDetails.ride?.pickup}</Text></Text>
                                        <Text style={styles.infoLabel}>Dropoff: <Text style={styles.infoVal}>{selectedBookingDetails.dropoff || selectedBookingDetails.ride?.dropoff}</Text></Text>
                                        <Text style={styles.infoLabel}>Departure Date: <Text style={styles.infoVal}>{selectedBookingDetails.ride?.date || 'N/A'}</Text></Text>
                                        <Text style={styles.infoLabel}>Departure Time: <Text style={styles.infoVal}>{selectedBookingDetails.ride?.departureTime || 'N/A'}</Text></Text>
                                    </View>

                                    {/* Fare & Specifications */}
                                    <View style={styles.detailBlock}>
                                        <Text style={styles.blockTitle}>💳 FARE & SPECS</Text>
                                        <Text style={styles.infoLabel}>Total Price: <Text style={{ fontWeight: 'bold', color: '#1FAF63' }}>₹ {selectedBookingDetails.price || '0'}</Text></Text>
                                        {selectedBookingDetails.type !== 'parcel' ? (
                                            <>
                                                <Text style={styles.infoLabel}>Seats Requested: <Text style={styles.infoVal}>{selectedBookingDetails.seatsRequested || 1}</Text></Text>
                                                <Text style={styles.infoLabel}>Roof Carrier: <Text style={styles.infoVal}>{selectedBookingDetails.roofCarrier ? 'Yes ✅' : 'No ❌'}</Text></Text>
                                                <Text style={styles.infoLabel}>Motion Sickness: <Text style={styles.infoVal}>{selectedBookingDetails.motionSickness ? 'Yes ⚠️' : 'No'}</Text></Text>
                                            </>
                                        ) : (
                                            <>
                                                <Text style={styles.infoLabel}>Parcel Size: <Text style={styles.infoVal}>{selectedBookingDetails.parcel?.parcelSize || 'N/A'}</Text></Text>
                                                <Text style={styles.infoLabel}>Recipient: <Text style={styles.infoVal}>{selectedBookingDetails.parcel?.recipientName || 'N/A'}</Text></Text>
                                                <Text style={styles.infoLabel}>Recipient Contact: <Text style={styles.infoVal}>{selectedBookingDetails.parcel?.contactNumber || 'N/A'}</Text></Text>
                                            </>
                                        )}
                                    </View>
                                </View>

                                {selectedBookingDetails.parcel?.notes ? (
                                    <View style={styles.notesBlock}>
                                        <Text style={styles.blockTitle}>📝 PARCEL NOTES / INSTRUCTIONS</Text>
                                        <Text style={{ color: '#E5E7EB', fontSize: 13, marginTop: 4 }}>{selectedBookingDetails.parcel.notes}</Text>
                                    </View>
                                ) : null}

                                {selectedBookingDetails.parcel?.photoUrl ? (
                                    <View style={styles.notesBlock}>
                                        <Text style={styles.blockTitle}>🖼️ PARCEL PHOTO</Text>
                                        <Image
                                            source={{ uri: selectedBookingDetails.parcel.photoUrl }}
                                            style={{ width: '100%', height: 180, borderRadius: 8, marginTop: 8 }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                ) : null}
                            </ScrollView>

                            {/* Footer */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeFooterBtn}>
                                    <Text style={styles.closeFooterBtnText}>Close Window</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2, fontWeight: 'bold' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    exportBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
    exportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    searchBarCard: {
        backgroundColor: '#1F2937', borderRadius: 12, padding: 16,
        marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    searchLabel: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
    searchInputRow: { flexDirection: 'row', gap: 12 },
    bidInput: {
        flex: 1, backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 14,
        paddingVertical: 10, color: '#FFFFFF', borderWidth: 1, borderColor: '#374151', fontSize: 14,
    },
    searchBtn: { backgroundColor: '#1FAF63', paddingHorizontal: 18, justifyContent: 'center', borderRadius: 8 },
    searchBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },

    tableCard: {
        flex: 1, backgroundColor: '#111827', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: '#1F2937',
    },
    headerCell: { color: '#9CA3AF', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
    tableRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    cell: { color: '#E5E7EB', fontSize: 14 },
    idCell: { color: '#00BFA5', fontWeight: 'bold', fontSize: 13 },
    nameCell: { fontWeight: 'bold' },
    subtextCell: { color: '#9CA3AF', fontSize: 12 },
    statusPill: {
        borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
    viewBtn: { backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: '#3B82F6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    viewBtnText: { color: '#60A5FA', fontSize: 12, fontWeight: '600' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    detailCard: { width: '100%', maxWidth: 750, backgroundColor: '#1F2937', borderRadius: 16, maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: '#374151' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151', backgroundColor: '#111827' },
    bidHeaderTitle: { color: '#00BFA5', fontSize: 18, fontWeight: 'bold' },
    modalSubTitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
    closeBtn: { padding: 6 },

    statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, marginBottom: 16 },
    bannerLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: 'bold' },
    bannerVal: { fontSize: 14, fontWeight: 'bold' },

    gridRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    detailBlock: { flex: 1, backgroundColor: '#111827', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#374151' },
    blockTitle: { color: '#60A5FA', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
    infoLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 6 },
    infoVal: { color: '#FFFFFF', fontWeight: '500' },
    subInfoVal: { color: '#6B7280', fontSize: 11 },

    notesBlock: { backgroundColor: '#111827', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },

    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#374151', backgroundColor: '#111827', alignItems: 'flex-end' },
    closeFooterBtn: { backgroundColor: '#374151', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    closeFooterBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
