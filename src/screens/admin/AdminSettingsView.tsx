import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, useWindowDimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../utils/notify';
import SignOutConfirmModal, { useSignOutConfirmation } from './SignOutConfirmModal';

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
    const {
        visible: signOutModalVisible,
        isSigningOut,
        openConfirm: handleSignOutPress,
        cancelSignOut,
        confirmSignOut,
    } = useSignOutConfirmation(logout);
    const [activeTab, setActiveTab] = useState<'admins' | 'permissions' | 'settings'>(initialTab);
    const [permissions, setPermissions] = useState<PermissionRow[]>(INITIAL_PERMISSIONS);
    const [platformConfig, setPlatformConfig] = useState({
        supportEmail: 'support@goraahi.in',
        maxSeatsPerRide: '6',
        bookingWindowDays: '30',
    });
    const [routeMultipliers, setRouteMultipliers] = useState<Record<string, string>>({
        'Bageshwar → Almora': '1.20',
        'Almora → Haldwani': '1.00',
        'Haldwani → Dehradun': '1.15',
        'Champawat → Pithoragarh': '1.30',
    });
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

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
        setPermissions(prev => prev.map((p, i) => {
            if (i !== moduleIdx) return p;
            const nextVal = !p[field];
            if (field === 'view' && !nextVal) {
                return { ...p, view: false, edit: false, delete: false };
            }
            if ((field === 'edit' || field === 'delete') && nextVal) {
                return { ...p, [field]: true, view: true };
            }
            return { ...p, [field]: nextVal };
        }));
    };

    const showPreviewNotice = (actionName: string) => {
        notify(
            'Preview / Demo Mode',
            `"${actionName}" is preview-only in this release and does not persist changes to the backend.`
        );
    };

    const renderAdminsTab = () => (
        <View>
            <View style={[styles.tabCard, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={[styles.tabCardHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: isMobile ? 0 : 12 }}>
                        <Text style={[styles.tabCardTitle, { color: T.text }]}>Admin User Accounts</Text>
                        <Text style={[styles.tabCardSubtitle, { color: T.subtext }]}>Manage who can access this portal (demo directory).</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => showPreviewNotice('Add Admin')}>
                        <Text style={styles.addBtnText}>+ Add Admin (Preview)</Text>
                    </TouchableOpacity>
                </View>

                {MOCK_ADMINS.map((admin, index) => (
                    <View key={admin.id} style={[styles.adminRow, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }, { borderTopColor: T.border, borderTopWidth: index > 0 ? 1 : 0 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                            <View style={[styles.adminAvatar, { backgroundColor: ROLE_COLORS[admin.role] + '22', flexShrink: 0 }]}>
                                <Text style={[styles.adminAvatarText, { color: ROLE_COLORS[admin.role] }]}>
                                    {admin.name.split(' ').map(n => n[0]).join('')}
                                </Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
                                <Text style={[styles.adminName, { color: T.text }]} numberOfLines={1}>{admin.name}</Text>
                                <Text style={[styles.adminEmail, { color: T.subtext }]} numberOfLines={1} ellipsizeMode="tail">{admin.email}</Text>
                                <Text style={[styles.adminLastLogin, { color: T.subtext }]} numberOfLines={1}>Last login: {admin.lastLogin}</Text>
                            </View>
                        </View>
                        <View style={[styles.adminMetaActions, isMobile && { justifyContent: 'space-between', paddingLeft: 56 }]}>
                            <View style={{ flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-end', gap: 8 }}>
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
                                <TouchableOpacity
                                    style={[styles.actionBtn, isMobile && { marginLeft: 0 }, { borderColor: T.border }]}
                                    onPress={() => showPreviewNotice(`Manage ${admin.name}`)}
                                >
                                    <Text style={[styles.actionBtnText, { color: T.subtext }]}>Manage</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderPermissionsTab = () => (
        <View style={[styles.tabCard, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.tabCardHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: isMobile ? 0 : 12 }}>
                    <Text style={[styles.tabCardTitle, { color: T.text }]}>Module Access Permissions (Admin Role)</Text>
                    <Text style={[styles.tabCardSubtitle, { color: T.subtext }]}>
                        Fine-tune what the standard "Admin" role can view, edit, or delete (preview toggles only).
                    </Text>
                </View>
                <TouchableOpacity style={styles.savePermBtn} onPress={() => showPreviewNotice('Save Permission Changes')}>
                    <Text style={styles.savePermBtnText}>Save Changes (Preview)</Text>
                </TouchableOpacity>
            </View>

            {/* Header Row */}
            <View style={[styles.permHeaderRow, { borderBottomColor: T.border }]}>
                <Text style={[styles.permHeaderCell, { flex: 3, textAlign: 'left', color: T.subtext }]}>MODULE</Text>
                <Text style={[styles.permHeaderCell, isMobile && { width: 48 }, { color: T.subtext }]}>VIEW</Text>
                <Text style={[styles.permHeaderCell, isMobile && { width: 48 }, { color: T.subtext }]}>EDIT</Text>
                <Text style={[styles.permHeaderCell, isMobile && { width: 48 }, { color: T.subtext }]}>DELETE</Text>
            </View>

            {permissions.map((perm, i) => (
                <View key={perm.module} style={[styles.permRow, { borderBottomColor: T.border, backgroundColor: i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.01)' : '#F8FAFC') : 'transparent' }]}>
                    <Text style={[styles.permModule, { flex: 3, minWidth: 0, paddingRight: 8, color: T.text }]}>{perm.module}</Text>
                    {(['view', 'edit', 'delete'] as const).map(field => (
                        <View key={field} style={[styles.permToggle, isMobile && { width: 48 }]}>
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
            <View style={[styles.tabCard, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={[styles.tabCardTitle, { color: T.text, marginBottom: 4 }]}>Platform Configuration</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>Core system settings for the GoRaahi platform.</Text>

                {[
                    { key: 'platformName', label: 'Platform Name', value: 'GoRaahi', editable: false },
                    { key: 'supportEmail', label: 'Support Email', value: platformConfig.supportEmail, editable: true },
                    { key: 'maxSeatsPerRide', label: 'Max Seats Per Ride', value: platformConfig.maxSeatsPerRide, editable: true },
                    { key: 'bookingWindowDays', label: 'Booking Window (days)', value: platformConfig.bookingWindowDays, editable: true },
                    { key: 'verificationMode', label: 'Default Driver Verification Mode', value: 'Manual Review', editable: false },
                ].map(setting => (
                    <View key={setting.key} style={[styles.settingRow, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 8 }, { borderBottomColor: T.border }]}>
                        <Text style={[styles.settingLabel, { color: T.subtext }]}>{setting.label}</Text>
                        {setting.editable ? (
                            <TextInput
                                style={[styles.settingInput, isMobile && { width: '100%' }, { color: T.text, borderColor: T.border, backgroundColor: T.input }]}
                                value={setting.value}
                                onChangeText={val => setPlatformConfig(prev => ({ ...prev, [setting.key]: val }))}
                            />
                        ) : (
                            <Text style={[styles.settingValue, { color: T.text }]}>{setting.value}</Text>
                        )}
                    </View>
                ))}
            </View>

            {/* Route Pricing Multipliers */}
            <View style={[styles.tabCard, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={[styles.tabCardTitle, { color: T.text, marginBottom: 4 }]}>Route Pricing Multipliers</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>Adjust the fare multiplier per corridor to account for seasonality or demand surges.</Text>

                {Object.entries(routeMultipliers).map(([route, multiplier]) => (
                    <View key={route} style={[styles.settingRow, isMobile && { flexWrap: 'wrap', gap: 8 }, { borderBottomColor: T.border }]}>
                        <Text style={[styles.settingLabel, { color: T.text, minWidth: 140 }]}>{route}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                                style={[styles.settingInput, { color: T.text, borderColor: T.border, backgroundColor: T.input, width: 72 }]}
                                value={multiplier}
                                onChangeText={val => setRouteMultipliers(prev => ({ ...prev, [route]: val }))}
                                keyboardType="numeric"
                            />
                            <Text style={{ color: T.subtext, fontSize: 12 }}>× base</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Danger Zone */}
            <View style={[styles.tabCard, isMobile && { padding: 16 }, { backgroundColor: T.card, borderColor: '#DC354520' }]}>
                <Text style={[styles.tabCardTitle, { color: '#DC3545', marginBottom: 4 }]}>Danger Zone</Text>
                <Text style={[styles.tabCardSubtitle, { color: T.subtext, marginBottom: 20 }]}>
                    Destructive admin actions are disabled in Preview / Demo Mode. Sign Out remains active.
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <TouchableOpacity style={styles.dangerBtn} onPress={() => showPreviewNotice('Purge Audit Logs')}>
                        <Text style={styles.dangerBtnText}>🗑 Purge Audit Logs (Preview)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerBtn} onPress={() => showPreviewNotice('Reset All Settings')}>
                        <Text style={styles.dangerBtnText}>⚙️ Reset All Settings (Preview)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        testID="admin-settings-signout-btn"
                        onPress={handleSignOutPress}
                        style={[
                            styles.dangerBtn,
                            { backgroundColor: '#DC3545', borderColor: '#DC3545' },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Sign Out"
                    >
                        <Text style={[styles.dangerBtnText, { color: '#fff' }]}>🚪 Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <>
            <ScrollView style={[styles.container, isMobile && { padding: 16 }, { backgroundColor: T.bg }]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {/* Page Header */}
            <View style={styles.pageHeader}>
                <Text style={[styles.pageTitle, { color: T.text }]}>System Administration</Text>
                <Text style={[styles.pageSubtitle, { color: T.subtext }]}>
                    Configure admin accounts, access control, and platform behavior.
                </Text>
            </View>

            <View style={[styles.previewBanner, { borderColor: '#FCB92C66', backgroundColor: isDark ? 'rgba(252, 185, 44, 0.12)' : '#FFFBEB' }]}>
                <Text style={[styles.previewBannerTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                    Preview / Demo Mode
                </Text>
                <Text style={[styles.previewBannerText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
                    Admin accounts, permission toggles, route multipliers, and platform configuration here are local preview controls and do not persist to the backend.
                </Text>
            </View>

            {/* Tab Switcher */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <View style={styles.tabNav}>
                    {([
                        { id: 'admins', label: '👥 Admin Users', desc: 'Accounts' },
                        { id: 'permissions', label: '🔐 Permissions', desc: 'RBAC' },
                        { id: 'settings', label: '⚙️ Settings', desc: 'Platform' },
                    ] as const).map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabNavItem, isMobile && { paddingHorizontal: 12 }, activeTab === tab.id && { borderBottomColor: T.accent, borderBottomWidth: 3 }]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.tabNavLabel, { color: activeTab === tab.id ? T.accent : T.subtext, fontWeight: activeTab === tab.id ? '600' : 'normal' }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <View style={{ paddingTop: 24 }}>
                {activeTab === 'admins' && renderAdminsTab()}
                {activeTab === 'permissions' && renderPermissionsTab()}
                {activeTab === 'settings' && renderSettingsTab()}
            </View>
            </ScrollView>
            <SignOutConfirmModal
                visible={signOutModalVisible}
                isDark={isDark}
                isSigningOut={isSigningOut}
                onCancel={cancelSignOut}
                onConfirm={confirmSignOut}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24 },
    pageHeader: { marginBottom: 16 },
    previewBanner: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18 },
    previewBannerTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    previewBannerText: { fontSize: 12, lineHeight: 18 },
    pageTitle: { fontSize: 20, fontWeight: '600' },
    pageSubtitle: { fontSize: 13, marginTop: 4 },
    tabNav: { flexDirection: 'row', marginBottom: 0 },
    tabNavItem: { paddingVertical: 12, paddingHorizontal: 16, marginBottom: -1 },
    tabNavLabel: { fontSize: 14 },
    tabCard: { borderRadius: 8, borderWidth: 1, padding: 24, marginBottom: 0 },
    tabCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    tabCardTitle: { fontSize: 16, fontWeight: '600' },
    tabCardSubtitle: { fontSize: 13, marginTop: 4 },
    addBtn: { backgroundColor: '#3B7DDD', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4 },
    addBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
    adminRow: { flexDirection: 'row', paddingVertical: 16, alignItems: 'center', gap: 0 },
    adminMetaActions: { flexDirection: 'row', alignItems: 'center' },
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
