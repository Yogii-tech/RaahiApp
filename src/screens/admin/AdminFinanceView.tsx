import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { API_BASE } from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV } from '../../utils/exportUtils';

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

export default function AdminFinanceView({ token, searchQuery = '', isDark }: { token: string; searchQuery?: string; isDark: boolean }) {
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [commissionRate, setCommissionRate] = useState('10.0');
    const [activeTab, setActiveTab] = useState<'all' | 'settled' | 'pending'>('all');
    const { fetchWithAuth } = useAuth();

    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
    };

    useEffect(() => {
        // Fetch rides list to build mock financial ledger
        fetchWithAuth(`${API_BASE}/api/admin/rides`)
            .then(res => res.json())
            .then(rides => {
                if (Array.isArray(rides)) {
                    const mockTx: FinancialTransaction[] = rides.map((r, i) => {
                        const totalAmount = (r.pricePerSeat || 150) * (r.seatsBooked || 2);
                        const rate = parseFloat(commissionRate) / 100;
                        const commission = Math.round(totalAmount * rate * 100) / 100;
                        const netPayout = totalAmount - commission;
                        const isSettled = r.status === 'completed';

                        return {
                            id: `TXN-${10000 + i}`,
                            rideId: r.id || `RIDE-${i}`,
                            driverName: r.driver || 'Driver Partner',
                            amount: totalAmount,
                            commission: commission,
                            netPayout: netPayout,
                            status: isSettled ? 'settled' : 'pending',
                            date: r.date || 'Today',
                        };
                    });
                    setTransactions(mockTx);
                } else {
                    setTransactions([]);
                }
            })
            .catch(() => setTransactions([]))
            .finally(() => setLoading(false));
    }, [commissionRate]);

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
        alert(`Commission rate successfully updated to ${commissionRate}%!`);
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

    if (loading) return <ActivityIndicator color="#3B7DDD" size="large" style={{ marginTop: 60 }} />;

    return (
        <ScrollView style={[styles.container, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.sectionTitle, { color: T.text }]}>Commission & Settlement</Text>
                    <Text style={[styles.sectionSubtitle, { color: T.subtext }]}>
                        Manage booking commissions, driver payment settlements, and revenue splits.
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(exportData, 'Finance_Transactions_Ledger')}
                >
                    <Text style={styles.exportBtnText}>Export Ledger CSV</Text>
                </TouchableOpacity>
            </View>

            {/* Financial Summary Cards */}
            <View style={styles.summaryGrid}>
                {[
                    { label: 'Total Booking Value (GMV)', amount: `₹${totalRevenue.toLocaleString()}`, color: T.text, bg: T.card },
                    { label: 'Platform Commission Fee', amount: `₹${totalCommission.toLocaleString()}`, color: '#28A745', bg: T.card },
                    { label: 'Settled Driver Payouts', amount: `₹${settledPayouts.toLocaleString()}`, color: '#3B7DDD', bg: T.card },
                    { label: 'Pending Settlement Balance', amount: `₹${pendingSettlements.toLocaleString()}`, color: '#FCB92C', bg: T.card },
                ].map((card, i) => (
                    <View key={i} style={[styles.summaryCard, { backgroundColor: card.bg, borderColor: T.border }]}>
                        <Text style={[styles.summaryLabel, { color: T.subtext }]}>{card.label}</Text>
                        <Text style={[styles.summaryAmount, { color: card.color }]}>{card.amount}</Text>
                    </View>
                ))}
            </View>

            {/* Row 2: Settings + Quick Settlement Action */}
            <View style={styles.rowLayout}>
                {/* Commission Rates config */}
                <View style={[styles.configCard, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.cardTitle, { color: T.text }]}>Platform Rate configuration</Text>
                    <Text style={[styles.cardSubtitle, { color: T.subtext }]}>
                        This percentage is deducted from driver fare amounts for system usage.
                    </Text>
                    <View style={styles.inputRow}>
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
                            <Text style={styles.saveBtnText}>Update Rate</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Auto Settlement Config */}
                <View style={[styles.configCard, { backgroundColor: T.card, borderColor: T.border }]}>
                    <Text style={[styles.cardTitle, { color: T.text }]}>Settlement Schedule</Text>
                    <Text style={[styles.cardSubtitle, { color: T.subtext }]}>
                        System trigger for moving pending ledger balances to bank accounts.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                        {['Daily', 'Weekly (Fri)', 'Monthly'].map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[
                                    styles.optBtn,
                                    { borderColor: T.border },
                                    opt === 'Weekly (Fri)' && { backgroundColor: T.accent, borderColor: T.accent }
                                ]}
                            >
                                <Text style={{ color: opt === 'Weekly (Fri)' ? '#fff' : T.text, fontSize: 13, fontWeight: '500' }}>
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Ledger Table */}
            <View style={styles.ledgerHeaderRow}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
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
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
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
});
