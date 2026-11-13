import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { confirmAction, notify } from '../../utils/notify';

interface UserStats {
     total: number;
     drivers: number;
     passengers: number;
}

interface UserRow {
     id: string;
     name: string;
     phone: string;
     role: string;
     joinedAt: string;
     totalRides: number;
}

const ROLE_COLORS: Record<string, string> = {
     driver: '#28A745',
     passenger: '#3B7DDD',
     admin: '#FCB92C',
};

export default function AdminVisitorsDetailView({ isDark, searchQuery = '' }: { isDark: boolean; searchQuery?: string }) {
     const [userStats, setUserStats] = useState<UserStats | null>(null);
     const [users, setUsers] = useState<UserRow[]>([]);
     const [loading, setLoading] = useState(true);
     const [refreshing, setRefreshing] = useState(false);
     const [cleaningUp, setCleaningUp] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const { fetchWithAuth } = useAuth();
     const fetchWithAuthRef = useRef(fetchWithAuth);
     fetchWithAuthRef.current = fetchWithAuth;
     const abortRef = useRef<AbortController | null>(null);
     const reqIdRef = useRef(0);
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
          const controller = new AbortController();
          abortRef.current = controller;
          const reqId = ++reqIdRef.current;

          if (background) {
               setRefreshing(true);
          } else {
               setLoading(true);
          }
          setError(null);

          try {
               const [statsRes, usersRes] = await Promise.all([
                    fetchWithAuthRef.current(`${API_BASE}/api/admin/stats`, { signal: controller.signal }),
                    fetchWithAuthRef.current(`${API_BASE}/api/admin/users`, { signal: controller.signal }),
               ]);
               if (!statsRes.ok) throw new Error(`Stats error: ${statsRes.status}`);
               if (!usersRes.ok) throw new Error(`Users error: ${usersRes.status}`);
               const [stats, usersData] = await Promise.all([statsRes.json(), usersRes.json()]);
               if (reqId !== reqIdRef.current) return;
               setUserStats(stats?.users ?? null);
               setUsers(Array.isArray(usersData) ? usersData : []);
          } catch (err: any) {
               if (err?.name === 'AbortError' || reqId !== reqIdRef.current) return;
               setError(err?.message || 'Could not load users');
               if (!background) {
                    setUserStats(null);
                    setUsers([]);
               }
          } finally {
               if (reqId === reqIdRef.current) {
                    setLoading(false);
                    setRefreshing(false);
               }
          }
     }, []);

     useEffect(() => {
          fetchData(false);
          return () => {
               reqIdRef.current += 1;
               abortRef.current?.abort();
          };
     }, [fetchData]);

     if (loading && users.length === 0) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     if (error && users.length === 0) {
          return (
               <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                    <Text style={{ color: '#DC3545', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{error}</Text>
                    <TouchableOpacity onPress={() => fetchData(false)} style={styles.primaryBtn}>
                         <Text style={styles.primaryBtnText}>↻ Retry</Text>
                    </TouchableOpacity>
               </View>
          );
     }

     const filteredUsers = users.filter(u =>
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.id?.toLowerCase().includes(searchQuery.toLowerCase())
     );

     const executeCleanupIncomplete = async () => {
          if (cleaningUp) return;
          setCleaningUp(true);
          try {
               const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/users/incomplete`, {
                    method: 'DELETE',
               });
               const data = await res.json();
               if (res.ok) {
                    notify('Cleanup Complete', `Cleaned up ${data.deletedCount ?? 0} abandoned incomplete user registrations (older than 24h).`);
                    await fetchData(true);
               } else {
                    notify('Error', data.error || 'Failed to cleanup incomplete users.');
               }
          } catch {
               notify('Error', 'Network error while cleaning up incomplete users.');
          } finally {
               setCleaningUp(false);
          }
     };

     const handleCleanupIncomplete = () => {
          if (cleaningUp) return;
          confirmAction(
               'Clean Incomplete Registrations',
               'Permanently delete abandoned incomplete user registrations older than 24 hours? This cannot be undone.',
               () => { executeCleanupIncomplete(); },
               'Delete Incomplete',
               'Cancel',
          );
     };

     return (
          <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Visitors / Users Overview</Text>
                    <View style={[styles.headerButtons, { flexWrap: 'wrap', gap: 8 }]}>
                         <TouchableOpacity
                              onPress={() => fetchData(true)}
                              disabled={refreshing || cleaningUp}
                              style={[styles.ghostBtn, { borderColor: T.border }, (refreshing || cleaningUp) && { opacity: 0.6 }]}
                         >
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>{refreshing ? '↻ Refreshing...' : '↻ Refresh'}</Text>
                         </TouchableOpacity>
                         <TouchableOpacity
                              onPress={handleCleanupIncomplete}
                              disabled={cleaningUp || refreshing}
                              style={[styles.ghostBtn, { borderColor: '#E53E3E', backgroundColor: 'rgba(229, 62, 62, 0.08)' }, (cleaningUp || refreshing) && { opacity: 0.6 }]}
                         >
                              <Text style={[styles.ghostBtnText, { color: '#E53E3E' }]}>{cleaningUp ? '🧹 Cleaning...' : '🧹 Clean Incomplete'}</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(filteredUsers, 'Users_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export CSV</Text>
                         </TouchableOpacity>
                    </View>
               </View>
               {error && (
                    <Text style={{ color: '#DC3545', fontSize: 12, marginBottom: 12 }}>Refresh failed: {error}</Text>
               )}

               {/* KPI cards */}
               <View style={[styles.cardsRow, isMobile && { gap: 12 }]}>
                    {[
                         { label: 'Total Users', count: userStats?.total ?? 0, icon: '👥', color: '#3B7DDD' },
                         { label: 'Drivers', count: userStats?.drivers ?? 0, icon: '🚗', color: '#28A745' },
                         { label: 'Passengers', count: userStats?.passengers ?? 0, icon: '🧳', color: '#FCB92C' },
                    ].map(card => (
                         <View key={card.label} style={[styles.statCard, isMobile && { minWidth: 140, padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                              <Text style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</Text>
                              <Text style={{ color: card.color, fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
                                   {card.count.toLocaleString()}
                              </Text>
                              <Text style={{ color: T.subtext, fontSize: 13 }}>{card.label}</Text>
                         </View>
                    ))}
               </View>

               {/* User Table */}
               <View style={[styles.tablePanel, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>User Registry</Text>

                    {!isMobile && (
                         <View style={[styles.tableHeader, { borderBottomColor: T.border }]}>
                              {['Name', 'Phone', 'Role', 'Total Rides'].map(h => (
                                   <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                              ))}
                         </View>
                    )}

                    {filteredUsers.length === 0 ? (
                         <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>No users found.</Text>
                    ) : (
                         filteredUsers.map((u, i) => {
                              const isIncomplete = !u.name || !u.role;
                              const displayName = u.name ? u.name : '(Incomplete Profile)';
                              const displayRole = u.role ? u.role : 'Pending Setup';
                              const roleColor = u.role ? (ROLE_COLORS[u.role] ?? '#6C757D') : '#E53E3E';

                              if (isMobile) {
                                   return (
                                        <View key={u.id || i} style={[styles.mobileUserCard, { borderBottomColor: T.border }]}>
                                             <View style={styles.mobileUserTop}>
                                                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 10 }}>
                                                       <View style={[styles.avatar, { backgroundColor: roleColor + '22', flexShrink: 0 }]}>
                                                            <Text style={{ color: roleColor, fontWeight: 'bold' }}>{(u.name || 'U')[0].toUpperCase()}</Text>
                                                       </View>
                                                       <Text
                                                            style={{ color: isIncomplete ? '#E53E3E' : T.text, fontWeight: '600', fontSize: 14, flex: 1, minWidth: 0, fontStyle: isIncomplete ? 'italic' : 'normal' }}
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                       >
                                                            {displayName}
                                                       </Text>
                                                  </View>
                                                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', flexShrink: 0 }]}>
                                                       <Text style={{ color: roleColor, fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize' }}>
                                                            {displayRole}
                                                       </Text>
                                                  </View>
                                             </View>
                                             <View style={styles.mobileUserMeta}>
                                                  <Text style={{ color: T.subtext, fontSize: 13 }} numberOfLines={1}>📞 {u.phone || '—'}</Text>
                                                  <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>Rides: {u.totalRides}</Text>
                                             </View>
                                        </View>
                                   );
                              }

                              return (
                                   <View key={u.id || i} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                        <View style={[styles.cell, { flexDirection: 'row', alignItems: 'center', minWidth: 0, paddingRight: 8 }]}>
                                             <View style={[styles.avatar, { backgroundColor: roleColor + '22', flexShrink: 0 }]}>
                                                  <Text style={{ color: roleColor, fontWeight: 'bold' }}>{(u.name || 'U')[0].toUpperCase()}</Text>
                                             </View>
                                             <Text
                                                  style={{ color: isIncomplete ? '#E53E3E' : T.text, fontWeight: '500', marginLeft: 10, flex: 1, minWidth: 0, fontStyle: isIncomplete ? 'italic' : 'normal' }}
                                                  numberOfLines={1}
                                                  ellipsizeMode="tail"
                                             >
                                                  {displayName}
                                             </Text>
                                        </View>
                                        <Text style={[styles.cell, { color: T.subtext, minWidth: 0, paddingRight: 8 }]} numberOfLines={1} ellipsizeMode="tail">{u.phone}</Text>
                                        <View style={[styles.cell, { minWidth: 0 }]}>
                                             <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
                                                  <Text style={{ color: roleColor, fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize' }}>
                                                       {displayRole}
                                                  </Text>
                                             </View>
                                        </View>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold', minWidth: 0 }]}>{u.totalRides}</Text>
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
     cardsRow: { flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
     statCard: {
          flex: 1, minWidth: 160, borderRadius: 12, padding: 24, borderWidth: 1,
          alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
     },
     tablePanel: { borderRadius: 12, padding: 24, borderWidth: 1, marginBottom: 100 },
     tableTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
     tableHeader: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1 },
     tableHeaderCell: { flex: 1, fontSize: 12, fontWeight: 'bold' },
     tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
     cell: { flex: 1 },
     avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
     roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
     mobileUserCard: { paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
     mobileUserTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
     mobileUserMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 42 },
});
