import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';
import { Driver } from './AdminDriversView';
import { parseJsonSafe, createRequestAbort } from '../../utils/json';

export default function AdminVehiclesView({ token, searchQuery = '', isDark }: { token: string; searchQuery?: string; isDark: boolean }) {
    const [vehicles, setVehicles] = useState<Driver[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
    const { fetchWithAuth } = useAuth();
    const fetchWithAuthRef = useRef(fetchWithAuth);
    fetchWithAuthRef.current = fetchWithAuth;
    const abortRef = useRef<AbortController | null>(null);
    const reqIdRef = useRef(0);
    const isMountedRef = useRef(true);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
    };

    const loadVehicles = useCallback(async (background = false) => {
        abortRef.current?.abort();
        const { controller, cleanup, didTimeout } = createRequestAbort(12000);
        abortRef.current = controller;
        const reqId = ++reqIdRef.current;

        if (background) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        try {
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/drivers`, { signal: controller.signal });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const data = await parseJsonSafe<Driver[]>(res);
            if (!isMountedRef.current || reqId !== reqIdRef.current) return;
            const withVehicles = Array.isArray(data) ? data.filter(d => d.vehicleNumber || d.vehicleName) : [];
            setVehicles(withVehicles);
        } catch (err: any) {
            if (!isMountedRef.current || reqId !== reqIdRef.current) return;
            if (err?.name === 'AbortError' && !didTimeout()) return;
            console.error('Failed to load vehicles:', err);
            setError(didTimeout() ? 'Request timed out while loading vehicles' : (err?.message || 'Failed to load vehicles'));
            if (!background) setVehicles([]);
        } finally {
            cleanup();
            if (isMountedRef.current && reqId === reqIdRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        loadVehicles(false);
        return () => {
            isMountedRef.current = false;
            reqIdRef.current += 1;
            abortRef.current?.abort();
        };
    }, [loadVehicles]);

    const getNormalizedStatus = (status?: string) => {
        if (status === 'verified') return 'verified';
        if (status === 'rejected') return 'rejected';
        return 'pending';
    };

    const totalCount = vehicles.length;
    const verifiedCount = vehicles.filter(v => getNormalizedStatus(v.verificationStatus) === 'verified').length;
    const pendingCount = vehicles.filter(v => getNormalizedStatus(v.verificationStatus) === 'pending').length;
    const rejectedCount = vehicles.filter(v => getNormalizedStatus(v.verificationStatus) === 'rejected').length;

    const filteredVehicles = vehicles.filter(v => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            v.id?.toLowerCase().includes(q) ||
            v.phone?.toLowerCase().includes(q) ||
            v.vehicleName?.toLowerCase().includes(q) ||
            v.vehicleNumber?.toLowerCase().includes(q) ||
            v.name?.toLowerCase().includes(q) ||
            v.vehicleType?.toLowerCase().includes(q);

        const status = getNormalizedStatus(v.verificationStatus);
        if (activeFilter === 'verified') return matchesSearch && status === 'verified';
        if (activeFilter === 'pending') return matchesSearch && status === 'pending';
        if (activeFilter === 'rejected') return matchesSearch && status === 'rejected';
        return matchesSearch;
    });

    const exportData = filteredVehicles.map(v => ({
        Vehicle: v.vehicleName || '—',
        PlateNumber: v.vehicleNumber || '—',
        Type: v.vehicleType || '—',
        Capacity: v.seats ? `${v.seats} Seats` : '—',
        OwnerName: v.name || '—',
        OwnerPhone: v.phone || '—',
        Status: getNormalizedStatus(v.verificationStatus)
    }));

    if (loading && vehicles.length === 0) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    if (error && vehicles.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <Text style={{ color: '#DC3545', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{error}</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={() => loadVehicles(false)}>
                    <Text style={styles.exportBtnText}>↻ Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.sectionTitle, { color: T.text }]}>Vehicle Fleet Management</Text>
                    <Text style={[styles.sectionSubtitle, { color: T.subtext }]}>
                        Overview of active, pending, and rejected vehicles registered in the system.
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={[styles.refreshBtn, { backgroundColor: T.card, borderColor: T.border }, refreshing && { opacity: 0.6 }]}
                        onPress={() => loadVehicles(true)}
                        disabled={refreshing}
                    >
                        <Text style={[styles.refreshBtnText, { color: T.text }]}>{refreshing ? '↻ Refreshing...' : '↻ Refresh'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={() => downloadCSV(exportData, 'Vehicles_Fleet_Report')}
                    >
                        <Text style={styles.exportBtnText}>Export Fleet CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <Text style={{ color: '#DC3545', fontSize: 12, marginBottom: 12 }}>Refresh failed: {error}</Text>
            )}

            {/* KPI Row */}
            <View style={[styles.kpiRow, { flexWrap: 'wrap' }, isMobile && { gap: 12 }]}>
                {[
                    { label: 'Total Fleet', count: totalCount, color: '#3B7DDD', icon: '🚐' },
                    { label: 'Verified Active', count: verifiedCount, color: '#28A745', icon: '✅' },
                    { label: 'Pending Safety Audit', count: pendingCount, color: '#FCB92C', icon: '⏳' },
                    { label: 'Rejected / Blocked', count: rejectedCount, color: '#DC3545', icon: '❌' },
                ].map(card => (
                    <View key={card.label} style={[styles.kpiCard, isMobile && { minWidth: 140, padding: 14 }, { backgroundColor: T.card, borderColor: T.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.kpiCount, { color: card.color }]}>{card.count}</Text>
                            <Text style={{ fontSize: 24 }}>{card.icon}</Text>
                        </View>
                        <Text style={[styles.kpiLabel, { color: T.subtext }]}>{card.label}</Text>
                    </View>
                ))}
            </View>

            {/* Filter Tabs */}
            <View style={[styles.filterRow, { flexWrap: 'wrap' }, isMobile && { gap: 8 }]}>
                {[
                    { id: 'all', label: `All Fleet (${totalCount})` },
                    { id: 'verified', label: `Verified / Active (${verifiedCount})` },
                    { id: 'pending', label: `Pending Inspection (${pendingCount})` },
                    { id: 'rejected', label: `Rejected (${rejectedCount})` },
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
                {isMobile ? (
                    filteredVehicles.length === 0 ? (
                        <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>
                            No registered vehicles match filters.
                        </Text>
                    ) : (
                        filteredVehicles.map((item, index) => {
                            const status = getNormalizedStatus(item.verificationStatus);
                            const badgeStyle = status === 'verified' ? styles.badgeVerified : status === 'rejected' ? styles.badgeRejected : styles.badgePending;
                            const badgeColor = status === 'verified' ? '#28A745' : status === 'rejected' ? '#DC3545' : '#FCB92C';
                            const badgeLabel = status === 'verified' ? 'Active / Audit OK' : status === 'rejected' ? 'Rejected' : 'Pending Audit';
                            return (
                                <View key={item.id} style={[styles.mobileVehicleCard, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                    <View style={styles.mobileCardTop}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={[styles.vehicleName, { color: T.text }]} numberOfLines={1} ellipsizeMode="tail">
                                                {item.vehicleName || 'Vehicle Specification'}
                                            </Text>
                                            <Text style={[styles.vehiclePlate, { color: T.subtext }]} numberOfLines={1}>
                                                {item.vehicleNumber || 'No Plate Number'}
                                            </Text>
                                        </View>
                                        <View style={[styles.statusBadge, badgeStyle]}>
                                            <Text style={[styles.badgeText, { color: badgeColor }]}>
                                                {badgeLabel}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.mobileCardMeta}>
                                        <Text style={{ color: T.subtext, fontSize: 12 }}>
                                            {item.vehicleType || 'Sedan'} • {item.seats || 4} Seats
                                        </Text>
                                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>
                                            {item.name} ({item.phone})
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )
                ) : (
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
                                    const status = getNormalizedStatus(item.verificationStatus);
                                    const badgeStyle = status === 'verified' ? styles.badgeVerified : status === 'rejected' ? styles.badgeRejected : styles.badgePending;
                                    const badgeColor = status === 'verified' ? '#28A745' : status === 'rejected' ? '#DC3545' : '#FCB92C';
                                    const badgeLabel = status === 'verified' ? 'Active / Audit OK' : status === 'rejected' ? 'Rejected' : 'Pending Audit';
                                    return (
                                        <View style={[styles.tableRow, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                            <View style={{ flex: 2, justifyContent: 'center', minWidth: 0, paddingRight: 8 }}>
                                                <Text style={[styles.vehicleName, { color: T.text }]} numberOfLines={1} ellipsizeMode="tail">{item.vehicleName || 'Vehicle Specification'}</Text>
                                                <Text style={[styles.vehiclePlate, { color: T.subtext }]} numberOfLines={1}>{item.vehicleNumber || 'No Plate Number'}</Text>
                                            </View>
                                            <View style={{ flex: 1.5, justifyContent: 'center', minWidth: 0 }}>
                                                <Text style={[styles.cellText, { color: T.text }]}>{item.vehicleType || 'Sedan'}</Text>
                                            </View>
                                            <View style={{ flex: 1, justifyContent: 'center', minWidth: 0 }}>
                                                <Text style={[styles.cellText, { color: T.text }]}>{item.seats || 4} Seats</Text>
                                            </View>
                                            <View style={{ flex: 2, justifyContent: 'center', minWidth: 0, paddingRight: 8 }}>
                                                <Text style={[styles.ownerName, { color: T.text }]} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                                                <Text style={[styles.ownerPhone, { color: T.subtext }]} numberOfLines={1}>{item.phone}</Text>
                                            </View>
                                            <View style={{ flex: 1.5, justifyContent: 'center', minWidth: 0 }}>
                                                <View style={[styles.statusBadge, badgeStyle]}>
                                                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                                                        {badgeLabel}
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
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '600' },
    sectionSubtitle: { fontSize: 13, marginTop: 4 },
    refreshBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, borderWidth: 1 },
    refreshBtnText: { fontSize: 13, fontWeight: '500' },
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
    badgeRejected: { backgroundColor: 'rgba(220,53,69,0.1)', borderColor: 'rgba(220,53,69,0.3)' },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    mobileVehicleCard: { padding: 14, borderBottomWidth: 1, gap: 8 },
    mobileCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    mobileCardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
