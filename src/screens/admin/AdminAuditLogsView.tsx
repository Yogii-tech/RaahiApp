import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { downloadCSV } from '../../utils/exportUtils';

interface AuditLogEntry {
    id: string;
    actor: string;
    role: 'admin' | 'superadmin';
    action: string;
    target: string;
    category: 'driver' | 'ride' | 'finance' | 'system' | 'user';
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    ip: string;
}

const MOCK_LOGS: AuditLogEntry[] = [
    { id: 'AL001', actor: 'Yogesh A.', role: 'superadmin', action: 'Verified driver', target: 'Ram Prasad (ID: DRV-0031)', category: 'driver', severity: 'info', timestamp: '17 Aug 2026, 11:04 AM', ip: '103.21.56.12' },
    { id: 'AL002', actor: 'Yogesh A.', role: 'superadmin', action: 'Rejected driver document', target: 'Suresh Kumar – Missing RC', category: 'driver', severity: 'warning', timestamp: '17 Aug 2026, 10:48 AM', ip: '103.21.56.12' },
    { id: 'AL003', actor: 'System', role: 'admin', action: 'Auto-settled weekly payouts', target: 'Batch #W-2026-33 — 48 drivers', category: 'finance', severity: 'info', timestamp: '15 Aug 2026, 11:59 PM', ip: 'internal' },
    { id: 'AL004', actor: 'Yogesh A.', role: 'superadmin', action: 'Updated commission rate', target: '12% → 10%', category: 'finance', severity: 'warning', timestamp: '14 Aug 2026, 03:12 PM', ip: '103.21.56.12' },
    { id: 'AL005', actor: 'Priya M.', role: 'admin', action: 'Cancelled ride', target: 'Ride #RD-5512 (Bageshwar → Almora)', category: 'ride', severity: 'info', timestamp: '13 Aug 2026, 09:22 AM', ip: '117.96.12.4' },
    { id: 'AL006', actor: 'Priya M.', role: 'admin', action: 'Added new admin user', target: 'Riya Chaturvedi (ops@goraahi.in)', category: 'system', severity: 'critical', timestamp: '12 Aug 2026, 02:07 PM', ip: '117.96.12.4' },
    { id: 'AL007', actor: 'System', role: 'admin', action: 'Failed login attempt (3x)', target: 'admin@goraahi.in', category: 'system', severity: 'critical', timestamp: '11 Aug 2026, 07:43 PM', ip: '185.25.3.18' },
    { id: 'AL008', actor: 'Yogesh A.', role: 'superadmin', action: 'Exported driver records CSV', target: 'Driver_Onboarding_Report.csv (84 rows)', category: 'system', severity: 'info', timestamp: '10 Aug 2026, 01:30 PM', ip: '103.21.56.12' },
    { id: 'AL009', actor: 'Priya M.', role: 'admin', action: 'Changed route pricing multiplier', target: 'Bageshwar–Almora: 1.0x → 1.2x', category: 'finance', severity: 'warning', timestamp: '09 Aug 2026, 10:02 AM', ip: '117.96.12.4' },
    { id: 'AL010', actor: 'System', role: 'admin', action: 'Daily stats snapshot generated', target: 'stats_2026-08-08.json', category: 'system', severity: 'info', timestamp: '08 Aug 2026, 11:59 PM', ip: 'internal' },
    { id: 'AL011', actor: 'Yogesh A.', role: 'superadmin', action: 'Removed passenger account', target: 'Deepak Rawat (flagged spam)', category: 'user', severity: 'critical', timestamp: '07 Aug 2026, 04:15 PM', ip: '103.21.56.12' },
    { id: 'AL012', actor: 'Priya M.', role: 'admin', action: 'Sent notification blast', target: '1,203 passengers — Eid discount offer', category: 'system', severity: 'info', timestamp: '06 Aug 2026, 09:00 AM', ip: '117.96.12.4' },
];

