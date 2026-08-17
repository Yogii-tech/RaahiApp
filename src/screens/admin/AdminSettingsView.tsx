import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';

interface AdminUserEntry {
    id: string;
    name: string;
    email: string;
    role: 'superadmin' | 'admin' | 'ops';
    status: 'active' | 'inactive';
    lastLogin: string;
}

const MOCK_ADMINS: AdminUserEntry[] = [
    { id: 'AU001', name: 'Yogesh A.', email: 'yogesh@goraahi.in', role: 'superadmin', status: 'active', lastLogin: '17 Aug 2026, 11:30 AM' },
    { id: 'AU002', name: 'Priya M.', email: 'priya@goraahi.in', role: 'admin', status: 'active', lastLogin: '16 Aug 2026, 03:45 PM' },
    { id: 'AU003', name: 'Riya C.', email: 'ops@goraahi.in', role: 'ops', status: 'inactive', lastLogin: '12 Aug 2026, 10:00 AM' },
];

interface PermissionRow {
    module: string;
    view: boolean;
    edit: boolean;
    delete: boolean;
}

const INITIAL_PERMISSIONS: PermissionRow[] = [
    { module: 'Dashboard Analytics', view: true, edit: false, delete: false },
    { module: 'Driver Verification', view: true, edit: true, delete: false },
    { module: 'Document Review', view: true, edit: true, delete: false },
    { module: 'Rides Management', view: true, edit: true, delete: true },
    { module: 'Bookings Management', view: true, edit: false, delete: false },
    { module: 'Finance & Settlement', view: true, edit: true, delete: false },
    { module: 'Notifications', view: true, edit: true, delete: true },
    { module: 'Reports & Analytics', view: true, edit: false, delete: false },
    { module: 'Audit Logs', view: true, edit: false, delete: false },
    { module: 'Admin Users', view: true, edit: false, delete: false },
    { module: 'Permissions', view: false, edit: false, delete: false },
    { module: 'System Settings', view: false, edit: false, delete: false },
];

const ROLE_COLORS: Record<string, string> = {
    superadmin: '#DC3545',
    admin: '#3B7DDD',
    ops: '#28A745',
};

