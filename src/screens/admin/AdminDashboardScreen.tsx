import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, ScrollView, useWindowDimensions, Alert, TextInput
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AdminDashboardView from './AdminDashboardView';
import AdminBookingsView from './AdminBookingsView';
import AdminDriversView from './AdminDriversView';
import AdminRidesDetailView from './AdminRidesDetailView';
import AdminParcelsDetailView from './AdminParcelsDetailView';
import AdminVisitorsDetailView from './AdminVisitorsDetailView';
import AdminRoutesDetailView from './AdminRoutesDetailView';
import AdminReportsView from './AdminReportsView';
import AdminVehiclesView from './AdminVehiclesView';
import AdminFinanceView from './AdminFinanceView';
import AdminAuditLogsView from './AdminAuditLogsView';
import AdminSettingsView from './AdminSettingsView';
import RaahiLogo from '../../components/RaahiLogo';

type AdminView =
    | 'dashboard'
    // Driver Operations
    | 'driver_verification'
    | 'document_review'
    | 'drivers'
    | 'vehicles'
    // Ride Operations
    | 'active_rides'
    | 'completed_rides'
    | 'cancelled_rides'
    | 'routes'
    // Booking Operations
    | 'bookings'
    // Finance
    | 'finance'
    // Monitoring
    | 'NOTIFICATIONS'
    | 'reports'
    | 'audit_logs'
    // System
    | 'admin_users'
    | 'permissions'
    | 'settings';

interface NavSection {
    group: string;
    items: { id: AdminView; label: string; icon: string }[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        group: 'MAIN',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: '▦' },
        ],
    },
    {
        group: 'DRIVER OPERATIONS',
        items: [
            { id: 'driver_verification', label: 'Driver Verification', icon: '✅' },
            { id: 'document_review', label: 'Document Review', icon: '📄' },
            { id: 'drivers', label: 'Drivers', icon: '👤' },
            { id: 'vehicles', label: 'Vehicles', icon: '🚐' },
        ],
    },
    {
        group: 'RIDE OPERATIONS',
        items: [
            { id: 'active_rides', label: 'Active Rides', icon: '🟢' },
            { id: 'completed_rides', label: 'Completed Rides', icon: '🏁' },
            { id: 'cancelled_rides', label: 'Cancelled / Removed Rides', icon: '❌' },
            { id: 'routes', label: 'Routes', icon: '🗺️' },
        ],
    },
    {
        group: 'BOOKING OPERATIONS',
        items: [
            { id: 'bookings', label: 'Bookings', icon: '🎫' },
        ],
    },
    {
        group: 'FINANCE',
        items: [
            { id: 'finance', label: 'Commission & Settlement', icon: '💰' },
        ],
    },
    {
        group: 'MONITORING',
        items: [
            { id: 'NOTIFICATIONS', label: 'Notifications', icon: '🔔' },
            { id: 'reports', label: 'Reports & Analytics', icon: '📊' },
            { id: 'audit_logs', label: 'Audit Logs', icon: '📋' },
        ],
    },
    {
        group: 'SYSTEM',
        items: [
            { id: 'admin_users', label: 'Admin Users', icon: '🛡️' },
            { id: 'permissions', label: 'Permissions', icon: '🔐' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
        ],
    },
];

const LIGHT_THEME = {
    bg: '#F7F9FC',
    sidebar: '#222E3C',
    sidebarText: '#ADB5BD',
    sidebarActive: '#FFFFFF',
    sidebarActiveBg: 'rgba(255,255,255,0.05)',
    text: '#3E465B',
    subtext: '#6C757D',
    border: '#E9ECEF',
    accent: '#3B7DDD',
    contentBg: '#F7F9FC',
};

const DARK_THEME = {
    bg: '#111827',
    sidebar: '#1F2937',
    sidebarText: '#9CA3AF',
    sidebarActive: '#FFFFFF',
    sidebarActiveBg: 'rgba(255,255,255,0.08)',
    text: '#F9FAFB',
    subtext: '#6B7280',
    border: 'rgba(255,255,255,0.06)',
    accent: '#3B7DDD',
    contentBg: '#111827',
};

