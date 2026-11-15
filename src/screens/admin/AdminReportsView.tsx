import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../utils/notify';
import { parseJsonSafe, getApiErrorMessage, createRequestAbort } from '../../utils/json';

const REPORTS = [
    { label: 'Daily Bookings', type: 'daily_bookings', icon: '📋' },
    { label: 'Revenue Summary', type: 'revenue', icon: '💰' },
    { label: 'Driver Payouts', type: 'payouts', icon: '🚗' },
];

export default function AdminReportsView({ token: _token }: { token: string }) {
    const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
    const { fetchWithAuth } = useAuth();
    const fetchWithAuthRef = useRef(fetchWithAuth);
    fetchWithAuthRef.current = fetchWithAuth;
    const isMountedRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            abortRef.current?.abort();
        };
    }, []);

    const handleDownload = async (type: string, label: string) => {
        if (downloadingReport) return;
        if (Platform.OS !== 'web') {
            notify('Download', `${label} CSV will be available on web.`);
            return;
        }
        setDownloadingReport(type);
        const { controller, cleanup, didTimeout } = createRequestAbort(15000);
        abortRef.current = controller;
        try {
            const url = `${API_BASE}/api/admin/reports/${type}`;
            const res = await fetchWithAuthRef.current(url, { signal: controller.signal });
            if (!res.ok) {
                const errBody = await parseJsonSafe<any>(res);
                throw new Error(getApiErrorMessage(errBody, `Download failed (${res.status})`));
            }
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            // @ts-ignore
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.setAttribute('download', `${type}.csv`);
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err: any) {
            if (!isMountedRef.current) return;
            if (err?.name === 'AbortError' && !didTimeout()) return;
            notify('Error', didTimeout() ? 'Report download timed out' : (err?.message || 'Download failed'));
        } finally {
            cleanup();
            if (isMountedRef.current) {
                setDownloadingReport(null);
            }
        }
    };

    return (
        <ScrollView style={[styles.container, isMobile && { padding: 16 }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>MANAGEMENT HUB</Text>
            <Text style={[styles.pageTitle, isMobile && { fontSize: 24, marginBottom: 20 }]}>Reports</Text>
            <View style={styles.cardsRow}>
                {REPORTS.map(report => {
                    const isDownloading = downloadingReport === report.type;
                    const isBusy = downloadingReport !== null;
                    return (
                        <View key={report.type} style={[styles.card, isMobile && { minWidth: '100%', padding: 20 }]}>
                            <Text style={styles.cardIcon}>{report.icon}</Text>
                            <Text style={styles.cardLabel}>{report.label}</Text>
                            <TouchableOpacity
                                style={[styles.downloadBtn, isBusy && { opacity: 0.65 }]}
                                onPress={() => handleDownload(report.type, report.label)}
                                disabled={isBusy}
                                activeOpacity={0.8}>
                                {isDownloading ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.downloadText}>DOWNLOAD CSV</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}
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