export default function AdminSettingsView({ isDark, activeTab: initialTab = 'admins' }: { isDark: boolean; activeTab?: 'admins' | 'permissions' | 'settings' }) {
    const { logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'admins' | 'permissions' | 'settings'>(initialTab);
    const [permissions, setPermissions] = useState<PermissionRow[]>(INITIAL_PERMISSIONS);

    const T = {
        bg: isDark ? '#111827' : '#F7F9FC',
        card: isDark ? '#1F2937' : '#FFFFFF',
        text: isDark ? '#F9FAFB' : '#495057',
        subtext: isDark ? '#9CA3AF' : '#6C757D',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#DEE2E6',
        accent: '#3B7DDD',
        input: isDark ? '#111827' : '#F7F9FC',
    };

    const togglePermission = (moduleIdx: number, field: 'view' | 'edit' | 'delete') => {
        setPermissions(prev => prev.map((p, i) =>
            i === moduleIdx ? { ...p, [field]: !p[field] } : p
        ));
    };

    const renderAdminsTab = () => (
        <View>
            <View style={[styles.tabCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={styles.tabCardHeader}>
                    <View>
                        <Text style={[styles.tabCardTitle, { color: T.text }]}>Admin User Accounts</Text>
                        <Text style={[styles.tabCardSubtitle, { color: T.subtext }]}>Manage who can access this portal.</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+ Add Admin</Text>
                    </TouchableOpacity>
                </View>

                {MOCK_ADMINS.map((admin, index) => (
                    <View key={admin.id} style={[styles.adminRow, { borderTopColor: T.border, borderTopWidth: index > 0 ? 1 : 0 }]}>
                        <View style={[styles.adminAvatar, { backgroundColor: ROLE_COLORS[admin.role] + '22' }]}>
                            <Text style={[styles.adminAvatarText, { color: ROLE_COLORS[admin.role] }]}>
                                {admin.name.split(' ').map(n => n[0]).join('')}
                            </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={[styles.adminName, { color: T.text }]}>{admin.name}</Text>
                            <Text style={[styles.adminEmail, { color: T.subtext }]}>{admin.email}</Text>
                            <Text style={[styles.adminLastLogin, { color: T.subtext }]}>Last login: {admin.lastLogin}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[admin.role] + '22' }]}>
                                <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[admin.role] }]}>
                                    {admin.role.toUpperCase()}
                                </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: admin.status === 'active' ? 'rgba(40,167,69,0.1)' : 'rgba(108,117,125,0.1)' }]}>
                                <Text style={[styles.statusBadgeText, { color: admin.status === 'active' ? '#28A745' : '#6C757D' }]}>
                                    {admin.status === 'active' ? '● Active' : '○ Inactive'}
                                </Text>
                            </View>
                        </View>
                        {admin.role !== 'superadmin' && (
                            <TouchableOpacity style={[styles.actionBtn, { borderColor: T.border }]}>
                                <Text style={[styles.actionBtnText, { color: T.subtext }]}>Manage</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );

    const renderPermissionsTab = () => (
        <View style={[styles.tabCard, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={styles.tabCardHeader}>
                <View>
                    <Text style={[styles.tabCardTitle, { color: T.text }]}>Module Access Permissions (Admin Role)</Text>
                    <Text style={[styles.tabCardSubtitle, { color: T.subtext }]}>
                        Fine-tune what the standard "Admin" role can view, edit, or delete.
                    </Text>
                </View>
                <TouchableOpacity style={styles.savePermBtn}>
                    <Text style={styles.savePermBtnText}>Save Changes</Text>
                </TouchableOpacity>
            </View>

            {/* Header Row */}
            <View style={[styles.permHeaderRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.permHeaderCell, { flex: 3, color: T.subtext }]}>MODULE</Text>
                <Text style={[styles.permHeaderCell, { color: T.subtext }]}>VIEW</Text>
                <Text style={[styles.permHeaderCell, { color: T.subtext }]}>EDIT</Text>
                <Text style={[styles.permHeaderCell, { color: T.subtext }]}>DELETE</Text>
            </View>

            {permissions.map((perm, i) => (
                <View key={perm.module} style={[styles.permRow, { borderBottomColor: T.border, backgroundColor: i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                    <Text style={[styles.permModule, { flex: 3, color: T.text }]}>{perm.module}</Text>
                    {(['view', 'edit', 'delete'] as const).map(field => (
                        <View key={field} style={styles.permToggle}>
                            <Switch
                                value={perm[field]}
                                onValueChange={() => togglePermission(i, field)}
                                trackColor={{ false: '#374151', true: '#3B7DDD' }}
                                thumbColor={perm[field] ? '#FFFFFF' : '#9CA3AF'}
                            />
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );

    const renderSettingsTab = () => (
        <View style={{ gap: 24 }}>
            {/* Platform Config */}
            <View style={[styles.tabCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={[styles.tabCardTitle, { color: T.text, marginBottom: 4 }]}>Platform Configuration</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>Core system settings for the GoRaahi platform.</Text>

                {[
                    { label: 'Platform Name', value: 'GoRaahi', editable: false },
                    { label: 'Support Email', value: 'support@goraahi.in', editable: true },
                    { label: 'Max Seats Per Ride', value: '6', editable: true },
                    { label: 'Booking Window (days)', value: '30', editable: true },
                    { label: 'Default Driver Verification Mode', value: 'Manual Review', editable: false },
                ].map(setting => (
                    <View key={setting.label} style={[styles.settingRow, { borderBottomColor: T.border }]}>
                        <Text style={[styles.settingLabel, { color: T.subtext }]}>{setting.label}</Text>
                        {setting.editable ? (
                            <TextInput
                                style={[styles.settingInput, { color: T.text, borderColor: T.border, backgroundColor: T.input }]}
                                defaultValue={setting.value}
                            />
                        ) : (
                            <Text style={[styles.settingValue, { color: T.text }]}>{setting.value}</Text>
                        )}
                    </View>
                ))}
            </View>

            {/* Route Pricing Multipliers */}
            <View style={[styles.tabCard, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={[styles.tabCardTitle, { color: T.text, marginBottom: 4 }]}>Route Pricing Multipliers</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>Adjust the fare multiplier per corridor to account for seasonality or demand surges.</Text>

                {[
                    { route: 'Bageshwar → Almora', multiplier: '1.20' },
                    { route: 'Almora → Haldwani', multiplier: '1.00' },
                    { route: 'Haldwani → Dehradun', multiplier: '1.15' },
                    { route: 'Champawat → Pithoragarh', multiplier: '1.30' },
                ].map(row => (
                    <View key={row.route} style={[styles.settingRow, { borderBottomColor: T.border }]}>
                        <Text style={[styles.settingLabel, { color: T.text }]}>{row.route}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                                style={[styles.settingInput, { color: T.text, borderColor: T.border, backgroundColor: T.input, width: 72 }]}
                                defaultValue={row.multiplier}
                                keyboardType="numeric"
                            />
                            <Text style={{ color: T.subtext, fontSize: 12 }}>× base</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Danger Zone */}
            <View style={[styles.tabCard, { backgroundColor: T.card, borderColor: '#DC354520' }]}>
                <Text style={[styles.tabCardTitle, { color: '#DC3545', marginBottom: 4 }]}>Danger Zone</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>Irreversible actions. Proceed with extreme caution.</Text>
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <TouchableOpacity style={styles.dangerBtn}>
                        <Text style={styles.dangerBtnText}>🗑 Purge Audit Logs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtn}>
                        <Text style={styles.dangerBtnText}>⚙️ Reset All Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logout} style={[styles.dangerBtn, { backgroundColor: '#DC3545', borderColor: '#DC3545' }]}>
                        <Text style={[styles.dangerBtnText, { color: '#fff' }]}>🚪 Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {/* Page Header */}
            <View style={styles.pageHeader}>
                <Text style={[styles.pageTitle, { color: T.text }]}>System Administration</Text>
                <Text style={[styles.pageSubtitle, { color: T.subtext }]}>
                    Configure admin accounts, access control, and platform behavior.
                </Text>
            </View>

            {/* Tab Switcher */}
            <View style={[styles.tabNav, { borderBottomColor: T.border }]}>
                {([
                    { id: 'admins', label: '👥 Admin Users', desc: 'Accounts' },
                    { id: 'permissions', label: '🔐 Permissions', desc: 'RBAC' },
                    { id: 'settings', label: '⚙️ Settings', desc: 'Platform' },
                ] as const).map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tabNavItem, activeTab === tab.id && { borderBottomColor: T.accent, borderBottomWidth: 3 }]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Text style={[styles.tabNavLabel, { color: activeTab === tab.id ? T.accent : T.subtext, fontWeight: activeTab === tab.id ? '600' : 'normal' }]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ paddingTop: 24 }}>
                {activeTab === 'admins' && renderAdminsTab()}
                {activeTab === 'permissions' && renderPermissionsTab()}
                {activeTab === 'settings' && renderSettingsTab()}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    pageHeader: { marginBottom: 24 },
    pageTitle: { fontSize: 20, fontWeight: '600' },
    pageSubtitle: { fontSize: 13, marginTop: 4 },
    tabNav: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 0 },
    tabNavItem: { paddingVertical: 12, paddingHorizontal: 16, marginBottom: -1 },
    tabNavLabel: { fontSize: 14 },
    tabCard: { borderRadius: 8, borderWidth: 1, padding: 24, marginBottom: 0 },
    tabCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    tabCardTitle: { fontSize: 16, fontWeight: '600' },
    tabCardSubtitle: { fontSize: 13, marginTop: 4 },
    addBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4 },
    addBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
    adminRow: { flexDirection: 'row', paddingVertical: 16, alignItems: 'center', gap: 0 },
    adminAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
    adminAvatarText: { fontSize: 14, fontWeight: 'bold' },
    adminName: { fontSize: 14, fontWeight: '600' },
    adminEmail: { fontSize: 13, marginTop: 1 },
    adminLastLogin: { fontSize: 11, marginTop: 2 },
    roleBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
    roleBadgeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
    statusBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: '500' },
    actionBtn: { marginLeft: 16, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
    actionBtnText: { fontSize: 12 },
    permHeaderRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, marginBottom: 4 },
    permHeaderCell: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, width: 70, textAlign: 'center' },
    permRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, alignItems: 'center' },
    permModule: { fontSize: 14 },
    permToggle: { width: 70, alignItems: 'center' },
    savePermBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4 },
    savePermBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    settingLabel: { fontSize: 14, flex: 1 },
    settingValue: { fontSize: 14, fontWeight: '500' },
    settingInput: { borderWidth: 1, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, fontSize: 14, width: 200 },
    dangerBtn: { borderWidth: 1, borderColor: '#DC3545', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
    dangerBtnText: { color: '#DC3545', fontSize: 13, fontWeight: '500' },
});
