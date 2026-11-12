import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { notify } from '../../utils/notify';

const REPORTS = [
    { label: 'Daily Bookings', type: 'daily_bookings', icon: '📋' },
    { label: 'Revenue Summary', type: 'revenue', icon: '💰' },
    { label: 'Driver Payouts', type: 'payouts', icon: '🚗' },
];

export default function AdminReportsView({ token }: { token: string }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const handleDownload = (type: string, label: string) => {
        if (Platform.OS === 'web') {
            const url = `${API_BASE}/api/admin/reports/${type}`;
            // Create invisible anchor and trigger download
            // @ts-ignore
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.setAttribute('download', `${type}.csv`);
            // We need auth, so we fetch it as blob
            fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    anchor.href = blobUrl;
                    anchor.click();
                    URL.revokeObjectURL(blobUrl);
                })
                .catch(() => notify('Error', 'Download failed'));
        } else {
            notify('Download', `${label} CSV will be available on web.`);
        }
    };

    return (
        <ScrollView style={[styles.container, isMobile && { padding: 16 }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>MANAGEMENT HUB</Text>
            <Text style={[styles.pageTitle, isMobile && { fontSize: 24, marginBottom: 20 }]}>Reports</Text>
            <View style={styles.cardsRow}>
                {REPORTS.map(report => (
                    <View key={report.type} style={[styles.card, isMobile && { minWidth: '100%', padding: 20 }]}>
                        <Text style={styles.cardIcon}>{report.icon}</Text>
                        <Text style={styles.cardLabel}>{report.label}</Text>
                        <TouchableOpacity
                            style={styles.downloadBtn}
                            onPress={() => handleDownload(report.type, report.label)}
                            activeOpacity={0.8}>
                            <Text style={styles.downloadText}>DOWNLOAD CSV</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    sectionLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 2, marginBottom: 6 },
    pageTitle: { color: '#F9FAFB', fontSize: 28, fontWeight: 'bold', marginBottom: 28 },
    cardsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
    card: {
        flex: 1, minWidth: 220,
        backgroundColor: '#111827', borderRadius: 16, padding: 28,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', gap: 16,
    },
    cardIcon: { fontSize: 32 },
    cardLabel: { color: '#F9FAFB', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    downloadBtn: {
        backgroundColor: '#1FAF63', borderRadius: 10, paddingVertical: 14,
        paddingHorizontal: 24, width: '100%', alignItems: 'center', marginTop: 8,
    },
    downloadText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
});
