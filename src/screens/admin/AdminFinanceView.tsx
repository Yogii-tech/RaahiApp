import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';
import { notify } from '../../utils/notify';
import { parseJsonSafe, createRequestAbort } from '../../utils/json';

interface FinancialTransaction {
    id: string;
    rideId: string;
    driverName: string;
    amount: number;
    commission: number;
    netPayout: number;
    status: 'settled' | 'pending';
    date: string;
}

export default function AdminFinanceView({ token: _token, searchQuery = '', isDark }: { token: string; searchQuery?: string; isDark: boolean }) {
    const [rawRides, setRawRides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [commissionRate, setCommissionRate] = useState('10.0');
    const [selectedSchedule, setSelectedSchedule] = useState<'Daily' | 'Weekly (Fri)' | 'Monthly'>('Weekly (Fri)');
    const [activeTab, setActiveTab] = useState<'all' | 'settled' | 'pending'>('all');
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
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
    };

    const loadRides = useCallback(async (background = false) => {
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
            const res = await fetchWithAuthRef.current(`${API_BASE}/api/admin/rides`, { signal: controller.signal });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const rides = await parseJsonSafe<any[]>(res);
            if (!isMountedRef.current || reqId !== reqIdRef.current) return;
            setRawRides(Array.isArray(rides) ? rides : []);
        } catch (err: any) {
            if (!isMountedRef.current || reqId !== reqIdRef.current) return;
            if (err?.name === 'AbortError' && !didTimeout()) return;
            setError(didTimeout() ? 'Request timed out while loading ledger' : (err?.message || 'Failed to load financial rides ledger'));
            if (!background) setRawRides([]);
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
        loadRides(false);
        return () => {
            isMountedRef.current = false;
            reqIdRef.current += 1;
            abortRef.current?.abort();
        };
    }, [loadRides]);

    const parsedRate = parseFloat(commissionRate);
    const isValidRate = commissionRate.trim() !== '' && Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100;
    const effectiveRatePct = isValidRate ? parsedRate : 0;

    const transactions = useMemo<FinancialTransaction[]>(() => {
        const rate = effectiveRatePct / 100;
        return rawRides.map((r, i) => {
            const price = typeof r.pricePerSeat === 'number' && Number.isFinite(r.pricePerSeat) ? r.pricePerSeat : 0;
            const seats = typeof r.seatsBooked === 'number' && Number.isFinite(r.seatsBooked) ? r.seatsBooked : 0;
            const totalAmount = price * seats;
            const commission = Math.round(totalAmount * rate * 100) / 100;
            const netPayout = Math.round((totalAmount - commission) * 100) / 100;
            const isSettled = r.status === 'completed';

            return {
                id: `TXN-${10000 + i}`,
                rideId: r.id || `RIDE-${i}`,
                driverName: r.driver || 'Driver Partner',
                amount: totalAmount,
                commission,
                netPayout,
                status: isSettled ? 'settled' : 'pending',
                date: r.date || 'Today',
            };
        });
    }, [rawRides, effectiveRatePct]);

    const totalRevenue = transactions.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCommission = transactions.reduce((acc, curr) => acc + curr.commission, 0);
    const settledPayouts = transactions.filter(t => t.status === 'settled').reduce((acc, curr) => acc + curr.netPayout, 0);
    const pendingSettlements = transactions.filter(t => t.status === 'pending').reduce((acc, curr) => acc + curr.netPayout, 0);

    const filteredTx = transactions.filter(t => {
        const matchesSearch =
            t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.rideId.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'settled') return matchesSearch && t.status === 'settled';
        if (activeTab === 'pending') return matchesSearch && t.status === 'pending';
        return matchesSearch;
    });

    const handleSaveCommission = () => {
        if (!isValidRate) {
            notify('Invalid Rate', 'Enter a commission percentage between 0 and 100.');
            return;
        }
        notify(
            'Preview / Demo Mode',
            `Commission rate preview updated locally to ${effectiveRatePct}%. Changes are not persisted to the backend.`
        );
    };

    const handleSchedulePreview = (schedule: 'Daily' | 'Weekly (Fri)' | 'Monthly') => {
        setSelectedSchedule(schedule);
        notify(
            'Preview / Demo Mode',
            `Settlement schedule "${schedule}" is a demo control and does not persist to the backend.`
        );
    };

    const exportData = filteredTx.map(t => ({
        TxID: t.id,
        RideID: t.rideId,
        Driver: t.driverName,
        GrossAmount: `₹${t.amount}`,
        Commission: `₹${t.commission}`,
        NetPayout: `₹${t.netPayout}`,
        Status: t.status.toUpperCase(),
        Date: t.date
    }));

    if (loading && rawRides.length === 0) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    if (error && rawRides.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <Text style={{ color: '#DC3545', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>{error}</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={() => loadRides(false)}>
                    <Text style={styles.exportBtnText}>↻ Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.sectionTitle, { color: T.text }]}>Commission & Settlement</Text>
                    <Text style={[styles.sectionSubtitle, { color: T.subtext }]}>
                        Manage booking commissions, driver payment settlements, and revenue splits.
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={[styles.optBtn, { backgroundColor: T.card, borderColor: T.border }, refreshing && { opacity: 0.6 }]}
                        onPress={() => loadRides(true)}
                        disabled={refreshing}
                    >
                        <Text style={{ color: T.text, fontSize: 13, fontWeight: '500' }}>{refreshing ? '↻ Refreshing...' : '↻ Refresh'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.exportBtn}
                        onPress={() => downloadCSV(exportData, 'Finance_Transactions_Ledger')}
                    >
                        <Text style={styles.exportBtnText}>Export Ledger CSV</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {error && (
                <Text style={{ color: '#DC3545', fontSize: 12, marginBottom: 12 }}>Refresh failed: {error}</Text>
            )}

            <View style={[styles.previewBanner, { borderColor: '#FCB92C66', backgroundColor: isDark ? 'rgba(252, 185, 44, 0.12)' : '#FFFBEB' }]}>
                <Text style={[styles.previewBannerTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                    Preview / Demo Mode
                </Text>
                <Text style={[styles.previewBannerText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
                    Ledger entries, commission calculations, and settlement schedules are simulated client-side from ride records and do not persist to the backend.
                </Text>
            </View>

            {/* Financial Summary Cards */}
            <View style={[styles.summaryGrid, isMobile && { gap: 12 }]}>
                {[
                    { label: 'Total Booking Value (GMV)', amount: `₹${totalRevenue.toLocaleString()}`, color: T.text, bg: T.card },
                    { label: 'Platform Commission Fee', amount: `₹${totalCommission.toLocaleString()}`, color: '#28A745', bg: T.card },
                    { label: 'Settled Driver Payouts', amount: `₹${settledPayouts.toLocaleString()}`, color: '#3B7DDD', bg: T.card },
                    { label: 'Pending Settlement Balance', amount: `₹${pendingSettlements.toLocaleString()}`, color: '#FCB92C', bg: T.card },
                ].map((card, i) => (
                    <View key={i} style={[styles.summaryCard, isMobile && { minWidth: 140, padding: 14 }, { backgroundColor: card.bg, borderColor: T.border }]}>
                        <Text style={[styles.summaryLabel, { color: T.subtext }]}>{card.label}</Text>
                        <Text style={[styles.summaryAmount, isMobile && { fontSize: 18 }, { color: card.color }]}>{card.amount}</Text>
                    </View>
                ))}
            </View>

            {/* Row 2: Settings + Quick Settlement Action */}
            <View style={[styles.rowLayout, isMobile && { gap: 14 }]}>
                {/* Commission Rates config */}
                <View style={[styles.configCard, isMobile && { minWidth: '100%', padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.cardTitle, { color: T.text }]}>Platform Rate configuration</Text>
                    <Text style={[styles.cardSubtitle, { color: T.subtext }]}>
                        This percentage is deducted from driver fare amounts for system usage.
                    </Text>
                    <View style={[styles.inputRow, { flexWrap: 'wrap' }]}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={[styles.input, { color: T.text, borderColor: T.border }]}
                                value={commissionRate}
                                onChangeText={setCommissionRate}
                                keyboardType="numeric"
                            />
                            <Text style={[styles.percentSign, { color: T.text }]}>%</Text>
                        </View>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCommission}>
                            <Text style={styles.saveBtnText}>Preview Rate (Demo)</Text>
                        </TouchableOpacity>
                    </View>
                    {!isValidRate && (
                        <Text style={{ color: '#DC3545', fontSize: 12, marginTop: 8 }}>
                            Enter a valid percentage (0–100). Using 0% for preview calculation.
                        </Text>
                    )}
                </View>

                {/* Auto Settlement Config */}
                <View style={[styles.configCard, isMobile && { minWidth: '100%', padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.cardTitle, { color: T.text }]}>Settlement Schedule (Preview Only)</Text>
                    <Text style={[styles.cardSubtitle, { color: T.subtext }]}>
                        Demo UI only — automated bank settlement triggers are not connected to a backend payout service.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        {(['Daily', 'Weekly (Fri)', 'Monthly'] as const).map(opt => (
                            <TouchableOpacity
                                key={opt}
                                onPress={() => handleSchedulePreview(opt)}
                                style={[
                                    styles.optBtn,
                                    { borderColor: T.border },
                                    selectedSchedule === opt && { backgroundColor: T.accent, borderColor: T.accent }
                                ]}
                            >
                                <Text style={{ color: selectedSchedule === opt ? '#fff' : T.text, fontSize: 13, fontWeight: '500' }}>
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Ledger Table */}
            <View style={[styles.ledgerHeaderRow, { flexWrap: 'wrap', gap: 8 }]}>
                <View style={{ flexDirection: 'row', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
                    {['all', 'settled', 'pending'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab as any)}
                            style={[
                                styles.ledgerTab,
                                activeTab === tab && { borderBottomColor: T.accent, borderBottomWidth: 2 }
                            ]}
                        >
                            <Text style={[styles.ledgerTabText, { color: activeTab === tab ? T.accent : T.subtext, textTransform: 'capitalize' }]}>
                                {tab} ledger
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={{ fontSize: 13, color: T.subtext }}>Showing {filteredTx.length} items</Text>
            </View>

            <View style={[styles.tableCard, { backgroundColor: T.card, borderColor: T.border }]}>
                {isMobile ? (
                    filteredTx.length === 0 ? (
                        <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>
                            No ledger logs match filters.
                        </Text>
                    ) : (
                        filteredTx.map((item, index) => (
                            <View key={item.id} style={[styles.mobileTxCard, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                <View style={styles.mobileTxTop}>
                                    <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 13 }}>{item.id}</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        item.status === 'settled' ? styles.badgeSettled : styles.badgePending
                                    ]}>
                                        <Text style={[styles.badgeText, { color: item.status === 'settled' ? '#28A745' : '#FCB92C' }]}>
                                            {item.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={{ color: T.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.driverName}</Text>
                                <View style={styles.mobileTxMeta}>
                                    <Text style={{ color: T.subtext, fontSize: 12 }}>Gross: <Text style={{ color: T.text, fontWeight: '600' }}>₹{item.amount.toLocaleString()}</Text></Text>
                                    <Text style={{ color: T.subtext, fontSize: 12 }}>Fee: <Text style={{ color: '#28A745', fontWeight: '600' }}>₹{item.commission.toLocaleString()}</Text></Text>
                                    <Text style={{ color: T.subtext, fontSize: 12 }}>Net: <Text style={{ color: T.text, fontWeight: '700' }}>₹{item.netPayout.toLocaleString()}</Text></Text>
                                </View>
                            </View>
                        ))
                    )
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: 900, padding: 20 }}>
                            <View style={[styles.tableHeader, { borderBottomColor: T.border }]}>
                                <Text style={[styles.headerCell, { flex: 1.5, color: T.text }]}>TXID</Text>
                                <Text style={[styles.headerCell, { flex: 2, color: T.text }]}>DRIVER PARTNER</Text>
                                <Text style={[styles.headerCell, { flex: 1.2, color: T.text }]}>GROSS FARE</Text>
                                <Text style={[styles.headerCell, { flex: 1.2, color: T.text }]}>COMMISSION</Text>
                                <Text style={[styles.headerCell, { flex: 1.2, color: T.text }]}>NET PAYOUT</Text>
                                <Text style={[styles.headerCell, { flex: 1.5, color: T.text }]}>SETTLEMENT STATUS</Text>
                            </View>

                            <FlatList
                                data={filteredTx}
                                keyExtractor={item => item.id}
                                renderItem={({ item, index }) => (
                                    <View style={[styles.tableRow, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                        <Text style={[styles.cellText, { flex: 1.5, color: T.text, fontWeight: 'bold' }]}>{item.id}</Text>
                                        <Text style={[styles.cellText, { flex: 2, color: T.text, fontWeight: '500' }]}>{item.driverName}</Text>
                                        <Text style={[styles.cellText, { flex: 1.2, color: T.text }]}>₹{item.amount.toLocaleString()}</Text>
                                        <Text style={[styles.cellText, { flex: 1.2, color: '#28A745', fontWeight: '500' }]}>₹{item.commission.toLocaleString()}</Text>
                                        <Text style={[styles.cellText, { flex: 1.2, color: T.text }]}>₹{item.netPayout.toLocaleString()}</Text>
                                        <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                            <View style={[
                                                styles.statusBadge,
                                                item.status === 'settled' ? styles.badgeSettled : styles.badgePending
                                            ]}>
                                                <Text style={[styles.badgeText, { color: item.status === 'settled' ? '#28A745' : '#FCB92C' }]}>
                                                    {item.status.toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>
                                        No ledger logs match filters.
                                    </Text>
                                }
                            />
                        </View>
                    </ScrollView>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    previewBanner: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 20 },
    previewBannerTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    previewBannerText: { fontSize: 12, lineHeight: 18 },
    sectionTitle: { fontSize: 20, fontWeight: '600' },
    sectionSubtitle: { fontSize: 13, marginTop: 4 },
    exportBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
    exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 24 },
    summaryCard: { flex: 1, minWidth: 200, padding: 20, borderRadius: 8, borderWidth: 1 },
    summaryLabel: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
    summaryAmount: { fontSize: 22, fontWeight: '700' },
    rowLayout: { flexDirection: 'row', gap: 24, marginBottom: 24, flexWrap: 'wrap' },
    configCard: { flex: 1, minWidth: 300, padding: 24, borderRadius: 8, borderWidth: 1 },
    cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    cardSubtitle: { fontSize: 12, marginBottom: 16 },
    inputRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
    input: { borderWidth: 1, borderRadius: 4, width: 90, paddingVertical: 6, paddingHorizontal: 10, paddingRight: 24, fontSize: 14 },
    percentSign: { position: 'absolute', right: 8, fontSize: 14, fontWeight: '600' },
    saveBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
    saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
    optBtn: { borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
    ledgerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)', marginBottom: 16 },
    ledgerTab: { paddingVertical: 10, paddingHorizontal: 8 },
    ledgerTabText: { fontSize: 14, fontWeight: '500' },
    tableCard: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1 },
    headerCell: { fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, minHeight: 48, alignItems: 'center' },
    cellText: { fontSize: 14 },
    statusBadge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1 },
    badgeSettled: { backgroundColor: 'rgba(40,167,69,0.1)', borderColor: 'rgba(40,167,69,0.3)' },
    badgePending: { backgroundColor: 'rgba(252,185,44,0.1)', borderColor: 'rgba(252,185,44,0.3)' },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    mobileTxCard: { padding: 14, borderBottomWidth: 1, gap: 6 },
    mobileTxTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    mobileTxMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
});
