import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
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
import { confirmAction, notify } from '../../utils/notify';
import { createRequestAbort } from '../../utils/json';
import SignOutConfirmModal, { useSignOutConfirmation } from './SignOutConfirmModal';
import {
    FCMNotificationPayload,
    getWebNotificationPermission,
    registerFCM,
    WebPushPermissionState,
} from '../../services/fcmService';
import {
    ADMIN_PAGE_TITLES,
    AdminDeepLinkPayload,
    AdminNotification,
    AdminNotificationFilter,
    AdminView,
    clearAllNotificationsApi,
    extractNotificationContext,
    fetchAdminNotificationsApi,
    fetchUnreadNotificationCountApi,
    markAllNotificationsReadApi,
    markNotificationReadApi,
    mergeAndDeduplicateNotifications,
    normalizeNotificationRecord,
    parseAdminDeepLinkSearch,
    resolveAdminTargetView,
    resolveNotificationCategory,
    sendTestPushApi,
} from '../../utils/adminNotifications';
import {
    AdminForegroundToast,
    AdminNotificationBellPopover,
    AdminNotificationsView,
    AdminPushPermissionBanner,
} from './AdminNotificationsPanel';

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
            { id: 'parcels', label: 'Parcels', icon: '📦' },
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

const POLL_INTERVAL_MS = 15000;
const TOAST_DURATION_MS = 5500;

function isAppCurrentlyActive(): boolean {
    if (Platform.OS === 'web') {
        return typeof document === 'undefined' || document.visibilityState === 'visible';
    }
    const state = AppState.currentState;
    return typeof state !== 'string' || (state !== 'background' && state !== 'inactive');
}

interface ForegroundToastState {
    id: string;
    title: string;
    body: string;
    type?: string;
    category?: string;
    payload: FCMNotificationPayload;
}

