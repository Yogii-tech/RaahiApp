import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

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
          Promise.all([
               fetchWithAuth(`${API_BASE}/api/admin/stats`).then(r => r.json()),
               fetchWithAuth(`${API_BASE}/api/admin/users`).then(r => r.json()),
          ])
               .then(([stats, usersData]) => {
                    setUserStats(stats?.users ?? null);
                    setUsers(Array.isArray(usersData) ? usersData : []);
               })
               .catch(() => { setUserStats(null); setUsers([]); })
               .finally(() => setLoading(false));
     };

     useEffect(() => { fetchData(); }, []);

     if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

     const filteredUsers = users.filter(u =>
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.id?.toLowerCase().includes(searchQuery.toLowerCase())
     );

     return (
          <ScrollView style={[styles.container, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false}>
               <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: T.text }]}>Visitors / Users Overview</Text>
                    <View style={styles.headerButtons}>
                         <TouchableOpacity onPress={fetchData} style={[styles.ghostBtn, { borderColor: T.border }]}>
                              <Text style={[styles.ghostBtnText, { color: T.text }]}>↻ Refresh</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => downloadCSV(users, 'Users_Report')} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Export CSV</Text>
                         </TouchableOpacity>
                    </View>
               </View>

               {/* KPI cards */}
               <View style={styles.cardsRow}>
                    {[
                         { label: 'Total Users', count: userStats?.total ?? 0, icon: '👥', color: '#3B7DDD' },
                         { label: 'Drivers', count: userStats?.drivers ?? 0, icon: '🚗', color: '#28A745' },
                         { label: 'Passengers', count: userStats?.passengers ?? 0, icon: '🧳', color: '#FCB92C' },
                    ].map(card => (
                         <View key={card.label} style={[styles.statCard, { backgroundColor: T.card, borderColor: T.border }]}>
                              <Text style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</Text>
                              <Text style={{ color: card.color, fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
                                   {card.count.toLocaleString()}
                              </Text>
                              <Text style={{ color: T.subtext, fontSize: 13 }}>{card.label}</Text>
                         </View>
                    ))}
               </View>

               {/* User Table */}
               <View style={[styles.tablePanel, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.tableTitle, { color: T.text }]}>User Registry</Text>

                    <View style={[styles.tableHeader, { borderBottomColor: T.border }]}>
                         {['Name', 'Phone', 'Role', 'Total Rides'].map(h => (
                              <Text key={h} style={[styles.tableHeaderCell, { color: T.subtext }]}>{h}</Text>
                         ))}
                    </View>

                    {filteredUsers.length === 0 ? (
                         <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>No users found.</Text>
                    ) : (
                         filteredUsers.map((u, i) => {
                              const roleColor = ROLE_COLORS[u.role] ?? '#6C757D';
                              return (
                                   <View key={i} style={[styles.tableRow, { borderBottomColor: T.border }]}>
                                        <View style={[styles.cell, { flexDirection: 'row', alignItems: 'center' }]}>
                                             <View style={[styles.avatar, { backgroundColor: roleColor + '22' }]}>
                                                  <Text style={{ color: roleColor, fontWeight: 'bold' }}>{(u.name || 'U')[0].toUpperCase()}</Text>
                                             </View>
                                             <Text style={{ color: T.text, fontWeight: '500', marginLeft: 10 }}>{u.name}</Text>
                                        </View>
                                        <Text style={[styles.cell, { color: T.subtext }]}>{u.phone}</Text>
                                        <View style={styles.cell}>
                                             <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
                                                  <Text style={{ color: roleColor, fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize' }}>{u.role}</Text>
                                             </View>
                                        </View>
                                        <Text style={[styles.cell, { color: T.text, fontWeight: 'bold' }]}>{u.totalRides}</Text>
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
});