const PAGE_TITLES: Record<AdminView, string> = {
    dashboard: 'Analytics Dashboard',
    driver_verification: 'Driver Verification Queue',
    document_review: 'Document Review',
    drivers: 'Registered Drivers',
    vehicles: 'Vehicle Fleet',
    active_rides: 'Active Rides',
    completed_rides: 'Completed Rides',
    cancelled_rides: 'Cancelled / Removed Rides',
    routes: 'Route Analytics',
    bookings: 'Bookings Management',
    finance: 'Commission & Settlement',
    NOTIFICATIONS: 'System Notifications',
    reports: 'Reports & Analytics',
    audit_logs: 'Audit Logs',
    admin_users: 'Admin Users',
    permissions: 'Permissions',
    settings: 'Settings',
};

export default function AdminDashboardScreen() {
    const { token, user, logout } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [isDark, setIsDark] = useState(true);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; time: string; type: string; read: boolean }[]>([]);

    const unreadCount = notifications.filter(n => !n.read).length;
    const T = isDark ? DARK_THEME : LIGHT_THEME;

    const handleAction = (msg: string) => {
        if (Platform.OS === 'web') {
            window.alert(msg);
        } else {
            Alert.alert('Raahi Admin', msg);
        }
    };

    const handleLogout = () => { logout(); };

    const navigate = (view: AdminView) => {
        setActiveView(view);
        if (isMobile) setIsSidebarOpen(false);
    };

    const renderContent = () => {
        // Use key={activeView} on views that need full remount when switching between same component with different filters
        return (
            <ScrollView style={styles.pageBody} showsVerticalScrollIndicator={false}>
                {activeView === 'dashboard' && (
                    <AdminDashboardView
                        token={token!}
                        onNavigateToRides={() => navigate('active_rides')}
                        onNavigateToParcels={() => navigate('bookings')}
                        onNavigateToVisitors={() => navigate('admin_users')}
                        onNavigateToRoutes={() => navigate('routes')}
                    />
                )}
                {activeView === 'driver_verification' && (
                    <AdminDriversView key="driver_verification" token={token!} searchQuery={searchQuery} initialFilter="pending" />
                )}
                {activeView === 'document_review' && (
                    <AdminDriversView key="document_review" token={token!} searchQuery={searchQuery} initialFilter="all" />
                )}
                {activeView === 'drivers' && (
                    <AdminDriversView key="drivers" token={token!} searchQuery={searchQuery} initialFilter="verified" />
                )}
                {activeView === 'vehicles' && (
                    <AdminVehiclesView token={token!} searchQuery={searchQuery} isDark={isDark} />
                )}
                {activeView === 'active_rides' && (
                    <AdminRidesDetailView key="active_rides" isDark={isDark} searchQuery={searchQuery} initialTab="available" />
                )}
                {activeView === 'completed_rides' && (
                    <AdminRidesDetailView key="completed_rides" isDark={isDark} searchQuery={searchQuery} initialTab="completed" />
                )}
                {activeView === 'cancelled_rides' && (
                    <AdminRidesDetailView key="cancelled_rides" isDark={isDark} searchQuery={searchQuery} initialTab="cancelled" />
                )}
                {activeView === 'routes' && (
                    <AdminRoutesDetailView isDark={isDark} searchQuery={searchQuery} />
                )}
                {activeView === 'bookings' && (
                    <AdminBookingsView token={token!} searchQuery={searchQuery} />
                )}
                {activeView === 'finance' && (
                    <AdminFinanceView token={token!} searchQuery={searchQuery} isDark={isDark} />
                )}
                {activeView === 'NOTIFICATIONS' && (
                    <AdminNotificationsView
                        notifications={notifications}
                        onMarkRead={(id: string) => {
                            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                        }}
                        onNavigate={(type: string) => { setActiveView(type as AdminView); }}
                        isDark={isDark}
                    />
                )}
                {activeView === 'reports' && <AdminReportsView token={token!} />}
                {activeView === 'audit_logs' && (
                    <AdminAuditLogsView isDark={isDark} searchQuery={searchQuery} />
                )}
                {activeView === 'admin_users' && (
                    <AdminVisitorsDetailView isDark={isDark} searchQuery={searchQuery} />
                )}
                {activeView === 'permissions' && (
                    <AdminSettingsView key="permissions" isDark={isDark} activeTab="permissions" />
                )}
                {activeView === 'settings' && (
                    <AdminSettingsView key="settings" isDark={isDark} activeTab="settings" />
                )}
            </ScrollView>
        );
    };

    return (
        <View style={[styles.wrapper, { backgroundColor: T.bg }]}>
            {isMobile && isSidebarOpen && (
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {(!isMobile || isSidebarOpen) && (
                <View style={[styles.sidebar, isMobile && styles.sidebarMobile, { backgroundColor: T.sidebar }]}>
                    {/* Profile Area */}
                    <View style={styles.profileArea}>
                        <View style={styles.avatarWrapper}>
                            <RaahiLogo size={32} />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={[styles.profileName, { color: '#FFFFFF' }]}>
                                {user?.name || 'Admin User'}
                            </Text>
                            <Text style={[styles.profileRole, { color: T.sidebarText }]}>System Admin</Text>
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                        {NAV_SECTIONS.map(section => (
                            <View key={section.group} style={styles.sidebarSection}>
                                <Text style={[styles.sectionTitle, { color: T.sidebarText }]}>
                                    {section.group}
                                </Text>
                                {section.items.map(item => {
                                    const isActive = activeView === item.id;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.navItem,
                                                isActive && { borderLeftWidth: 3, borderLeftColor: T.accent, backgroundColor: T.sidebarActiveBg },
                                            ]}
                                            onPress={() => navigate(item.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={styles.navIconRow}>
                                                <Text style={[styles.navIcon, { color: isActive ? T.accent : T.sidebarText }]}>
                                                    {item.icon}
                                                </Text>
                                                <Text style={[styles.navLabel, { color: isActive ? '#FFFFFF' : T.sidebarText }]}>
                                                    {item.label}
                                                </Text>
                                            </View>
                                            {isActive && <View style={styles.activeDot} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}

                        {/* Tools */}
                        <View style={[styles.sidebarSection, styles.toolsSection]}>
                            <Text style={[styles.sectionTitle, { color: T.sidebarText }]}>TOOLS</Text>
                            <TouchableOpacity style={styles.navItem} onPress={() => setIsDark(!isDark)}>
                                <View style={styles.navIconRow}>
                                    <Text style={[styles.navIcon, { color: T.sidebarText }]}>{isDark ? '☀️' : '🌙'}</Text>
                                    <Text style={[styles.navLabel, { color: T.sidebarText }]}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
                                <View style={styles.navIconRow}>
                                    <Text style={[styles.navIcon, { color: T.sidebarText }]}>🚪</Text>
                                    <Text style={[styles.navLabel, { color: T.sidebarText }]}>Sign Out</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Main Content */}
            <View style={[styles.content, { backgroundColor: T.contentBg }]}>
                {/* Top header bar */}
                <View style={[styles.topBar, { borderBottomColor: T.border, backgroundColor: isDark ? T.sidebar : '#FFFFFF' }]}>
                    <View style={styles.topBarLeft}>
                        {isMobile && (
                            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.hamburger}>
                                <Text style={{ fontSize: 24, color: T.text }}>☰</Text>
                            </TouchableOpacity>
                        )}
                        <View style={[styles.searchBar, { backgroundColor: isDark ? '#111827' : '#F7F9FC' }]}>
                            <Text style={styles.searchIcon}>🔍</Text>
                            <TextInput
                                style={[styles.searchInput, { color: T.text }]}
                                placeholder="Search everything..."
                                placeholderTextColor={T.subtext}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        {!isMobile && (
                            <Text style={[styles.breadcrumb, { color: T.subtext }]}>
                                Admin / {PAGE_TITLES[activeView]}
                            </Text>
                        )}
                    </View>

                    <View style={styles.topBarRight}>
                        <TouchableOpacity onPress={() => setActiveView('NOTIFICATIONS')} style={styles.notificationWrapper}>
                            <Text style={styles.headerIcon}>🔔</Text>
                            {unreadCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAction('Profile Settings')} style={styles.profileBtn}>
                            <View style={[styles.profileThumb, { backgroundColor: '#3B7DDD22', borderColor: '#3B7DDD' }]}>
                                <Text style={{ color: '#3B7DDD', fontWeight: 'bold', fontSize: 12 }}>AD</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Page Body */}
                <View style={styles.pageBody}>
                    {renderContent()}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F7F9FC',
        ...(Platform.OS === 'web' ? ({ height: '100dvh' } as any) : {}),
    },
    sidebar: {
        width: 260,
        paddingTop: 10,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    sidebarMobile: {
        position: 'absolute',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        width: 260,
    },
    overlay: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 40,
    },
    topBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    hamburger: {
        marginRight: 16,
        padding: 4,
    },
    profileArea: {
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    avatarWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2E3D4D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileName: { fontSize: 15, fontWeight: '600' },
    profileRole: { fontSize: 13, opacity: 0.8 },
    sidebarSection: { marginBottom: 6 },
    toolsSection: { marginTop: 8, marginBottom: 24 },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        paddingHorizontal: 24,
        marginTop: 16,
        marginBottom: 6,
        opacity: 0.5,
    },
    navIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    activeDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        opacity: 0.5,
    },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    headerIcon: { fontSize: 20, color: '#6C757D' },
    profileThumb: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E9ECEF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DEE2E6'
    },
    profileBtn: { marginLeft: 8 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 0,
    },
    searchIcon: { fontSize: 14, color: '#6C757D', marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, padding: 0, outlineStyle: 'none' } as any,
    breadcrumb: { marginLeft: 20, fontSize: 13, opacity: 0.7 },
    navItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 9, paddingHorizontal: 24,
    },
    navIcon: { fontSize: 15, width: 22 },
    navLabel: { fontSize: 13, fontWeight: '500' },
    content: { flex: 1, flexDirection: 'column' },
    topBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, height: 64,
        borderBottomWidth: 1,
    },
    pageBody: { flex: 1 },
    notificationWrapper: { position: 'relative' },
    badge: {
        position: 'absolute',
        top: -4, right: -4,
        backgroundColor: '#DC3545',
        borderRadius: 10,
        width: 18, height: 18,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});

function AdminNotificationsView({ notifications, onMarkRead, onNavigate, isDark }: any) {
    const T = {
        bg: isDark ? '#1F2937' : '#fff',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#eee',
        text: isDark ? '#fff' : '#333',
        sub: isDark ? '#9CA3AF' : '#666',
    };

    return (
        <ScrollView style={{ padding: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: T.text, marginBottom: 20 }}>All Notifications</Text>
            {notifications.length === 0 && (
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                    <Text style={{ fontSize: 40, marginBottom: 16 }}>🔔</Text>
                    <Text style={{ color: T.sub, fontSize: 15 }}>No notifications yet.</Text>
                </View>
            )}
            {notifications.map((n: any) => (
                <TouchableOpacity
                    key={n.id}
                    onPress={() => {
                        onMarkRead(n.id);
                        onNavigate(n.type);
                    }}
                    style={{
                        backgroundColor: T.bg,
                        padding: 20, borderRadius: 12, marginBottom: 12,
                        borderWidth: 1, borderColor: T.border,
                        opacity: n.read ? 0.7 : 1,
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: T.text }}>{n.title}</Text>
                        <Text style={{ color: T.sub, marginTop: 4 }}>{n.message}</Text>
                        <Text style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>{n.time}</Text>
                    </View>
                    {!n.read && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B7DDD' }} />}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}
