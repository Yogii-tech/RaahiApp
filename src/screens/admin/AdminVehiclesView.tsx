import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';
import { Driver } from './AdminDriversView';

export default function AdminVehiclesView({ token, searchQuery = '', isDark }: { token: string; searchQuery?: string; isDark: boolean }) {
    const [vehicles, setVehicles] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'verified' | 'pending'>('all');
    const { fetchWithAuth } = useAuth();

    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
    };

    useEffect(() => {
        loadVehicles();
    }, []);

    const loadVehicles = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/api/admin/drivers`);
            const data = await res.json();
            // Filter drivers that actually have a vehicle registered
            const withVehicles = Array.isArray(data) ? data.filter(d => d.vehicleNumber || d.vehicleName) : [];
            setVehicles(withVehicles);
        } catch (err) {
            console.error('Failed to load vehicles:', err);
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    };

    const totalCount = vehicles.length;
    const verifiedCount = vehicles.filter(v => v.verificationStatus === 'verified').length;
    const pendingCount = vehicles.filter(v => v.verificationStatus === 'pending' || !v.verificationStatus).length;

    const filteredVehicles = vehicles.filter(v => {
        const matchesSearch =
            v.vehicleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.vehicleType?.toLowerCase().includes(searchQuery.toLowerCase());

        const status = v.verificationStatus || 'pending';
        if (activeFilter === 'verified') return matchesSearch && status === 'verified';
        if (activeFilter === 'pending') return matchesSearch && status === 'pending';
        return matchesSearch;
    });

    const exportData = filteredVehicles.map(v => ({
        Vehicle: v.vehicleName || '—',
        PlateNumber: v.vehicleNumber || '—',
        Type: v.vehicleType || '—',
        Capacity: v.seats ? `${v.seats} Seats` : '—',
        OwnerName: v.name || '—',
        OwnerPhone: v.phone || '—',
        Status: v.verificationStatus || 'pending'
    }));

    if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    return (
        <View style={[styles.container, { backgroundColor: T.bg }]}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.sectionTitle, { color: T.text }]}>Vehicle Fleet Management</Text>
                    <Text style={[styles.sectionSubtitle, { color: T.subtext }]}>
                        Overview of active, pending, and retired vehicles registered in the system.
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(exportData, 'Vehicles_Fleet_Report')}
                >
                    <Text style={styles.exportBtnText}>Export Fleet CSV</Text>
                </TouchableOpacity>
            </View>

            {/* KPI Row */}
            <View style={styles.kpiRow}>
                {[
                    { label: 'Total Fleet', count: totalCount, color: '#3B7DDD', icon: '🚐' },
                    { label: 'Verified Active', count: verifiedCount, color: '#28A745', icon: '✅' },
                    { label: 'Pending Safety Audit', count: pendingCount, color: '#FCB92C', icon: '⏳' },
                ].map(card => (
                    <View key={card.label} style={[styles.kpiCard, { backgroundColor: T.card, borderColor: T.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.kpiCount, { color: card.color }]}>{card.count}</Text>
                            <Text style={{ fontSize: 24 }}>{card.icon}</Text>
                        </View>
                        <Text style={[styles.kpiLabel, { color: T.subtext }]}>{card.label}</Text>
                    </View>
                ))}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
                {[
                    { id: 'all', label: 'All Fleet' },
                    { id: 'verified', label: 'Verified / Active' },
                    { id: 'pending', label: 'Pending Inspection' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.filterTab,
                            activeFilter === tab.id && { borderBottomColor: T.accent, borderBottomWidth: 2 }
                        ]}
                        onPress={() => setActiveFilter(tab.id as any)}
                    >
                        <Text style={[
                            styles.filterTabText,
                            { color: activeFilter === tab.id ? T.accent : T.subtext, fontWeight: activeFilter === tab.id ? '600' : 'normal' }
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Vehicles Table */}
            <View style={[styles.tableCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 900, padding: 20 }}>
                        <View style={[styles.tableHeader, { borderBottomColor: T.border }]}>
                            <Text style={[styles.headerCell, { flex: 2, color: T.text }]}>VEHICLE / PLATE</Text>
                            <Text style={[styles.headerCell, { flex: 1.5, color: T.text }]}>TYPE</Text>
                            <Text style={[styles.headerCell, { flex: 1, color: T.text }]}>CAPACITY</Text>
                            <Text style={[styles.headerCell, { flex: 2, color: T.text }]}>REGISTERED OWNER</Text>
                            <Text style={[styles.headerCell, { flex: 1.5, color: T.text }]}>STATUS</Text>
                        </View>

                        <FlatList
                            data={filteredVehicles}
                            keyExtractor={item => item.id}
                            renderItem={({ item, index }) => {
                                const status = item.verificationStatus || 'pending';
                                return (
                                    <View style={[styles.tableRow, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                        <View style={{ flex: 2, justifyContent: 'center' }}>
                                            <Text style={[styles.vehicleName, { color: T.text }]}>{item.vehicleName || 'Vehicle Specification'}</Text>
                                            <Text style={[styles.vehiclePlate, { color: T.subtext }]}>{item.vehicleNumber || 'No Plate Number'}</Text>
                                        </View>
                                        <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                            <Text style={[styles.cellText, { color: T.text }]}>{item.vehicleType || 'Sedan'}</Text>
                                        </View>
                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            <Text style={[styles.cellText, { color: T.text }]}>{item.seats || 4} Seats</Text>
                                        </View>
                                        <View style={{ flex: 2, justifyContent: 'center' }}>
                                            <Text style={[styles.ownerName, { color: T.text }]}>{item.name}</Text>
                                            <Text style={[styles.ownerPhone, { color: T.subtext }]}>{item.phone}</Text>
                                        </View>
                                        <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                            <View style={[
                                                styles.statusBadge,
                                                status === 'verified' ? styles.badgeVerified : styles.badgePending
                                            ]}>
                                                <Text style={[
                                                    styles.badgeText,
                                                    { color: status === 'verified' ? '#28A745' : '#FCB92C' }
                                                ]}>
                                                    {status === 'verified' ? 'Active / Audit OK' : 'Pending Audit'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>
                                    No registered vehicles match filters.
                                </Text>
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
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '600' },
    sectionSubtitle: { fontSize: 13, marginTop: 4 },
    exportBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
    exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
    kpiRow: { flexDirection: 'row', gap: 20, marginBottom: 24 },
    kpiCard: { flex: 1, padding: 20, borderRadius: 8, borderWidth: 1 },
    kpiCount: { fontSize: 24, fontWeight: 'bold' },
    kpiLabel: { fontSize: 12, marginTop: 6, fontWeight: '500' },
    filterRow: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)', marginBottom: 20 },
    filterTab: { paddingVertical: 10, paddingHorizontal: 8 },
    filterTabText: { fontSize: 14 },
    tableCard: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
    headerCell: { fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, minHeight: 52 },
    vehicleName: { fontWeight: '600', fontSize: 14 },
    vehiclePlate: { fontSize: 12, marginTop: 2, fontFamily: 'monospace' },
    cellText: { fontSize: 14 },
    ownerName: { fontSize: 14, fontWeight: '500' },
    ownerPhone: { fontSize: 12 },
    statusBadge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1 },
    badgeVerified: { backgroundColor: 'rgba(40,167,69,0.1)', borderColor: 'rgba(40,167,69,0.3)' },
    badgePending: { backgroundColor: 'rgba(252,185,44,0.1)', borderColor: 'rgba(252,185,44,0.3)' },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
});
