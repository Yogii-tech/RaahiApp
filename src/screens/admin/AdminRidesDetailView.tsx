import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import AdminChart from '../../components/AdminChart';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

interface RideRow {
     id: string;
     driver: string;
     route: string;
     date: string;
     departureTime: string;
     seatsTotal: number;
     seatsBooked: number;
     pricePerSeat: number;
     status: string;
     distanceKm: number;
}

interface StatsData {
     rides: { total: number; available: number; completed: number; cancelled: number };
     monthlyTrend: { month: string; rides: number }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_COLORS: Record<string, string> = {
     available: '#28A745',
     completed: '#3B7DDD',
     cancelled: '#DC3545',
};

export default function AdminRidesDetailView({ isDark, searchQuery = '' }: { isDark: boolean; searchQuery?: string }) {
     const [rides, setRides] = useState<RideRow[]>([]);
     const [statsData, setStatsData] = useState<StatsData | null>(null);
     const [loading, setLoading] = useState(true);
     const [selectedTab, setSelectedTab] = useState<'available' | 'completed' | 'cancelled' | 'all'>('all');
     const [timeFrame, setTimeFrame] = useState<'Monthly' | 'Daily'>('Monthly');
     const { fetchWithAuth } = useAuth();
     const { width } = useWindowDimensions();

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
               fetchWithAuth(`${API_BASE}/api/admin/rides`).then(r => r.json()),
               fetchWithAuth(`${API_BASE}/api/admin/stats`).then(r => r.json()),
          ])
               .then(([ridesData, stats]) => {
                    setRides(Array.isArray(ridesData) ? ridesData : []);
                    setStatsData(stats);
               })
               .catch(() => { setRides([]); })
               .finally(() => setLoading(false));
     };

     useEffect(() => { fetchData(); }, []);

     const filteredRides = rides.filter(r => {
          const matchesSearch = r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
               r.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
               r.route.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesTab = selectedTab === 'all' || r.status === selectedTab;
          return matchesSearch && matchesTab;
     });

     const totalRides = statsData?.rides.total ?? rides.length;
     const available = statsData?.rides.available ?? rides.filter(r => r.status === 'available').length;
     const completed = statsData?.rides.completed ?? rides.filter(r => r.status === 'completed').length;
     const cancelled = statsData?.rides.cancelled ?? rides.filter(r => r.status === 'cancelled').length;

     const trendData = statsData?.monthlyTrend?.map(m => m.rides) ?? [];
     const trendLabels = statsData?.monthlyTrend?.map(m => m.month) ?? [];

     const tabs = [
          { id: 'all', label: 'All Rides', count: totalRides, color: '#3B7DDD', icon: '🚙' },
          { id: 'available', label: 'Available', count: available, color: '#28A745', icon: '✅' },
          { id: 'completed', label: 'Completed', count: completed, color: '#6C757D', icon: '🏁' },
          { id: 'cancelled', label: 'Cancelled', count: cancelled, color: '#DC3545', icon: '❌' },
     ] as const;

     if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     return (
          <ScrollView style={[styles.container, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Rides Overview</Text>
                    <View style={styles.headerButtons}>
                         <TouchableOpacity onPress={fetchData} style={[styles.ghostBtn, { borderColor: T.border }]}>
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>↻ Refresh</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(rides, 'Rides_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export Report</Text>
                         </TouchableOpacity>
                    </View>
               </View>

               {/* Stat Cards */}
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
                    <View style={styles.statsRow}>
                         {tabs.map(s => {
                              const isActive = selectedTab === s.id;
                              return (
                                   <TouchableOpacity
                                        key={s.id}
                                        activeOpacity={0.8}
                                        onPress={() => setSelectedTab(s.id)}
                                        style={[styles.statCard, { backgroundColor: T.card, borderColor: isActive ? s.color : T.border }, isActive && styles.activeCard]}>
                                        <View style={styles.cardTop}>
                                             <View>
                                                  <Text style={[styles.cardLabel, { color: T.subtext }]}>{s.label}</Text>
                                                  <Text style={[styles.cardValue, { color: T.text }]}>{s.count.toLocaleString()}</Text>
                                             </View>
                                             <Text style={styles.cardIcon}>{s.icon}</Text>
                                        </View>
                                   </TouchableOpacity>
                              );
                         })}
                    </View>
               </ScrollView>

               {/* Trend Chart */}
               {trendData.length > 0 && (
                    <View style={[styles.graphPanel, { backgroundColor: T.card, borderColor: T.border }]}>
                         <View style={styles.graphHeader}>
                              <View>
                                   <Text style={[styles.graphTitle, { color: T.text }]}>Ride Volume — Last 6 Months</Text>
                                   <Text style={[styles.graphSubtitle, { color: T.subtext }]}>Real data from database</Text>
                              </View>
                         </View>
                         <View style={styles.chartArea}>
                              <AdminChart
                                   data={trendData}
                                   labels={trendLabels}
                                   accentColor="#3B7DDD"
                                   isDark={isDark}
                              />
                         </View>
                    </View>
               )}

               {/* Rides Table */}
               <View style={[styles.tablePanel, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>
                         Ride Records {selectedTab !== 'all' ? `— ${selectedTab}` : ''} ({filteredRides.length})
                    </Text>
                    <View style={styles.tableHeader}>
                         {['Route', 'Driver', 'Date / Time', 'Seats', 'Price', 'Status'].map(h => (
                              <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                         ))}
                    </View>
                    {filteredRides.length === 0 ? (
                         <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>No rides found</Text>
                    ) : (
                         filteredRides.map(r => {
                              const statusColor = STATUS_COLORS[r.status] ?? '#6C757D';
                              return (
                                   <View key={r.id} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold' }]} numberOfLines={1}>{r.route}</Text>
                                        <Text style={[styles.cell, { color: T.text }]}>{r.driver || '—'}</Text>
                                        <Text style={[styles.cell, { color: T.subtext, fontSize: 12 }]}>{r.date}{'\n'}{r.departureTime}</Text>
                                        <Text style={[styles.cell, { color: T.text }]}>{r.seatsBooked}/{r.seatsTotal}</Text>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold' }]}>₹{r.pricePerSeat}</Text>
                                        <View style={styles.cellStatus}>
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
     statsScroll: { paddingBottom: 10 },
     statsRow: { flexDirection: 'row', gap: 16 },
     statCard: { width: 180, borderRadius: 12, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
     activeCard: { borderWidth: 2, shadowOpacity: 0.1 },
     cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
     cardLabel: { fontSize: 13, fontWeight: '500' },
     cardValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
     cardIcon: { fontSize: 20 },
     graphPanel: { borderRadius: 12, padding: 24, marginTop: 24, borderWidth: 1 },
     graphHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
     graphTitle: { fontSize: 16, fontWeight: 'bold' },
     graphSubtitle: { fontSize: 12, marginTop: 4 },
     chartArea: { height: 220, paddingBottom: 20 },
     tablePanel: { borderRadius: 12, padding: 24, marginTop: 24, borderWidth: 1, marginBottom: 100 },
     tableTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
     tableHeader: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
     tableHeaderCell: { flex: 1, fontSize: 12, fontWeight: 'bold' },
     tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
     cell: { flex: 1, fontSize: 13 },
     cellStatus: { flex: 1 },
     statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
