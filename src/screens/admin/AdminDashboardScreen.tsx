import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import AdminDashboardView from './AdminDashboardView';
import AdminBookingsView from './AdminBookingsView';
import AdminDriversView from './AdminDriversView';
import AdminCommsView from './AdminCommsView';
import AdminReportsView from './AdminReportsView';

type AdminView = 'dashboard' | 'bookings' | 'drivers' | 'comms' | 'reports';

const NAV_ITEMS: { id: AdminView; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: '▦' },
    { id: 'bookings', label: 'BOOKINGS', icon: '👤' },
    { id: 'drivers', label: 'DRIVERS', icon: '🚗' },
    { id: 'comms', label: 'COMMS', icon: '↑' },
    { id: 'reports', label: 'REPORTS', icon: '🗑' },
];

const LIGHT_THEME = {
    bg: '#F3F4F6',
    sidebar: '#FFFFFF',
    text: '#111827',
    subtext: '#6B7280',
    border: '#E5E7EB',
    accent: '#1FAF63',
    contentBg: '#F3F4F6',
};

const DARK_THEME = {
    bg: '#0D1117',
    sidebar: '#111827',
    text: '#F9FAFB',
    subtext: '#6B7280',
    border: 'rgba(255,255,255,0.06)',
    accent: '#1FAF63',
    contentBg: '#0D1117',
};

export default function AdminDashboardScreen() {
    const { token, user, logout } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [isDark, setIsDark] = useState(true);
    const [pendingCount] = useState(5);

    const T = isDark ? DARK_THEME : LIGHT_THEME;

    const handleLogout = () => {
        logout();
    };

    const renderContent = () => {
        switch (activeView) {
            case 'dashboard': return <AdminDashboardView token={token!} />;
            case 'bookings': return <AdminBookingsView token={token!} />;
            case 'drivers': return <AdminDriversView token={token!} />;
            case 'comms': return <AdminCommsView />;
            case 'reports': return <AdminReportsView token={token!} />;
        }
    };

    const headerTitles: Record<AdminView, string> = {
        dashboard: 'Dashboard',
        bookings: 'Bookings',
        drivers: 'Drivers',
        comms: 'Comms',
        reports: 'Reports',
    };

    return (
        <View style={[styles.wrapper, { backgroundColor: T.bg }]}>
            {/* Sidebar */}
            <View style={[styles.sidebar, { backgroundColor: T.sidebar, borderRightColor: T.border }]}>
                {/* Logo */}
                <View style={styles.logoArea}>
                    <View style={styles.logoIcon}>
                        <Text style={styles.logoIconText}>⛰</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.logoTitle, { color: T.text }]}>GoRaahi Admin</Text>
                        <Text style={[styles.logoSubtitle, { color: T.subtext }]}>
                            जहाँ से पहाड़ शुरू, वहाँ से हम शुरू
                        </Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: T.border }]} />

                {/* Nav Items */}
                <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
                    {NAV_ITEMS.map(item => {
                        const isActive = activeView === item.id;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.navItem,
                                    isActive && { backgroundColor: T.accent },
                                    !isActive && { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' },
                                ]}
                                onPress={() => setActiveView(item.id)}
                                activeOpacity={0.8}>
                                <Text style={[styles.navIcon, { color: isActive ? '#FFFFFF' : T.subtext }]}>
                                    {item.icon}
                                </Text>
                                <Text style={[styles.navLabel, { color: isActive ? '#FFFFFF' : T.text }]}>
                                    {item.label}
                                </Text>
                                {item.id === 'bookings' && pendingCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{pendingCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={[styles.divider, { backgroundColor: T.border }]} />

                {/* Bottom: Theme Toggle + Logout */}
                <TouchableOpacity
                    style={[styles.themeToggle, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                    onPress={() => setIsDark(!isDark)}
                    activeOpacity={0.8}>
                    <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
                    <Text style={[styles.themeLabel, { color: T.subtext }]}>
                        {isDark ? 'Light Mode' : 'Dark Mode'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.passengerViewBtn}
                    onPress={handleLogout}
                    activeOpacity={0.8}>
                    <Text style={styles.passengerViewIcon}>→</Text>
                    <Text style={[styles.passengerViewLabel, { color: T.subtext }]}>
                        SIGN OUT
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={[styles.content, { backgroundColor: T.contentBg }]}>
                {/* Top header bar */}
                <View style={[styles.topBar, { borderBottomColor: T.border, backgroundColor: T.sidebar }]}>
                    <View>
                        <Text style={[styles.pageTitle, { color: T.text }]}>
                            {headerTitles[activeView]}
                        </Text>
                        <Text style={[styles.pageSubtitle, { color: T.subtext }]}>MANAGEMENT HUB</Text>
                    </View>
                    <Text style={[styles.adminName, { color: T.subtext }]}>
                        👤 {user?.name ?? 'Admin'}
                    </Text>
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
        ...(Platform.OS === 'web' ? ({ height: '100dvh' } as any) : {}),
    },
    sidebar: {
        width: 220,
        paddingTop: 24,
        paddingBottom: 16,
        borderRightWidth: 1,
        flexShrink: 0,
    },
    logoArea: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    logoIcon: {
        width: 36, height: 36, borderRadius: 8,
        backgroundColor: '#1FAF63',
        justifyContent: 'center', alignItems: 'center',
    },
    logoIconText: { fontSize: 18 },
    logoTitle: { fontSize: 14, fontWeight: 'bold', lineHeight: 18 },
    logoSubtitle: { fontSize: 9, lineHeight: 14, maxWidth: 140 },
    divider: { height: 1, marginHorizontal: 16, marginVertical: 12 },
    navList: { flex: 1, paddingHorizontal: 12 },
    navItem: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
        marginBottom: 6,
    },
    navIcon: { fontSize: 16, width: 24 },
    navLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, flex: 1 },
    badge: {
        backgroundColor: '#1FAF63', borderRadius: 10,
        minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    themeToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 12, borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
    },
    themeLabel: { fontSize: 12, fontWeight: 'bold' },
    passengerViewBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 12, paddingVertical: 10, paddingHorizontal: 12,
    },
    passengerViewIcon: { color: '#6B7280', fontSize: 16 },
    passengerViewLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
    content: { flex: 1, flexDirection: 'column' },
    topBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 28, paddingVertical: 16,
        borderBottomWidth: 1,
    },
    pageTitle: { fontSize: 22, fontWeight: 'bold' },
    pageSubtitle: { fontSize: 11, letterSpacing: 2, marginTop: 2 },
    adminName: { fontSize: 13 },
    pageBody: { flex: 1 },
});
