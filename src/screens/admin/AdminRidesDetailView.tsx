import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import AdminChart from '../../components/AdminChart';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { parseJsonSafe, createRequestAbort } from '../../utils/json';

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
     rides: { total: number; available: number; ongoing?: number; completed: number; cancelled: number };
     monthlyTrend: { month: string; rides: number }[];
     trends?: { month: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
     available: '#28A745',
     ongoing: '#F59E0B',
     completed: '#3B7DDD',
     cancelled: '#DC3545',
};

type RideTab = 'available' | 'ongoing' | 'completed' | 'cancelled' | 'all';

export default function AdminRidesDetailView({ isDark, searchQuery = '', initialTab = 'all' }: { isDark: boolean; searchQuery?: string; initialTab?: RideTab }) {
     const [rides, setRides] = useState<RideRow[]>([]);
     const [statsData, setStatsData] = useState<StatsData | null>(null);
     const [loading, setLoading] = useState(true);
     const [refreshing, setRefreshing] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [selectedTab, setSelectedTab] = useState<RideTab>(initialTab);
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
          border: isDark ? 'rgba(255,255,255,0.1)' : '#DEE2E6',
          accent: '#3B7DDD',
     };

     const fetchData = useCallback(async (background = false) => {
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
               const [ridesRes, statsRes] = await Promise.all([
                    fetchWithAuthRef.current(`${API_BASE}/api/admin/rides`, { signal: controller.signal }),
                    fetchWithAuthRef.current(`${API_BASE}/api/admin/stats`, { signal: controller.signal }),
               ]);
               if (!ridesRes.ok) throw new Error(`Rides error: ${ridesRes.status}`);
               if (!statsRes.ok) throw new Error(`Stats error: ${statsRes.status}`);
               const [ridesData, stats] = await Promise.all([
                    parseJsonSafe<RideRow[]>(ridesRes),
                    parseJsonSafe<StatsData>(statsRes),
               ]);
               if (!isMountedRef.current || reqId !== reqIdRef.current) return;
               setRides(Array.isArray(ridesData) ? ridesData : []);
               setStatsData(stats);
          } catch (err: any) {
               if (!isMountedRef.current || reqId !== reqIdRef.current) return;
               if (err?.name === 'AbortError' && !didTimeout()) return;
               setError(didTimeout() ? 'Request timed out while loading ride data' : (err?.message || 'Could not load ride data'));
               if (!background) {
                    setRides([]);
                    setStatsData(null);
               }
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
          fetchData(false);
          return () => {
               isMountedRef.current = false;
               reqIdRef.current += 1;
               abortRef.current?.abort();
          };
     }, [fetchData]);

     const filteredRides = rides.filter(r => {
          const matchesSearch = (r.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
               (r.driver || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
               (r.route || '').toLowerCase().includes(searchQuery.toLowerCase());
          const matchesTab = selectedTab === 'all' || r.status === selectedTab;
          return matchesSearch && matchesTab;
     });

     const totalRides = statsData?.rides?.total ?? rides.length;
     const available = statsData?.rides?.available ?? rides.filter(r => r.status === 'available').length;
     const ongoing = statsData?.rides?.ongoing ?? rides.filter(r => r.status === 'ongoing').length;
     const completed = statsData?.rides?.completed ?? rides.filter(r => r.status === 'completed').length;
     const cancelled = statsData?.rides?.cancelled ?? rides.filter(r => r.status === 'cancelled').length;

     const trendData = (statsData?.monthlyTrend || statsData?.trends || []).map((m: any) => typeof m.rides === 'number' ? m.rides : (typeof m.count === 'number' ? m.count : 0));
     const trendLabels = (statsData?.monthlyTrend || statsData?.trends || []).map((m: any) => m.month || '');

     const tabs = [
          { id: 'all', label: 'All Rides', count: totalRides, color: '#3B7DDD', icon: '🚙' },
          { id: 'available', label: 'Available', count: available, color: '#28A745', icon: '✅' },
          { id: 'ongoing', label: 'Ongoing', count: ongoing, color: '#F59E0B', icon: '🚗' },
          { id: 'completed', label: 'Completed', count: completed, color: '#6C757D', icon: '🏁' },
          { id: 'cancelled', label: 'Cancelled', count: cancelled, color: '#DC3545', icon: '❌' },
     ] as const;

     if (loading && rides.length === 0) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     if (error && rides.length === 0) {
          return (
               <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                    <Text style={{ color: '#DC3545', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{error}</Text>
                    <TouchableOpacity onPress={() => fetchData(false)} style={styles.primaryBtn}>
                         <Text style={styles.primaryBtnText}>↻ Retry</Text>
                    </TouchableOpacity>
               </View>
          );
     }

     return (
          <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Rides Overview</Text>
                    <View style={[styles.headerButtons, { flexWrap: 'wrap', gap: 10 }]}>
                         <TouchableOpacity
                              onPress={() => fetchData(true)}
                              disabled={refreshing}
                              style={[styles.ghostBtn, { borderColor: T.border }, refreshing && { opacity: 0.6 }]}
                         >
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>{refreshing ? '↻ Refreshing...' : '↻ Refresh'}</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(filteredRides, 'Rides_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export Report</Text>
                         </TouchableOpacity>
                    </View>
               </View>
               {error && (
                    <Text style={{ color: '#DC3545', fontSize: 12, marginBottom: 12 }}>Refresh failed: {error}</Text>
               )}

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
                    <View style={[styles.graphPanel, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                         <View style={styles.graphHeader}>
                              <View style={{ flex: 1, minWidth: 0 }}>
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
               <View style={[styles.tablePanel, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>
                         Ride Records {selectedTab !== 'all' ? `— ${selectedTab}` : ''} ({filteredRides.length})
                    </Text>
                    {!isMobile && (
                         <View style={styles.tableHeader}>
                              {['Route', 'Driver', 'Date / Time', 'Seats', 'Price', 'Status'].map(h => (
                                   <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                              ))}
                         </View>
                    )}
                    {filteredRides.length === 0 ? (
                         <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>No rides found</Text>
                    ) : isMobile ? (
                         filteredRides.map(r => {
                              const statusColor = STATUS_COLORS[r.status] ?? '#6C757D';
                              return (
                                   <View key={r.id} style={[styles.mobileCard, { borderBottomColor: T.border }]}>
                                        <View style={styles.mobileCardTop}>
                                             <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14, flex: 1, minWidth: 0 }} numberOfLines={2}>
                                                  {r.route}
                                             </Text>
                                             <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                                  <Text style={{ color: statusColor, fontSize: 11, fontWeight: 'bold' }}>{r.status}</Text>
                                             </View>
                                        </View>
                                        <View style={styles.mobileCardRow}>
                                             <Text style={{ color: T.text, fontSize: 13, flex: 1, minWidth: 0 }} numberOfLines={1}>
                                                  Driver: {r.driver || '—'}
                                             </Text>
                                             <Text style={{ color: T.subtext, fontSize: 12 }}>
                                                  {r.date} • {r.departureTime}
                                             </Text>
                                        </View>
                                        <View style={styles.mobileCardRow}>
                                             <Text style={{ color: T.subtext, fontSize: 12 }}>
                                                  Seats: <Text style={{ color: T.text, fontWeight: '600' }}>{r.seatsBooked}/{r.seatsTotal}</Text>
                                             </Text>
                                             <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14 }}>₹{r.pricePerSeat}</Text>
                                        </View>
                                   </View>
                              );
                         })
                    ) : (
                         filteredRides.map(r => {
                              const statusColor = STATUS_COLORS[r.status] ?? '#6C757D';
                              return (
                                   <View key={r.id} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold', minWidth: 0, paddingRight: 8 }]} numberOfLines={1} ellipsizeMode="tail">{r.route}</Text>
                                        <Text style={[styles.cell, { color: T.text, minWidth: 0, paddingRight: 8 }]} numberOfLines={1} ellipsizeMode="tail">{r.driver || '—'}</Text>
                                        <Text style={[styles.cell, { color: T.subtext, fontSize: 12, minWidth: 0 }]}>{r.date}{'\n'}{r.departureTime}</Text>
                                        <Text style={[styles.cell, { color: T.text, minWidth: 0 }]}>{r.seatsBooked}/{r.seatsTotal}</Text>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold', minWidth: 0 }]}>₹{r.pricePerSeat}</Text>
                                        <View style={[styles.cellStatus, { minWidth: 0 }]}>
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
     mobileCard: { paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
     mobileCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
     mobileCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
