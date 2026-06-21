import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions, Platform, TouchableOpacity, Alert } from 'react-native';
import AdminChart from '../../components/AdminChart';
import { downloadCSV } from '../../utils/exportUtils';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

interface AdminStatsData {
    rides: { total: number; available: number; completed: number; cancelled: number };
    bookings: { total: number; pending: number; accepted: number; rejected: number };
    users: { total: number; drivers: number; passengers: number };
    routes: number;
    monthlyTrend: { month: string; rides: number }[];
}

export default function AdminDashboardView({ token, onNavigateToRides, onNavigateToParcels, onNavigateToVisitors, onNavigateToRoutes }: {
    token: string;
    onNavigateToRides?: () => void;
    onNavigateToParcels?: () => void;
    onNavigateToVisitors?: () => void;
    onNavigateToRoutes?: () => void;
}) {
    const [stats, setStats] = useState<AdminStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewDate, setViewDate] = useState(new Date());
    const { fetchWithAuth } = useAuth();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const isDark = true;
    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
    };

    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        fetchWithAuth(`${API_BASE}/api/admin/stats`)
            .then(r => {
                clearTimeout(timeout);
                if (!r.ok) throw new Error(`Server error: ${r.status}`);
                return r.json();
            })
            .then((d: AdminStatsData) => setStats(d))
            .catch((err: any) => {
                clearTimeout(timeout);
                if (err?.name === 'AbortError') {
                    setError('Backend not responding. Is the server running?');
                } else {
                    setError(`Could not load stats (${err?.message ?? 'network error'})`);
                }
            })
            .finally(() => setLoading(false));

        return () => { clearTimeout(timeout); controller.abort(); };
    }, []);

    // Calendar
    const currentMonthLabel = viewDate.toLocaleString('default', { month: 'long' });
    const currentYear = viewDate.getFullYear();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const padding = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const calendarDays = padding.concat(days);
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

    if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    if (error) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
            <Text style={{ color: '#DC3545', fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                {error}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                The admin dashboard requires the backend server to be running.{'\n'}
                Open a terminal in the <Text style={{ color: '#F9FAFB', fontFamily: 'monospace' }}>Raahi/</Text> folder and run:
            </Text>
            <View style={{ backgroundColor: '#0D1117', borderRadius: 8, padding: 16, marginBottom: 24, width: '100%', maxWidth: 400 }}>
                <Text style={{ color: '#00FF88', fontFamily: 'monospace', fontSize: 14 }}>go run main.go</Text>
                <Text style={{ color: '#6B7280', fontFamily: 'monospace', fontSize: 12, marginTop: 6 }}>
                    # or double-click raahi-backend.exe
                </Text>
            </View>
            <TouchableOpacity
                style={{ backgroundColor: '#3B7DDD', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                onPress={() => {
                    setLoading(true);
                    setError(null);
                    const controller = new AbortController();
                    const t = setTimeout(() => controller.abort(), 10000);
                    fetchWithAuth(`${API_BASE}/api/admin/stats`)
                        .then(r => { clearTimeout(t); if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
                        .then((d: AdminStatsData) => setStats(d))
                        .catch((err: any) => { clearTimeout(t); setError(err?.name === 'AbortError' ? 'Backend not responding. Is the server running?' : `Could not load stats (${err?.message ?? 'network error'})`); })
                        .finally(() => setLoading(false));
                }}
            >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>↻ Retry Connection</Text>
            </TouchableOpacity>
        </View>
    );

    const statCards = [
        {
            id: 'rides', label: 'Rides', icon: '🚙',
            value: stats?.rides.total ?? 0,
            sub: `${stats?.rides.available ?? 0} active`,
            onPress: onNavigateToRides,
        },
        {
            id: 'bookings', label: 'Bookings', icon: '🎫',
            value: stats?.bookings.total ?? 0,
            sub: `${stats?.bookings.pending ?? 0} pending`,
            onPress: onNavigateToParcels,
        },
        {
            id: 'users', label: 'Users', icon: '👥',
            value: stats?.users.total ?? 0,
            sub: `${stats?.users.drivers ?? 0} drivers`,
            onPress: onNavigateToVisitors,
        },
        {
            id: 'routes', label: 'Routes', icon: '🗺️',
            value: stats?.routes ?? 0,
            sub: 'unique corridors',
            onPress: onNavigateToRoutes,
        },
    ];

    const trendLabels = stats?.monthlyTrend?.map(m => m.month) ?? [];
    const trendData = stats?.monthlyTrend?.map(m => m.rides) ?? [];

    const exportData = statCards.map(c => ({ label: c.label, value: c.value, sub: c.sub }));

    return (
        <ScrollView style={[styles.container, { backgroundColor: T.bg }]} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: T.text }]}>Analytics Dashboard</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity
                        style={[styles.ghostBtn, { backgroundColor: T.card, borderColor: T.border }]}
                        onPress={() => {
                            setLoading(true); setError(null);
                            fetchWithAuth(`${API_BASE}/api/admin/stats`).then(r => r.json()).then(setStats).catch(() => setError('Could not load')).finally(() => setLoading(false));
                        }}
                    >
                        <Text style={[styles.ghostBtnText, { color: T.text }]}>↻ Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => downloadCSV(exportData, 'Dashboard_Summary')}
                    >
                        <Text style={styles.primaryBtnText}>Export Report</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainGrid}>
                {/* KPI Cards */}
                <View style={[styles.statsColumn, isMobile && { width: '100%' }]}>
                    <View style={styles.statsWrap}>
                        {statCards.map((card, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.miniCard, { backgroundColor: T.card }]}
                                onPress={card.onPress}
                            >
                                <View style={styles.miniCardHeader}>
                                    <Text style={[styles.miniCardLabel, { color: T.subtext }]}>{card.label}</Text>
                                    <View style={[styles.miniIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F8' }]}>
                                        <Text>{card.icon}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.miniCardValue, { color: T.text }]}>{card.value.toLocaleString()}</Text>
                                <Text style={[styles.miniCardSub, { color: T.subtext }]}>{card.sub}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Trend Chart — Real monthly ride data */}
                {!isMobile && trendData.length > 0 && (
                    <View style={styles.chartColumn}>
                        <View style={[styles.largeCard, { backgroundColor: T.card }]}>
                            <View style={styles.largeCardHeader}>
                                <Text style={[styles.largeCardTitle, { color: T.text }]}>Rides — Last 6 Months</Text>
                            </View>
                            <View style={styles.chartContent}>
                                <AdminChart
                                    data={trendData}
                                    labels={trendLabels}
                                    accentColor="#3B7DDD"
                                    isDark={isDark}
                                    height={150}
                                />
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {/* Row 2: Booking breakdown + Calendar */}
            <View style={styles.bottomGrid}>
                {/* Booking Status Breakdown */}
                <View style={[styles.detailCard, { flex: 1.5, backgroundColor: T.card }]}>
                    <Text style={[styles.detailTitle, { color: T.text }]}>Booking Breakdown</Text>
                    {[
                        { label: 'Pending', count: stats?.bookings.pending ?? 0, color: '#FCB92C' },
                        { label: 'Accepted', count: stats?.bookings.accepted ?? 0, color: '#28A745' },
                        { label: 'Rejected', count: stats?.bookings.rejected ?? 0, color: '#DC3545' },
                    ].map(item => {
                        const total = stats?.bookings.total || 1;
                        const pct = Math.round((item.count / total) * 100);
                        return (
                            <View key={item.label} style={{ marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ color: T.subtext, fontSize: 13 }}>{item.label}</Text>
                                    <Text style={{ color: item.color, fontWeight: 'bold', fontSize: 13 }}>{item.count}</Text>
                                </View>
                                <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E9ECEF' }}>
                                    <View style={{ height: 6, borderRadius: 3, backgroundColor: item.color, width: `${pct}%` as any }} />
                                </View>
                            </View>
                        );
                    })}

                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: T.subtext, fontSize: 12 }}>Drivers</Text>
                            <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 12 }}>{stats?.users.drivers ?? 0}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ color: T.subtext, fontSize: 12 }}>Passengers</Text>
                            <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 12 }}>{stats?.users.passengers ?? 0}</Text>
                        </View>
                    </View>
                </View>

                {/* Calendar */}
                <View style={[styles.detailCard, { flex: 1.2, backgroundColor: T.card }]}>
                    <Text style={[styles.detailTitle, { color: T.text }]}>Calendar</Text>
                    <View style={styles.calendarMock}>
                        <View style={styles.calendarHeaderRow}>
                            <TouchableOpacity onPress={prevMonth}><Text style={[styles.calArrow, { color: T.subtext }]}>‹</Text></TouchableOpacity>
                            <Text style={[styles.calendarHeader, { color: T.text }]}>{currentMonthLabel} {currentYear}</Text>
                            <TouchableOpacity onPress={nextMonth}><Text style={[styles.calArrow, { color: T.subtext }]}>›</Text></TouchableOpacity>
                        </View>
                        <View style={styles.calendarGrid}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <View key={i} style={styles.calDay}><Text style={[styles.calDayText, { fontWeight: 'bold' }]}>{d}</Text></View>
                            ))}
                            {calendarDays.map((day, i) => {
                                const isToday = day === new Date().getDate() && viewDate.getMonth() === new Date().getMonth() && viewDate.getFullYear() === new Date().getFullYear();
                                return (
                                    <View key={i} style={[styles.calDay, isToday && styles.calDayActive]}>
                                        <Text style={[styles.calDayText, isToday && { color: '#fff' }]}>{day || ''}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: '#F7F9FC' },
    scrollContent: { paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#495057' },
    headerButtons: { flexDirection: 'row', gap: 10 },
    ghostBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DEE2E6' },
    ghostBtnText: { color: '#495057', fontSize: 13, fontWeight: '500' },
    primaryBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4, backgroundColor: '#3B7DDD' },
    primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
    mainGrid: { flexDirection: 'row', gap: 24, marginBottom: 24 },
    statsColumn: { width: '40%' },
    statsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    miniCard: {
        width: '45%', minWidth: 160, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    miniCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    miniCardLabel: { fontSize: 14, color: '#6C757D', fontWeight: '500' },
    miniIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },
    miniCardValue: { fontSize: 24, fontWeight: '700', color: '#495057', marginBottom: 4 },
    miniCardSub: { fontSize: 11, color: '#ADB5BD' },
    chartColumn: { flex: 1 },
    largeCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    largeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    largeCardTitle: { fontSize: 15, fontWeight: '600', color: '#495057' },
    chartContent: { flex: 1, justifyContent: 'flex-end', height: 200 },
    bottomGrid: { flexDirection: 'row', gap: 24 },
    detailCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    detailTitle: { fontSize: 14, fontWeight: '600', color: '#495057', marginBottom: 16 },
    calendarMock: { padding: 10 },
    calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    calArrow: { fontSize: 24, paddingHorizontal: 10 },
    calendarHeader: { fontSize: 13, fontWeight: '700', color: '#495057' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calDay: { width: '14%', padding: 4, alignItems: 'center' },
    calDayActive: { backgroundColor: '#3B7DDD', borderRadius: 4 },
    calDayText: { fontSize: 12, color: '#ADB5BD' },
});
