import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

interface ParcelStats {
     total: number;
     pending: number;
     shipped: number;
}

interface ParcelRow {
     id: string;
     type: string;
     sender: string;
     recipient: string;
     pickup: string;
     dropoff: string;
     status: string;
     price: string;
     date: string;
}

const STATUS_COLORS: Record<string, string> = {
     pending: '#FCB92C',
     accepted: '#28A745',
     rejected: '#D9534F',
     completed: '#3B7DDD',
};

export default function AdminParcelsDetailView({ isDark, searchQuery = '' }: { isDark: boolean; searchQuery?: string }) {
     const [parcelStats, setParcelStats] = useState<ParcelStats | null>(null);
     const [parcels, setParcels] = useState<ParcelRow[]>([]);
     const [loading, setLoading] = useState(true);
     const { fetchWithAuth } = useAuth();
     const { width } = useWindowDimensions();
     const isMobile = width < 768;

     const T = {
          bg: isDark ? '#111827' : '#F7F9FC',
          card: isDark ? '#1F2937' : '#FFFFFF',
          text: isDark ? '#F9FAFB' : '#495057',
          subtext: isDark ? '#9CA3AF' : '#6C757D',
          border: isDark ? 'rgba(255,255,255,0.1)' : '#DEE2E6',
          accent: '#3B7DDD',
     };

     const fetchData = () => {
          setLoading(true);
          Promise.all([
               fetchWithAuth(`${API_BASE}/api/admin/stats`).then(r => r.json()),
               fetchWithAuth(`${API_BASE}/api/admin/parcels`).then(r => r.json()),
          ])
               .then(([stats, parcelsData]) => {
                    setParcelStats(stats?.parcels ?? null);
                    setParcels(Array.isArray(parcelsData) ? parcelsData : []);
               })
               .catch(() => { setParcelStats(null); setParcels([]); })
               .finally(() => setLoading(false));
     };

     useEffect(() => { fetchData(); }, []);

     if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     const filteredParcels = parcels.filter(p =>
          (p.sender || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.recipient || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.id || '').toLowerCase().includes(searchQuery.toLowerCase())
     );

     return (
          <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Parcels Overview</Text>
                    <View style={[styles.headerButtons, { flexWrap: 'wrap', gap: 10 }]}>
                         <TouchableOpacity onPress={fetchData} style={[styles.ghostBtn, { borderColor: T.border }]}>
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>↻ Refresh</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(parcels, 'Parcels_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export Report</Text>
                         </TouchableOpacity>
                    </View>
               </View>

               {/* KPI Cards */}
               <View style={[styles.statsRow, { flexWrap: 'wrap' }, isMobile && { gap: 12 }]}>
                    {[
                         { label: 'Total Shipments', value: parcelStats?.total ?? 0, color: '#3B7DDD', icon: '📦' },
                         { label: 'Pending Pickup', value: parcelStats?.pending ?? 0, color: '#FCB92C', icon: '⏳' },
                         { label: 'In Transit', value: parcelStats?.shipped ?? 0, color: '#28A745', icon: '🚛' },
                    ].map((stat, i) => (
                         <View key={i} style={[styles.statCard, isMobile && { minWidth: 140, padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                              <View style={styles.statHeader}>
                                   <Text style={[styles.statLabel, { color: T.subtext, flexShrink: 1, minWidth: 0 }]}>{stat.label}</Text>
                                   <Text style={{ fontSize: 18 }}>{stat.icon}</Text>
                              </View>
                              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                         </View>
                    ))}
               </View>

               {/* Parcel Table */}
               <View style={[styles.tablePanel, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>Recent Shipments</Text>

                    {!isMobile && (
                         <View style={[styles.tableHeader, { borderBottomColor: T.border }]}>
                              {['Parcel ID', 'Sender / Receiver', 'Route', 'Status', 'Price'].map(h => (
                                   <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                              ))}
                         </View>
                    )}

                    {filteredParcels.length === 0 ? (
                         <View style={styles.emptyState}>
                              <Text style={{ color: T.subtext }}>No parcels found.</Text>
                         </View>
                    ) : isMobile ? (
                         filteredParcels.map((p, i) => (
                              <View key={i} style={[styles.mobileCard, { borderBottomColor: T.border }]}>
                                   <View style={styles.mobileCardTop}>
                                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '700', flex: 1, minWidth: 0 }} numberOfLines={1} ellipsizeMode="tail">
                                             {p.id}
                                        </Text>
                                        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[p.status] || '#6C757D') + '22' }]}>
                                             <Text style={{ color: STATUS_COLORS[p.status] || '#6C757D', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                  {p.status}
                                             </Text>
                                        </View>
                                   </View>
                                   <Text style={{ color: T.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                                        {p.sender} → <Text style={{ color: T.subtext, fontWeight: '400' }}>{p.recipient}</Text>
                                   </Text>
                                   <View style={styles.mobileCardBottom}>
                                        <Text style={{ color: T.subtext, fontSize: 12, flex: 1, minWidth: 0 }} numberOfLines={1} ellipsizeMode="tail">
                                             {p.pickup.split(',')[0]} → {p.dropoff.split(',')[0]}
                                        </Text>
                                        <Text style={{ color: '#00C853', fontWeight: 'bold', fontSize: 14 }}>₹{p.price}</Text>
                                   </View>
                              </View>
                         ))
                    ) : (
                         filteredParcels.map((p, i) => (
                              <View key={i} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                   <Text style={[styles.tableCell, { color: T.text, fontWeight: '600', minWidth: 0 }]} numberOfLines={1} ellipsizeMode="tail">{p.id}</Text>
                                   <View style={[styles.tableCell, { minWidth: 0, paddingRight: 8 }]}>
                                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{p.sender}</Text>
                                        <Text style={{ color: T.subtext, fontSize: 11 }} numberOfLines={1}>→ {p.recipient}</Text>
                                   </View>
                                   <View style={[styles.tableCell, { flex: 1.2, minWidth: 0, paddingRight: 8 }]}>
                                        <Text style={{ color: T.text, fontSize: 12 }} numberOfLines={1}>{p.pickup.split(',')[0]}</Text>
                                        <Text style={{ color: T.subtext, fontSize: 11 }} numberOfLines={1}>to {p.dropoff.split(',')[0]}</Text>
                                   </View>
                                   <View style={[styles.tableCell, { minWidth: 0 }]}>
                                        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[p.status] || '#6C757D') + '22' }]}>
                                             <Text style={{ color: STATUS_COLORS[p.status] || '#6C757D', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                  {p.status}
                                             </Text>
                                        </View>
                                   </View>
                                   <Text style={[styles.tableCell, { color: '#00C853', fontWeight: 'bold', minWidth: 0 }]}>₹{p.price}</Text>
                              </View>
                         ))
                    )}
               </View>
          </ScrollView>
     );
}

const styles = StyleSheet.create({
     container: { flex: 1, padding: 24 },
     header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
     headerTitle: { fontSize: 22, fontWeight: 'bold' },
     headerButtons: { flexDirection: 'row' },
     ghostBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1 },
     ghostBtnText: { fontSize: 13, fontWeight: '600' },
     primaryBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#3B7DDD' },
     primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
     statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
     statCard: { flex: 1, borderRadius: 12, padding: 20, borderWidth: 1 },
     statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
     statLabel: { fontSize: 13, fontWeight: '500' },
     statValue: { fontSize: 28, fontWeight: 'bold' },
     tablePanel: { borderRadius: 12, padding: 24, borderWidth: 1, marginBottom: 100 },
     tableTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
     tableHeader: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1 },
     tableHeaderCell: { flex: 1, fontSize: 12, fontWeight: 'bold' },
     tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
     tableCell: { flex: 1 },
     statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
     emptyState: { padding: 40, alignItems: 'center' },
     mobileCard: { paddingVertical: 14, borderBottomWidth: 1, gap: 6 },
     mobileCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
     mobileCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
