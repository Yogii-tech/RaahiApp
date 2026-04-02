import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { API_BASE } from '../../apiConfig';

interface Booking {
    id: string;
    passengerName: string;
    status: string;
    driverName: string;
}

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: '#1FAF63',
    ASSIGNED: '#3B82F6',
    PENDING: '#6B7280',
    COMPLETED: '#8B5CF6',
    CANCELLED: '#EF4444',
    'ON TRIP': '#F59E0B',
};

export default function AdminBookingsView({ token }: { token: string }) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/api/admin/bookings`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(d => setBookings(Array.isArray(d) ? d : []))
            .catch(() => setBookings([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <ActivityIndicator color="#1FAF63" size="large" style={{ marginTop: 60 }} />;

    const renderHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 1 }]}>ID</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>PASSENGER</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>STATUS</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>DRIVER</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>ACTIONS</Text>
        </View>
    );

    const renderRow = ({ item, index }: { item: Booking; index: number }) => {
        const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
        const bRef = `B${String(1001 + index).padStart(4, '0')}`;
        return (
            <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.idCell, { flex: 1 }]}>{bRef}</Text>
                <Text style={[styles.cell, styles.nameCell, { flex: 2 }]}>{item.passengerName || '—'}</Text>
                <View style={{ flex: 2 }}>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                </View>
                <View style={[styles.driverPill, { flex: 2 }]}>
                    <Text style={styles.driverText}>{item.driverName || 'Assign...'}</Text>
                    <Text style={styles.dropdownArrow}> ▾</Text>
                </View>
                <View style={[styles.actions, { flex: 1 }]}>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Text style={styles.actionIcon}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}>
                        <Text style={styles.actionIcon}>🗑</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.sectionLabel}>MANAGEMENT HUB</Text>
            <View style={styles.tableCard}>
                {renderHeader()}
                <FlatList
                    data={bookings}
                    keyExtractor={item => item.id}
                    renderItem={renderRow}
                    ListEmptyComponent={
                        <Text style={{ color: '#6B7280', textAlign: 'center', padding: 30 }}>No bookings found</Text>
                    }
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2, marginBottom: 20 },
    tableCard: {
        backgroundColor: '#111827', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerCell: { color: '#6B7280', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5 },
    tableRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    cell: { color: '#E5E7EB', fontSize: 14 },
    idCell: { color: '#6B7280' },
    nameCell: { fontWeight: 'bold' },
    statusPill: {
        borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
    driverPill: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937',
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    driverText: { color: '#E5E7EB', fontSize: 13 },
    dropdownArrow: { color: '#6B7280', fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    actionBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: '#1F2937',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    deleteBtn: { backgroundColor: '#2A0F0F', borderColor: '#EF4444' },
    actionIcon: { color: '#1FAF63', fontSize: 14 },
});