const SEVERITY_CONFIG = {
    info: { color: '#3B7DDD', bg: 'rgba(59,125,221,0.1)', label: 'INFO' },
    warning: { color: '#FCB92C', bg: 'rgba(252,185,44,0.1)', label: 'WARN' },
    critical: { color: '#DC3545', bg: 'rgba(220,53,69,0.1)', label: 'CRIT' },
};

const CATEGORY_ICONS: Record<string, string> = {
    driver: '👤',
    ride: '🚙',
    finance: '💰',
    system: '⚙️',
    user: '🧑',
};

export default function AdminAuditLogsView({ isDark, searchQuery = '' }: { isDark: boolean; searchQuery?: string }) {
    const [activeCategory, setActiveCategory] = useState<'all' | 'driver' | 'ride' | 'finance' | 'system' | 'user'>('all');
    const [activeSeverity, setActiveSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
        codeBg: isDark ? '#0D1117' : '#F1F5F9',
    };

    const filteredLogs = MOCK_LOGS.filter(log => {
        const matchesSearch =
            log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.ip.includes(searchQuery);
        const matchesCategory = activeCategory === 'all' || log.category === activeCategory;
        const matchesSeverity = activeSeverity === 'all' || log.severity === activeSeverity;
        return matchesSearch && matchesCategory && matchesSeverity;
    });

    const exportData = filteredLogs.map(l => ({
        LogID: l.id,
        Actor: l.actor,
        Role: l.role,
        Action: l.action,
        Target: l.target,
        Category: l.category,
        Severity: l.severity.toUpperCase(),
        Timestamp: l.timestamp,
        IP: l.ip,
    }));

    return (
        <ScrollView style={[styles.container, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.sectionTitle, { color: T.text }]}>Audit Logs</Text>
                    <Text style={[styles.sectionSubtitle, { color: T.subtext }]}>
                        Immutable record of all admin actions, system events, and security-relevant operations.
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => downloadCSV(exportData, 'Audit_Logs_Export')}
                >
                    <Text style={styles.exportBtnText}>Export Audit CSV</Text>
                </TouchableOpacity>
            </View>

            {/* KPI Summary Row */}
            <View style={styles.kpiRow}>
                {[
                    { label: 'Total Events', count: MOCK_LOGS.length, color: T.text },
                    { label: 'Critical Flags', count: MOCK_LOGS.filter(l => l.severity === 'critical').length, color: '#DC3545' },
                    { label: 'Warnings', count: MOCK_LOGS.filter(l => l.severity === 'warning').length, color: '#FCB92C' },
                    { label: 'System Events', count: MOCK_LOGS.filter(l => l.category === 'system').length, color: '#9CA3AF' },
                ].map(card => (
                    <View key={card.label} style={[styles.kpiCard, { backgroundColor: T.card, borderColor: T.border }]}>
                        <Text style={[styles.kpiCount, { color: card.color }]}>{card.count}</Text>
                        <Text style={[styles.kpiLabel, { color: T.subtext }]}>{card.label}</Text>
                    </View>
                ))}
            </View>

            {/* Filters Row */}
            <View style={[styles.filtersCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={styles.filterGroup}>
                    <Text style={[styles.filterGroupLabel, { color: T.subtext }]}>CATEGORY</Text>
                    <View style={styles.filterChips}>
                        {(['all', 'driver', 'ride', 'finance', 'system', 'user'] as const).map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.chip, activeCategory === cat && { backgroundColor: T.accent }]}
                                onPress={() => setActiveCategory(cat)}
                            >
                                <Text style={[styles.chipText, { color: activeCategory === cat ? '#fff' : T.subtext }]}>
                                    {cat !== 'all' ? `${CATEGORY_ICONS[cat]} ` : ''}{cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={[styles.filterDivider, { backgroundColor: T.border }]} />

                <View style={styles.filterGroup}>
                    <Text style={[styles.filterGroupLabel, { color: T.subtext }]}>SEVERITY</Text>
                    <View style={styles.filterChips}>
                        {(['all', 'info', 'warning', 'critical'] as const).map(sev => (
                            <TouchableOpacity
                                key={sev}
                                style={[styles.chip, activeSeverity === sev && { backgroundColor: sev === 'all' ? T.accent : SEVERITY_CONFIG[sev]?.color || T.accent }]}
                                onPress={() => setActiveSeverity(sev)}
                            >
                                <Text style={[styles.chipText, { color: activeSeverity === sev ? '#fff' : T.subtext }]}>
                                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Results count */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.resultCount, { color: T.subtext }]}>{filteredLogs.length} audit events</Text>
                <Text style={[styles.resultCount, { color: T.subtext }]}>Showing newest first</Text>
            </View>

            {/* Log Timeline */}
            <View style={[styles.logCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <FlatList
                    data={filteredLogs}
                    keyExtractor={item => item.id}
                    renderItem={({ item, index }) => {
                        const sev = SEVERITY_CONFIG[item.severity];
                        return (
                            <View style={[styles.logRow, { borderBottomColor: T.border, backgroundColor: index % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                                {/* Left: Severity + Category */}
                                <View style={styles.logLeft}>
                                    <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
                                        <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
                                    </View>
                                    <Text style={{ fontSize: 18, marginTop: 6 }}>{CATEGORY_ICONS[item.category]}</Text>
                                </View>

                                {/* Middle: Main content */}
                                <View style={styles.logBody}>
                                    <Text style={[styles.logAction, { color: T.text }]}>{item.action}</Text>
                                    <Text style={[styles.logTarget, { color: T.subtext }]} numberOfLines={1}>→ {item.target}</Text>
                                    <Text style={[styles.logTimestamp, { color: T.subtext }]}>{item.timestamp}</Text>
                                </View>

                                {/* Right: Actor + IP */}
                                <View style={styles.logRight}>
                                    <Text style={[styles.logActor, { color: T.text }]}>{item.actor}</Text>
                                    <View style={[styles.roleChip, { backgroundColor: item.role === 'superadmin' ? 'rgba(220,53,69,0.1)' : 'rgba(59,125,221,0.1)' }]}>
                                        <Text style={[styles.roleChipText, { color: item.role === 'superadmin' ? '#DC3545' : T.accent }]}>
                                            {item.role}
                                        </Text>
                                    </View>
                                    <Text style={[styles.logIp, { color: T.codeBg === '#0D1117' ? '#6B7280' : '#94A3B8', backgroundColor: T.codeBg }]}>
                                        {item.ip}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={{ color: T.subtext, textAlign: 'center', padding: 40 }}>No audit logs match filters.</Text>
                    }
                />
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
    kpiRow: { flexDirection: 'row', gap: 20, marginBottom: 24, flexWrap: 'wrap' },
    kpiCard: { flex: 1, minWidth: 140, padding: 20, borderRadius: 8, borderWidth: 1 },
    kpiCount: { fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
    kpiLabel: { fontSize: 12, fontWeight: '500' },
    filtersCard: { padding: 20, borderRadius: 8, borderWidth: 1, marginBottom: 16 },
    filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    filterGroupLabel: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, width: 80 },
    filterChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
    chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(128,128,128,0.1)' },
    chipText: { fontSize: 12, fontWeight: '500' },
    filterDivider: { height: 1, marginVertical: 12 },
    resultCount: { fontSize: 12 },
    logCard: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    logRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, gap: 14, alignItems: 'flex-start' },
    logLeft: { alignItems: 'center', gap: 6, width: 52 },
    severityBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 },
    severityText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
    logBody: { flex: 1, gap: 3 },
    logAction: { fontSize: 14, fontWeight: '600' },
    logTarget: { fontSize: 13 },
    logTimestamp: { fontSize: 11, marginTop: 4 },
    logRight: { alignItems: 'flex-end', gap: 4 },
    logActor: { fontSize: 13, fontWeight: '600' },
    roleChip: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
    roleChipText: { fontSize: 10, fontWeight: 'bold' },
    logIp: { fontSize: 11, fontFamily: 'monospace', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
});
