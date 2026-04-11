import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';

interface Stats {
    totalRides: number;
    pending: number;
    confirmed: number;
    drivers: number;
    canceled: number;
    activities: { name: string; detail: string }[];
}

const BAR_HEIGHTS = [40, 70, 55, 85, 110, 95, 75]; // mock chart bar heights

export default function AdminDashboardView({ token }: { token: string }) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const { fetchWithAuth } = useAuth();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    useEffect(() => {
        fetchWithAuth(`${API_BASE}/api/admin/stats`)
            .then(r => r.json())
            .then(d => setStats(d))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <ActivityIndicator color="#1FAF63" size="large" style={{ marginTop: 60 }} />;

    const statCards = [
        { label: 'TOTAL RIDES', value: stats?.totalRides ?? 0, color: '#1FAF63' },
        { label: 'PENDING', value: stats?.pending ?? 0, color: '#F59E0B' },
        { label: 'CONFIRMED', value: stats?.confirmed ?? 0, color: '#3B82F6' },
        { label: 'DRIVERS', value: stats?.drivers ?? 0, color: '#10B981' },
        { label: 'CANCELED', value: stats?.canceled ?? 0, color: '#EF4444' },
    ];

    const bgMap: Record<string, string> = {
        'TOTAL RIDES': '#0F2A1E',
        'PENDING': '#291B0C',
        'CONFIRMED': '#0C1A35',
        'DRIVERS': '#0A2318',
        'CANCELED': '#2A0C0C',
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>MANAGEMENT HUB</Text>

            {/* Stat Cards */}
            <View style={styles.statsRow}>
                {statCards.map(card => (
                    <View key={card.label} style={[styles.statCard, { backgroundColor: bgMap[card.label] }]}>
                        <Text style={[styles.statLabel, { color: card.color }]}>{card.label}</Text>
                        <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                    </View>
                ))}
            </View>

            {/* Chart + Activity Row */}
            <View style={[styles.chartActivityRow, isMobile && styles.chartActivityColumn]}>
                {/* Bar Chart */}
                <View style={[styles.chartCard, isMobile && { minHeight: 140 }]}>
                    <View style={styles.barsContainer}>
                        {BAR_HEIGHTS.map((h, i) => (
                            <View key={i} style={styles.barWrapper}>
                                <View style={[styles.bar, { height: h }]} />
                            </View>
                        ))}
                    </View>
                </View>

                {/* Latest Activity */}
                <View style={styles.activityCard}>
                    <Text style={styles.activityTitle}>LATEST ACTIVITY</Text>
                    <ScrollView style={styles.activitiesList} showsVerticalScrollIndicator={false}>
                        {(stats?.activities ?? []).map((a, i) => (
                            <View key={i} style={styles.activityRow}>
                                <Text style={styles.activityName} numberOfLines={1}>{a.name}</Text>
                                <Text style={styles.activityAmount} numberOfLines={1}>{a.detail}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2, marginBottom: 20 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    statCard: {
        borderRadius: 16, padding: 20, minWidth: 140, flex: 1,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    statLabel: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12 },
    statValue: { fontSize: 42, fontWeight: 'bold' },
    chartActivityRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
    chartActivityColumn: { flexDirection: 'column' },
    chartCard: {
        flex: 2, minWidth: 200, backgroundColor: '#0F1A14', borderRadius: 16,
        padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        minHeight: 180, justifyContent: 'flex-end',
    },
    barsContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 130 },
    barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    bar: { width: '80%', backgroundColor: '#1FAF63', borderRadius: 6, opacity: 0.7 },
    activityCard: {
        flex: 1, 
        minWidth: 200, 
        backgroundColor: '#111827', 
        borderRadius: 16,
        padding: 20, 
        borderWidth: 1, 
        borderColor: 'rgba(255,255,255,0.06)',
        maxHeight: 400, // Added to prevent infinite growth
    },
    activityTitle: { color: '#6B7280', fontSize: 11, letterSpacing: 2, fontWeight: 'bold', marginBottom: 16 },
    activitiesList: { flex: 1 },
    activityRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    activityName: { color: '#E5E7EB', fontSize: 14, flex: 1, marginRight: 8 },
    activityAmount: { color: '#1FAF63', fontSize: 13, fontWeight: 'bold', flexShrink: 1 },
});
