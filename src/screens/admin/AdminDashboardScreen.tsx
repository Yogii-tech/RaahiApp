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
import RaahiLogo from '../../components/RaahiLogo';

type AdminView = 'dashboard' | 'bookings' | 'drivers' | 'reports' | 'RIDES_DETAIL' | 'PARCELS_DETAIL' | 'VISITORS_DETAIL' | 'ROUTES_DETAIL' | 'NOTIFICATIONS';

const NAV_ITEMS: { id: AdminView; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: '▦' },
    { id: 'bookings', label: 'BOOKINGS', icon: '👤' },
    { id: 'drivers', label: 'DRIVERS', icon: '🚗' },
    { id: 'reports', label: 'REPORTS', icon: '🗑' },
];

const LIGHT_THEME = {
    bg: '#F7F9FC',
    sidebar: '#222E3C', // AdminKit Dark Sidebar
    sidebarText: '#ADB5BD',
    sidebarActive: '#FFFFFF',
    sidebarActiveBg: 'rgba(255,255,255,0.05)',
    text: '#3E465B',
    subtext: '#6C757D',
    border: '#E9ECEF',
    accent: '#3B7DDD', // AdminKit Blue
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

    const handleLogout = () => {
        logout();
    };

    const renderContent = () => {
        return (
            <ScrollView style={styles.pageBody} showsVerticalScrollIndicator={false}>
                {activeView === 'dashboard' && (
                    <AdminDashboardView
                        token={token!}
                        onNavigateToRides={() => setActiveView('RIDES_DETAIL')}
                        onNavigateToParcels={() => setActiveView('PARCELS_DETAIL')}
                        onNavigateToVisitors={() => setActiveView('VISITORS_DETAIL')}
                        onNavigateToRoutes={() => setActiveView('ROUTES_DETAIL')}
                    />
                )}
                {activeView === 'RIDES_DETAIL' && <AdminRidesDetailView isDark={isDark} searchQuery={searchQuery} />}
                {activeView === 'PARCELS_DETAIL' && <AdminParcelsDetailView isDark={isDark} searchQuery={searchQuery} />}
                {activeView === 'VISITORS_DETAIL' && <AdminVisitorsDetailView isDark={isDark} searchQuery={searchQuery} />}
                {activeView === 'ROUTES_DETAIL' && <AdminRoutesDetailView isDark={isDark} searchQuery={searchQuery} />}
                {activeView === 'bookings' && <AdminBookingsView token={token!} searchQuery={searchQuery} />}
                {activeView === 'drivers' && <AdminDriversView token={token!} searchQuery={searchQuery} />}
                {activeView === 'reports' && <AdminReportsView token={token!} />}
                {activeView === 'NOTIFICATIONS' && (
                    <AdminNotificationsView
                        notifications={notifications}
                        onMarkRead={(id: string) => {
                            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                        }}
                        onNavigate={(type: string) => {
                            setActiveView(type as AdminView);
                        }}
                        isDark={isDark}
                    />
                )}
            </ScrollView>
        );
    };

    const headerTitles: Record<AdminView, string> = {
        dashboard: 'Analytics Dashboard',
        bookings: 'Bookings Management',
        drivers: 'Driver Verification',
        reports: 'System Reports',
        RIDES_DETAIL: 'Rides Overview',
        PARCELS_DETAIL: 'Parcels Overview',
        VISITORS_DETAIL: 'Visitors Overview',
        ROUTES_DETAIL: 'Route Analytics',
        NOTIFICATIONS: 'System Notifications',
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
                    {/* AdminKit Style Profile in Sidebar */}
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

                    <View style={[styles.sidebarSection, { marginTop: 10 }]}>
                        <Text style={[styles.sectionTitle, { color: T.sidebarText }]}>Pages</Text>
                        {NAV_ITEMS.map(item => {
                            let isActive = activeView === item.id;
                            if (item.id === 'dashboard' && (activeView === 'RIDES_DETAIL' || activeView === 'PARCELS_DETAIL' || activeView === 'VISITORS_DETAIL' || activeView === 'ROUTES_DETAIL')) isActive = true;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.navItem,
                                        isActive && { borderLeftWidth: 3, borderLeftColor: T.accent, backgroundColor: T.sidebarActiveBg },
                                    ]}
                                    onPress={() => {
                                        setActiveView(item.id);
                                        if (isMobile) setIsSidebarOpen(false);
                                    }}
                                    activeOpacity={0.8}>
                                    <View style={styles.navIconRow}>
                                        <Text style={[styles.navIcon, { color: isActive ? T.accent : T.sidebarText, fontSize: 18 }]}>
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

                    <View style={styles.sidebarSection}>
                        <Text style={[styles.sectionTitle, { color: T.sidebarText }]}>Tools</Text>
                        <TouchableOpacity style={styles.navItem} onPress={() => setIsDark(!isDark)}>
                            <View style={styles.navIconRow}>
                                <Text style={[styles.navIcon, { color: T.sidebarText }]}>{isDark ? '☀️' : '🌙'}</Text>
                                <Text style={[styles.navLabel, { color: T.sidebarText }]}>{isDark ? 'LIGHT MODE' : 'DARK MODE'}</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
                            <View style={styles.navIconRow}>
                                <Text style={[styles.navIcon, { color: T.sidebarText }]}>🚪</Text>
                                <Text style={[styles.navLabel, { color: T.sidebarText }]}>SIGN OUT</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
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
                        <Text style={[styles.headerLinks, { color: T.text }]}>Mega Menu   Resources ▾</Text>
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
    },
    hamburger: {
        marginRight: 16,
        padding: 4,
    },
    profileArea: {
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
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
    sidebarSection: { marginBottom: 24 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 24,
        marginBottom: 12,
        opacity: 0.5,
    },
    navIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    activeDot: {
        width: 6,
        height: 6,
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
    profileBtn: {
        marginLeft: 8
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7F9FC',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 10,
    },
    searchIcon: { fontSize: 14, color: '#6C757D', marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, padding: 0, outlineStyle: 'none' } as any,
    headerLinks: { marginLeft: 20, color: '#3E465B', fontSize: 14, fontWeight: '500', opacity: 0.8 },
    logoIcon: {
        width: 36, height: 36, borderRadius: 8,
        backgroundColor: '#1FAF63',
        justifyContent: 'center', alignItems: 'center',
    },
    logoIconText: { fontSize: 18 },
    logoTitle: { fontSize: 14, fontWeight: 'bold', lineHeight: 18 },
    logoSubtitle: { fontSize: 9, lineHeight: 14, maxWidth: 140 },
    navItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 24,
    },
    navIcon: { fontSize: 16, width: 24 },
    navLabel: { fontSize: 14, fontWeight: '500', letterSpacing: 0.5 },
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
        top: -4,
        right: -4,
        backgroundColor: '#DC3545',
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
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
            {notifications.map((n: any) => (
                <TouchableOpacity
                    key={n.id}
                    onPress={() => {
                        onMarkRead(n.id);
                        onNavigate(n.type);
                    }}
                    style={{
                        backgroundColor: T.bg,
                        padding: 20,
                        borderRadius: 12,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: T.border,
                        opacity: n.read ? 0.7 : 1,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
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
