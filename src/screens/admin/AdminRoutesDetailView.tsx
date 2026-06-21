import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

interface RouteRow {
     id: string;
     route: string;
     bookings: number;
     cancellations: number;
     topDriver: string;
     avgPrice: number;
     status: string;
}

interface StatsRow {
     id: string;
     label: string;
     count: string;
     icon: string;
     color: string;
}

const STATUS_COLORS: Record<string, string> = {
     'High Traffic': '#FCB92C',
     'Volatile': '#DC3545',
     'Normal': '#28A745',
};

export default function AdminRoutesDetailView({ isDark, searchQuery = '' }: { isDark: boolean; searchQuery?: string }) {
     const [routes, setRoutes] = useState<RouteRow[]>([]);
     const [loading, setLoading] = useState(true);
     const { fetchWithAuth } = useAuth();

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
          fetchWithAuth(`${API_BASE}/api/admin/routes`)
               .then(r => r.json())
               .then(d => setRoutes(Array.isArray(d) ? d : []))
               .catch(() => setRoutes([]))
               .finally(() => setLoading(false));
     };

     useEffect(() => { fetchData(); }, []);

     const filteredRoutes = routes.filter(r =>
          r.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.topDriver.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase())
     );

     // Derived stats from real data
     const totalBookings = routes.reduce((s, r) => s + r.bookings, 0);
     const totalCancels = routes.reduce((s, r) => s + r.cancellations, 0);
     const uniqueRoutes = routes.length;
     const avgPrice = routes.length > 0 ? Math.round(routes.reduce((s, r) => s + r.avgPrice, 0) / routes.length) : 0;

     const statCards: StatsRow[] = [
          { id: 'bookings', label: 'Total Bookings', count: totalBookings.toLocaleString(), icon: '📈', color: '#3B7DDD' },
          { id: 'cancels', label: 'Cancellations', count: totalCancels.toLocaleString(), icon: '🚫', color: '#DC3545' },
          { id: 'routes', label: 'Active Routes', count: String(uniqueRoutes), icon: '🛣️', color: '#28A745' },
          { id: 'price', label: 'Avg. Price', count: `₹${avgPrice}`, icon: '💰', color: '#FCB92C' },
     ];

     if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     return (
          <ScrollView style={[styles.container, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Route Analytics</Text>
                    <View style={styles.headerButtons}>
                         <TouchableOpacity onPress={fetchData} style={[styles.ghostBtn, { borderColor: T.border }]}>
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>↻ Refresh</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(routes, 'Routes_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export Analysis</Text>
                         </TouchableOpacity>
                    </View>
               </View>

               {/* KPI Cards */}
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                         {statCards.map(s => (
                              <View key={s.id} style={[styles.statCard, { backgroundColor: T.card, borderColor: T.border }]}>
                                   <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <Text style={[styles.cardLabel, { color: T.subtext }]}>{s.label}</Text>
                                        <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                                   </View>
                                   <Text style={[styles.cardValue, { color: s.color }]}>{s.count}</Text>
                              </View>
                         ))}
                    </View>
               </ScrollView>

               {/* Routes Table */}
               <View style={[styles.tablePanel, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>
                         Route Breakdown — {filteredRoutes.length} corridor{filteredRoutes.length !== 1 ? 's' : ''}
                    </Text>
                    <View style={styles.tableHeader}>
                         {['Route', 'Bookings', 'Cancels', 'Top Driver', 'Avg Price', 'Status'].map(h => (
                              <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                         ))}
                    </View>
                    {filteredRoutes.length === 0 ? (
                         <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>
                              No route data yet. Routes are generated from posted rides.
                         </Text>
                    ) : (
                         filteredRoutes.map(r => {
                              const statusColor = STATUS_COLORS[r.status] ?? '#6C757D';
                              return (
                                   <View key={r.id} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold', flex: 2 }]} numberOfLines={2}>{r.route}</Text>
                                        <Text style={[styles.cell, { color: '#28A745', fontWeight: 'bold' }]}>{r.bookings}</Text>
                                        <Text style={[styles.cell, { color: '#DC3545', fontWeight: 'bold' }]}>{r.cancellations}</Text>
                                        <Text style={[styles.cell, { color: T.text }]}>{r.topDriver || '—'}</Text>
                                        <Text style={[styles.cell, { color: T.text }]}>₹{Math.round(r.avgPrice)}</Text>
                                        <View style={{ flex: 1 }}>
                                             <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                                  <Text style={{ color: statusColor, fontSize: 11, fontWeight: 'bold' }}>{r.status}</Text>
                                             </View>
                                        </View>
                                   </View>
                              );
                         })
                    )}
               </View>
          </ScrollView>
     );
}

const styles = StyleSheet.create({
     container: { flex: 1, padding: 24 },
     header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
     headerTitle: { fontSize: 22, fontWeight: 'bold' },
     headerButtons: { flexDirection: 'row', gap: 12 },
     ghostBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1 },
     ghostBtnText: { fontSize: 13, fontWeight: '600' },
     primaryBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#3B7DDD' },
     primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
     statCard: { width: 180, borderRadius: 12, padding: 18, borderWidth: 1 },
     cardLabel: { fontSize: 13, fontWeight: '500' },
     cardValue: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
     tablePanel: { borderRadius: 12, padding: 24, marginTop: 24, borderWidth: 1, marginBottom: 100 },
     tableTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
     tableHeader: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
     tableHeaderCell: { flex: 1, fontSize: 12, fontWeight: 'bold' },
     tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
     cell: { flex: 1, fontSize: 13 },
     statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