export default function AdminDashboardScreen() {
    const { token, user, logout, fetchWithAuth } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [isDark, setIsDark] = useState(true);
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Notification state
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [refreshingNotifications, setRefreshingNotifications] = useState(false);
    const [notifError, setNotifError] = useState<string | null>(null);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [clearingNotifications, setClearingNotifications] = useState(false);
    const [testingPush, setTestingPush] = useState(false);
    const [bellPopoverOpen, setBellPopoverOpen] = useState(false);
    const [pushPermission, setPushPermission] = useState<WebPushPermissionState>(() =>
        getWebNotificationPermission()
    );
    const [pushBannerDismissed, setPushBannerDismissed] = useState(false);
    const [foregroundToast, setForegroundToast] = useState<ForegroundToastState | null>(null);

    const [isAppActive, setIsAppActive] = useState<boolean>(() => isAppCurrentlyActive());

    const isMountedRef = useRef(true);
    const fetchWithAuthRef = useRef(fetchWithAuth);
    fetchWithAuthRef.current = fetchWithAuth;
    const tokenRef = useRef(token);
    tokenRef.current = token;
    const activeViewRef = useRef(activeView);
    activeViewRef.current = activeView;
    const fcmRegisteredUserRef = useRef<string | null>(null);
    const notificationsRef = useRef(notifications);
    notificationsRef.current = notifications;
    const notifAbortRef = useRef<AbortController | null>(null);
    const notifFetchSeqRef = useRef(0);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const coldStartHandledRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            notifFetchSeqRef.current += 1;
            notifAbortRef.current?.abort();
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
            }
        };
    }, []);

    const localUnreadCount = useMemo(
        () => notifications.filter((n) => !n.read).length,
        [notifications]
    );
    const unreadCount = serverUnreadCount !== null ? serverUnreadCount : localUnreadCount;

    const T = isDark ? DARK_THEME : LIGHT_THEME;

    const handleAction = (msg: string) => {
        notify('Raahi Admin', msg);
    };

    const {
        visible: signOutModalVisible,
        isSigningOut,
        openConfirm: handleLogoutPress,
        cancelSignOut,
        confirmSignOut,
    } = useSignOutConfirmation(logout);

    const navigate = useCallback((view: AdminView) => {
        if (view !== activeViewRef.current) {
            setSearchQuery('');
        }
        setActiveView(view);
        setBellPopoverOpen(false);
        if (isMobile) setIsSidebarOpen(false);
    }, [isMobile]);

    const dismissToast = useCallback(() => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
        setForegroundToast(null);
    }, []);

    const loadNotifications = useCallback(async (background = false) => {
        if (!tokenRef.current) return;

        notifAbortRef.current?.abort();
        const { controller, cleanup, didTimeout } = createRequestAbort(10000);
        notifAbortRef.current = controller;
        const seq = ++notifFetchSeqRef.current;

        if (background) {
            setRefreshingNotifications(true);
        } else if (notificationsRef.current.length === 0) {
            setLoadingNotifications(true);
        }

        try {
            const [listResult, countResult] = await Promise.allSettled([
                fetchAdminNotificationsApi(fetchWithAuthRef.current, {
                    limit: 100,
                    signal: controller.signal,
                }),
                fetchUnreadNotificationCountApi(fetchWithAuthRef.current, controller.signal),
            ]);

            if (!isMountedRef.current || seq !== notifFetchSeqRef.current) return;

            if (listResult.status === 'fulfilled') {
                setNotifications(listResult.value);
                setNotifError(null);
                if (countResult.status === 'fulfilled' && countResult.value !== null) {
                    setServerUnreadCount(countResult.value);
                } else {
                    setServerUnreadCount(null);
                }
            } else {
                const reason = listResult.reason as any;
                if (reason?.name === 'AbortError' && !didTimeout()) return;
                setNotifError(
                    didTimeout()
                        ? 'Timed out loading notifications'
                        : reason?.message || 'Failed to load notifications'
                );
            }
        } catch (err: any) {
            if (!isMountedRef.current || seq !== notifFetchSeqRef.current) return;
            if (err?.name === 'AbortError' && !didTimeout()) return;
            setNotifError(err?.message || 'Failed to load notifications');
        } finally {
            cleanup();
            if (isMountedRef.current && seq === notifFetchSeqRef.current) {
                setLoadingNotifications(false);
                setRefreshingNotifications(false);
            }
        }
    }, []);

    const loadNotificationsRef = useRef(loadNotifications);
    loadNotificationsRef.current = loadNotifications;

    // Mark a single notification as read (optimistic + API call)
    const markNotificationRead = useCallback((notificationId: string) => {
        if (!notificationId) return;
        const existing = notificationsRef.current.find((n) => n.id === notificationId);
        const wasUnread = existing ? !existing.read : false;

        if (existing && !existing.read) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
            );
        }
        if (wasUnread) {
            setServerUnreadCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
        }

        markNotificationReadApi(fetchWithAuthRef.current, notificationId).catch(() => {});
    }, []);

    // Navigate from an in-app notification, push toast, SW click, or cold-start deep link
    const navigateFromNotificationPayload = useCallback(
        (payload: AdminDeepLinkPayload & { id?: string }) => {
            const notifId = payload.notificationId || payload.id || '';
            if (notifId) {
                markNotificationRead(notifId);
            }

            const targetView = resolveAdminTargetView({
                targetView: payload.targetView,
                adminView: payload.adminView,
                type: payload.type,
                url: payload.url,
                metadata: payload.metadata,
            });

            const { searchQuery: contextSearch } = extractNotificationContext({
                type: payload.type,
                relatedId: payload.relatedId,
                targetView,
                metadata: payload.metadata,
            });

            setActiveView(targetView);
            setSearchQuery(contextSearch);
            setBellPopoverOpen(false);
            if (isMobile) setIsSidebarOpen(false);
            dismissToast();
        },
        [dismissToast, isMobile, markNotificationRead]
    );

    const navigateFromNotificationPayloadRef = useRef(navigateFromNotificationPayload);
    navigateFromNotificationPayloadRef.current = navigateFromNotificationPayload;

    const handleSelectNotification = useCallback(
        (notif: AdminNotification) => {
            navigateFromNotificationPayload({
                id: notif.id,
                notificationId: notif.id,
                type: notif.type,
                category: notif.category,
                targetView: notif.targetView,
                relatedId: notif.relatedId,
                metadata: notif.metadata,
                title: notif.title,
                body: notif.message,
            });
        },
        [navigateFromNotificationPayload]
    );

    const handleMarkAllRead = useCallback(async (filter?: AdminNotificationFilter) => {
        if (markingAllRead) return;
        const categoryParam =
            filter && filter !== 'all' && filter !== 'unread' ? filter : undefined;

        setMarkingAllRead(true);
        try {
            const ok = await markAllNotificationsReadApi(fetchWithAuthRef.current, categoryParam);
            if (!isMountedRef.current) return;
            if (ok) {
                setNotifications((prev) =>
                    prev.map((n) => {
                        if (!categoryParam) return { ...n, read: true };
                        const cat = resolveNotificationCategory({
                            category: n.category,
                            type: n.type,
                            metadata: n.metadata,
                        });
                        return cat === categoryParam ? { ...n, read: true } : n;
                    })
                );
                if (!categoryParam) {
                    setServerUnreadCount(0);
                } else {
                    setServerUnreadCount(null);
                    loadNotificationsRef.current(true);
                }
            } else {
                notify('Error', 'Could not mark notifications as read.');
            }
        } catch {
            if (isMountedRef.current) {
                notify('Error', 'Could not mark notifications as read.');
            }
        } finally {
            if (isMountedRef.current) {
                setMarkingAllRead(false);
            }
        }
    }, [markingAllRead]);

    const handleClearAll = useCallback(() => {
        if (clearingNotifications || notificationsRef.current.length === 0) return;
        confirmAction(
            'Clear All Notifications',
            'Remove all notifications from your admin feed? This cannot be undone.',
            async () => {
                if (!isMountedRef.current) return;
                setClearingNotifications(true);
                try {
                    const ok = await clearAllNotificationsApi(fetchWithAuthRef.current);
                    if (!isMountedRef.current) return;
                    if (ok) {
                        setNotifications([]);
                        setServerUnreadCount(0);
                    } else {
                        notify('Error', 'Failed to clear notifications.');
                    }
                } catch {
                    if (isMountedRef.current) {
                        notify('Error', 'Failed to clear notifications.');
                    }
                } finally {
                    if (isMountedRef.current) {
                        setClearingNotifications(false);
                    }
                }
            },
            'Clear All',
            'Cancel'
        );
    }, [clearingNotifications]);

    const handleSendTestPush = useCallback(async () => {
        if (testingPush) return;
        setTestingPush(true);
        try {
            const result = await sendTestPushApi(fetchWithAuthRef.current);
            if (!isMountedRef.current) return;
            notify(result.ok ? 'Test Push Sent' : 'Push Notification Error', result.message);
        } catch {
            if (isMountedRef.current) {
                notify('Push Notification Error', 'Could not trigger test push notification.');
            }
        } finally {
            if (isMountedRef.current) {
                setTestingPush(false);
            }
        }
    }, [testingPush]);

    // Foreground push handler (shows interactive toast + refreshes bell immediately)
    const handleForegroundPush = useCallback((payload: FCMNotificationPayload) => {
        if (!isMountedRef.current) return;

        const incomingId = payload.notificationId || `push-${Date.now()}`;
        const synthetic = normalizeNotificationRecord({
            id: incomingId,
            title: payload.title || 'New Platform Alert',
            message: payload.body || '',
            type: payload.type || 'general',
            category: payload.category,
            targetView: payload.targetView || payload.adminView,
            relatedId: payload.relatedId || payload.bookingId || payload.rideId || payload.driverId || payload.userId,
            metadata: payload,
            read: false,
            createdAt: new Date().toISOString(),
        });

        if (synthetic && payload.notificationId) {
            setNotifications((prev) => mergeAndDeduplicateNotifications(prev, [synthetic]));
            setServerUnreadCount((prev) => (prev !== null ? prev + 1 : null));
        }

        // Fetch authoritative list & unread count from backend
        loadNotificationsRef.current(true);

        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setForegroundToast({
            id: incomingId,
            title: payload.title || 'GoRaahi Admin Alert',
            body: payload.body || 'Tap to review details.',
            type: payload.type,
            category: payload.category,
            payload,
        });
        toastTimerRef.current = setTimeout(() => {
            toastTimerRef.current = null;
            if (isMountedRef.current) {
                setForegroundToast(null);
            }
        }, TOAST_DURATION_MS);
    }, []);

    const handleBackgroundPushHint = useCallback((_payload: FCMNotificationPayload) => {
        if (!isMountedRef.current) return;
        loadNotificationsRef.current(true);
    }, []);

    const handleFCMNavigate = useCallback((_type: string, data: FCMNotificationPayload) => {
        if (!isMountedRef.current) return;
        const metadata: Record<string, string> = {};
        for (const [k, v] of Object.entries(data || {})) {
            if (typeof v === 'string' && v) metadata[k] = v;
        }
        navigateFromNotificationPayloadRef.current({
            ...data,
            metadata,
        });
    }, []);

    // Track browser visibility / window focus / native AppState
    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return;
            const handleVisibility = () => {
                const visible = document.visibilityState === 'visible';
                setIsAppActive(visible);
                if (visible) {
                    setPushPermission(getWebNotificationPermission());
                    loadNotificationsRef.current(true);
                }
            };
            const handleWindowFocus = () => {
                setIsAppActive(true);
                setPushPermission(getWebNotificationPermission());
                loadNotificationsRef.current(true);
            };
            document.addEventListener('visibilitychange', handleVisibility);
            if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                window.addEventListener('focus', handleWindowFocus);
            }
            return () => {
                document.removeEventListener('visibilitychange', handleVisibility);
                if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
                    window.removeEventListener('focus', handleWindowFocus);
                }
            };
        }

        const sub = AppState.addEventListener('change', (nextState) => {
            const active =
                typeof nextState !== 'string' ||
                (nextState !== 'background' && nextState !== 'inactive');
            setIsAppActive(active);
            if (active) {
                loadNotificationsRef.current(true);
            }
        });
        return () => sub?.remove?.();
    }, []);

    // Load notifications on mount + smart active polling
    useEffect(() => {
        if (!token || !isAppActive) return;
        loadNotificationsRef.current(false);
        const interval = setInterval(() => {
            if (!isAppCurrentlyActive()) {
                return;
            }
            loadNotificationsRef.current(true);
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [token, isAppActive]);

    // Register FCM for Admin on login / session restore
    useEffect(() => {
        if (!token || !user?.id) {
            fcmRegisteredUserRef.current = null;
            return;
        }
        if (fcmRegisteredUserRef.current === user.id) {
            return;
        }
        fcmRegisteredUserRef.current = user.id;
        let cancelled = false;
        let completed = false;

        if (Platform.OS === 'web') {
            setPushPermission(getWebNotificationPermission());
        }

        registerFCM(token, handleFCMNavigate, {
            promptIfDefault: false,
            onForegroundMessage: handleForegroundPush,
            onPushReceived: handleBackgroundPushHint,
        })
            .then((result) => {
                completed = true;
                if (!cancelled && isMountedRef.current && Platform.OS === 'web' && result?.permission) {
                    setPushPermission(result.permission);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    fcmRegisteredUserRef.current = null;
                }
            });

        return () => {
            cancelled = true;
            if (!completed) {
                fcmRegisteredUserRef.current = null;
            }
        };
    }, [token, user?.id, handleFCMNavigate, handleForegroundPush, handleBackgroundPushHint]);

    const handleRequestPushPermission = useCallback(async () => {
        if (!tokenRef.current) return;
        try {
            const result = await registerFCM(tokenRef.current, handleFCMNavigate, {
                promptIfDefault: true,
                onForegroundMessage: handleForegroundPush,
                onPushReceived: handleBackgroundPushHint,
            });
            if (!isMountedRef.current) return;
            setPushPermission(result.permission);
            if (result.permission === 'granted') {
                setPushBannerDismissed(true);
                notify('Push Notifications Enabled', 'Real-time admin alerts are now active.');
            } else if (result.permission === 'denied') {
                notify(
                    'Notifications Blocked',
                    'Please allow notifications for this site in your browser settings.'
                );
            }
        } catch {
            if (isMountedRef.current) {
                notify('Push Error', 'Could not enable browser push notifications.');
            }
        }
    }, [handleFCMNavigate, handleForegroundPush, handleBackgroundPushHint]);

    // Handle Cold-Start Web Deep Links (e.g. /?adminView=bookings&relatedId=...&notificationId=...)
    useEffect(() => {
        if (coldStartHandledRef.current) return;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && token) {
            const deepLink = parseAdminDeepLinkSearch(window.location.search || '');
            if (deepLink) {
                coldStartHandledRef.current = true;
                if (typeof window.history?.replaceState === 'function') {
                    const pageTitle = typeof document !== 'undefined' ? document.title : '';
                    window.history.replaceState({}, pageTitle, window.location.pathname || '/');
                }
                navigateFromNotificationPayload(deepLink);
            }
        }
    }, [token, navigateFromNotificationPayload]);

    const safeToken = token || '';

    const renderContent = () => {
        // Use key={activeView} on views that need full remount when switching between same component with different filters
        return (
            <ScrollView style={styles.pageBody} showsVerticalScrollIndicator={false}>
                {activeView === 'dashboard' && (
                    <AdminDashboardView
                        token={safeToken}
                        isDark={isDark}
                        onNavigateToRides={() => navigate('active_rides')}
                        onNavigateToBookings={() => navigate('bookings')}
                        onNavigateToParcels={() => navigate('parcels')}
                        onNavigateToVisitors={() => navigate('admin_users')}
                        onNavigateToRoutes={() => navigate('routes')}
                    />
                )}
                {activeView === 'driver_verification' && (
                    <AdminDriversView key="driver_verification" token={safeToken} searchQuery={searchQuery} initialFilter="pending" />
                )}
                {activeView === 'document_review' && (
                    <AdminDriversView key="document_review" token={safeToken} searchQuery={searchQuery} initialFilter="all" />
                )}
                {activeView === 'drivers' && (
                    <AdminDriversView key="drivers" token={safeToken} searchQuery={searchQuery} initialFilter="verified" />
                )}
                {activeView === 'vehicles' && (
                    <AdminVehiclesView token={safeToken} searchQuery={searchQuery} isDark={isDark} />
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
                    <AdminBookingsView token={safeToken} searchQuery={searchQuery} />
                )}
                {activeView === 'parcels' && (
                    <AdminParcelsDetailView isDark={isDark} searchQuery={searchQuery} />
                )}
                {activeView === 'finance' && (
                    <AdminFinanceView token={safeToken} searchQuery={searchQuery} isDark={isDark} />
                )}
                {activeView === 'NOTIFICATIONS' && (
                    <AdminNotificationsView
                        notifications={notifications}
                        unreadCount={unreadCount}
                        loading={loadingNotifications}
                        refreshing={refreshingNotifications}
                        error={notifError}
                        markingAllRead={markingAllRead}
                        clearing={clearingNotifications}
                        testingPush={testingPush}
                        searchQuery={searchQuery}
                        isDark={isDark}
                        pushPermission={pushPermission}
                        onRefresh={() => loadNotifications(true)}
                        onMarkRead={markNotificationRead}
                        onMarkAllRead={handleMarkAllRead}
                        onClearAll={handleClearAll}
                        onNavigateNotification={handleSelectNotification}
                        onRequestPushPermission={handleRequestPushPermission}
                        onSendTestPush={handleSendTestPush}
                    />
                )}
                {activeView === 'reports' && <AdminReportsView token={safeToken} />}
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

    const badgeDisplay = unreadCount > 99 ? '99+' : String(unreadCount);

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
                    {/* Profile & Logo Area */}
                    <TouchableOpacity
                        style={[styles.profileArea, Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}]}
                        onPress={() => navigate('dashboard')}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Go to Admin Dashboard Overview">
                        <View style={styles.avatarWrapper}>
                            <RaahiLogo size={32} />
                        </View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={[styles.profileName, { color: '#FFFFFF' }]}>
                                {user?.name || 'Admin User'}
                            </Text>
                            <Text style={[styles.profileRole, { color: T.sidebarText }]}>System Admin</Text>
                        </View>
                    </TouchableOpacity>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                        {NAV_SECTIONS.map(section => (
                            <View key={section.group} style={styles.sidebarSection}>
                                <Text style={[styles.sectionTitle, { color: T.sidebarText }]}>
                                    {section.group}
                                </Text>
                                {section.items.map(item => {
                                    const isActive = activeView === item.id;
                                    const showSidebarBadge = item.id === 'NOTIFICATIONS' && unreadCount > 0;
                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            testID={`admin-nav-${item.id}`}
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
                                            {showSidebarBadge ? (
                                                <View style={styles.sidebarBadge}>
                                                    <Text style={styles.sidebarBadgeText}>{badgeDisplay}</Text>
                                                </View>
                                            ) : (
                                                isActive && <View style={styles.activeDot} />
                                            )}
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
                            <TouchableOpacity
                                testID="admin-sidebar-signout-btn"
                                style={[
                                    styles.navItem,
                                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined,
                                ]}
                                onPress={handleLogoutPress}
                                accessibilityRole="button"
                                accessibilityLabel="Sign Out"
                            >
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
                <View style={[
                    styles.topBar,
                    isMobile && styles.topBarMobile,
                    { borderBottomColor: T.border, backgroundColor: isDark ? T.sidebar : '#FFFFFF' },
                ]}>
                    <View style={styles.topBarLeft}>
                        {isMobile && (
                            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={[styles.hamburger, styles.hamburgerMobile]}>
                                <Text style={{ fontSize: 22, color: T.text }}>☰</Text>
                            </TouchableOpacity>
                        )}
                        <View style={[
                            styles.searchBar,
                            isMobile && styles.searchBarMobile,
                            { backgroundColor: isDark ? '#111827' : '#F7F9FC' },
                        ]}>
                            <Text style={styles.searchIcon}>🔍</Text>
                            <TextInput
                                testID="admin-global-search-input"
                                style={[styles.searchInput, { color: T.text }]}
                                placeholder="Search everything..."
                                placeholderTextColor={T.subtext}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    testID="admin-search-clear-btn"
                                    onPress={() => setSearchQuery('')}
                                    style={styles.searchClearBtn}
                                    accessibilityLabel="Clear search filter"
                                >
                                    <Text style={{ color: T.subtext, fontSize: 12, fontWeight: '700' }}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {!isMobile && (
                            <Text style={[styles.breadcrumb, { color: T.subtext }]} numberOfLines={1}>
                                Admin / {ADMIN_PAGE_TITLES[activeView]}
                            </Text>
                        )}
                    </View>

                    <View style={[styles.topBarRight, isMobile && styles.topBarRightMobile]}>
                        <TouchableOpacity
                            testID="admin-bell-button"
                            onPress={() => {
                                const next = !bellPopoverOpen;
                                setBellPopoverOpen(next);
                                if (next) loadNotificationsRef.current(true);
                            }}
                            style={styles.notificationWrapper}
                            accessibilityRole="button"
                            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                        >
                            <Text style={styles.headerIcon}>🔔</Text>
                            {unreadCount > 0 && (
                                <View testID="admin-bell-badge" style={styles.badge}>
                                    <Text style={styles.badgeText}>{badgeDisplay}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAction('Profile Settings')} style={[styles.profileBtn, isMobile && { marginLeft: 0 }]}>
                            <View style={[styles.profileThumb, { backgroundColor: '#3B7DDD22', borderColor: '#3B7DDD' }]}>
                                <Text style={{ color: '#3B7DDD', fontWeight: 'bold', fontSize: 12 }}>AD</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Non-intrusive Web Push Permission Prompt Banner */}
                {!pushBannerDismissed && activeView !== 'NOTIFICATIONS' && (
                    <AdminPushPermissionBanner
                        permission={pushPermission}
                        isDark={isDark}
                        onEnable={handleRequestPushPermission}
                        onDismiss={() => setPushBannerDismissed(true)}
                    />
                )}

                {/* Page Body */}
                <View style={styles.pageBody}>
                    {renderContent()}
                </View>
            </View>

            {/* Bell Quick Dropdown / Popover */}
            <AdminNotificationBellPopover
                visible={bellPopoverOpen}
                notifications={notifications}
                unreadCount={unreadCount}
                loading={loadingNotifications}
                markingAllRead={markingAllRead}
                isDark={isDark}
                pushPermission={pushPermission}
                onClose={() => setBellPopoverOpen(false)}
                onSelectNotification={handleSelectNotification}
                onMarkAllRead={() => handleMarkAllRead()}
                onViewAll={() => navigate('NOTIFICATIONS')}
                onRefresh={() => loadNotifications(true)}
                onRequestPushPermission={handleRequestPushPermission}
            />

            {/* Foreground Push Toast */}
            <AdminForegroundToast
                toast={foregroundToast}
                isDark={isDark}
                onOpen={() => {
                    if (foregroundToast) {
                        navigateFromNotificationPayload(foregroundToast.payload);
                    }
                }}
                onDismiss={dismissToast}
            />

            <SignOutConfirmModal
                visible={signOutModalVisible}
                isDark={isDark}
                isSigningOut={isSigningOut}
                onCancel={cancelSignOut}
                onConfirm={confirmSignOut}
            />
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
        minWidth: 0,
    },
    hamburger: {
        marginRight: 16,
        padding: 4,
        flexShrink: 0,
    },
    hamburgerMobile: {
        marginRight: 10,
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
    sidebarBadge: {
        backgroundColor: '#DC3545',
        borderRadius: 10,
        minWidth: 20,
        height: 18,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sidebarBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 20, flexShrink: 0 },
    topBarRightMobile: { gap: 12 },
    headerIcon: { fontSize: 20, color: '#6C757D' },
    profileThumb: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E9ECEF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DEE2E6',
    },
    profileBtn: { marginLeft: 8, flexShrink: 0 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 0,
        minWidth: 0,
    },
    searchBarMobile: {
        flex: 1,
        minWidth: 0,
    },
    searchIcon: { fontSize: 14, color: '#6C757D', marginRight: 8, flexShrink: 0 },
    searchInput: { flex: 1, minWidth: 0, fontSize: 14, padding: 0, outlineStyle: 'none' } as any,
    searchClearBtn: {
        paddingLeft: 8,
        paddingVertical: 2,
    },
    breadcrumb: { marginLeft: 20, fontSize: 13, opacity: 0.7, flexShrink: 1 },
    navItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 9, paddingHorizontal: 24,
    },
    navIcon: { fontSize: 15, width: 22 },
    navLabel: { fontSize: 13, fontWeight: '500' },
    content: { flex: 1, flexDirection: 'column', minWidth: 0 },
    topBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, height: 64, gap: 16,
        borderBottomWidth: 1,
    },
    topBarMobile: {
        paddingHorizontal: 12,
        gap: 10,
    },
    pageBody: { flex: 1 },
    notificationWrapper: { position: 'relative', padding: 4 },
    badge: {
        position: 'absolute',
        top: -2, right: -4,
        backgroundColor: '#DC3545',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
