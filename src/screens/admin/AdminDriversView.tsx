import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';

interface Driver {
    id: string;
    name: string;
    phone: string;
    vehicleName: string;
    vehicleNumber: string;
    vehicleType: string;
    seatsFilled: number;
    seats: number;
    totalRides: number;
    currentRide?: string;
}

export default function AdminDriversView({ token, searchQuery = '' }: { token: string; searchQuery?: string }) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const { fetchWithAuth } = useAuth();

    useEffect(() => {
        fetchWithAuth(`${API_BASE}/api/admin/drivers`)
            .then(r => r.json())
            .then(d => setDrivers(Array.isArray(d) ? d : []))
            .catch(() => setDrivers([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <ActivityIndicator color="#1FAF63" size="large" style={{ marginTop: 60 }} />;

    const renderHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>DRIVER</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>PHONE</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>VEHICLE</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>REG. NUMBER</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>RIDE</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>REMAINING</Text>
            <Text style={[styles.headerCell, { flex: 0.8 }]}>SEATS</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>RIDES</Text>
        </View>
    );

    const renderRow = ({ item, index }: { item: Driver; index: number }) => (
        <View style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
            <View style={[styles.indexCell, { flex: 0.4 }]}>
                <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(item.name || 'D')[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.nameText}>{item.name || '—'}</Text>
            </View>
            <Text style={[styles.cell, { flex: 1.5 }]}>{item.phone || '—'}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{item.vehicleName || '—'}</Text>
            <View style={{ flex: 1.5 }}>
                <View style={styles.numberPill}>
                    <Text style={styles.numberText}>{item.vehicleNumber || '—'}</Text>
                </View>
            </View>
            <Text style={[styles.cell, { flex: 2, fontSize: 12, color: '#9CA3AF' }]} numberOfLines={1}>{item.currentRide || '—'}</Text>
            <Text style={[styles.cell, { flex: 1, color: '#9CA3AF' }]}>{item.seatsFilled != null ? item.seatsFilled : '—'}</Text>
            <Text style={[styles.cell, { flex: 0.8, textAlign: 'center' }]}>{item.seats || '—'}</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={styles.ridesBadge}>
                    <Text style={styles.ridesText}>{item.totalRides}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.topRow}>
                <Text style={styles.sectionLabel}>MANAGEMENT HUB</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{drivers.length} Registered</Text>
                </View>
            </View>
            <View style={styles.headerRow}>
                <Text style={styles.pageTitle}>Drivers</Text>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(drivers, 'Drivers_Report')}
                >
                    <Text style={styles.exportBtnText}>Export CSV</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ minWidth: 1000, flex: 1 }}>
                        {renderHeader()}
                        <FlatList
                            data={drivers.filter(d =>
                                d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                d.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                d.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase())
                            )}
                            keyExtractor={item => item.id}
                            renderItem={renderRow}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No drivers registered yet</Text>
                            }
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2 },
    countBadge: {
        backgroundColor: '#1FAF6322', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 4,
        borderWidth: 1, borderColor: '#1FAF6344',
    },
    countText: { color: '#1FAF63', fontSize: 12, fontWeight: 'bold' },
    pageTitle: { color: '#F9FAFB', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
    tableCard: {
        flex: 1, backgroundColor: '#111827', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#0D1117',
    },
    headerCell: { color: '#6B7280', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
    tableRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
    indexCell: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center',
    },
    indexText: { color: '#6B7280', fontSize: 12, fontWeight: 'bold' },
    avatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#1FAF6333', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#1FAF6366',
    },
    avatarText: { color: '#1FAF63', fontWeight: 'bold', fontSize: 14 },
    nameText: { color: '#F9FAFB', fontSize: 14, fontWeight: 'bold' },
    cell: { color: '#D1D5DB', fontSize: 13 },
    numberPill: {
        backgroundColor: '#1F2937', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 4,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'flex-start',
    },
    numberText: { color: '#E5E7EB', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
    ridesBadge: {
        backgroundColor: '#0F2A1E', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: '#1FAF6344',
    },
    ridesText: { color: '#1FAF63', fontSize: 12, fontWeight: 'bold' },
    emptyText: { color: '#6B7280', textAlign: 'center', padding: 40, fontSize: 14 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    exportBtn: { backgroundColor: '#1FAF63', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    exportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
