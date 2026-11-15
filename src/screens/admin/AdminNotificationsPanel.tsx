import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebPushPermissionState } from '../../services/fcmService';
import {
  ADMIN_PAGE_TITLES,
  AdminNotification,
  AdminNotificationFilter,
  formatAbsoluteTime,
  formatRelativeTime,
  getContextTagsFromNotification,
  getNotificationAppearance,
  resolveAdminTargetView,
  resolveNotificationCategory,
} from '../../utils/adminNotifications';

export interface AdminThemePalette {
  bg: string;
  sidebar: string;
  sidebarText: string;
  sidebarActive: string;
  sidebarActiveBg: string;
  text: string;
  subtext: string;
  border: string;
  accent: string;
  contentBg: string;
}

const CATEGORY_TABS: { id: AdminNotificationFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🔔' },
  { id: 'unread', label: 'Unread', icon: '🔵' },
  { id: 'drivers', label: 'Drivers', icon: '🪪' },
  { id: 'rides', label: 'Rides', icon: '🚙' },
  { id: 'bookings', label: 'Bookings', icon: '🎫' },
  { id: 'parcels', label: 'Parcels', icon: '📦' },
  { id: 'users', label: 'Users', icon: '👤' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'system', label: 'System', icon: '🛡️' },
];

// ─── Bell Dropdown / Popover ──────────────────────────────────────────────────

interface AdminNotificationBellPopoverProps {
  visible: boolean;
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  markingAllRead: boolean;
  isDark: boolean;
  pushPermission: WebPushPermissionState;
  onClose: () => void;
  onSelectNotification: (notif: AdminNotification) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
  onRefresh: () => void;
  onRequestPushPermission: () => void;
}

export const AdminNotificationBellPopover: React.FC<AdminNotificationBellPopoverProps> = ({
  visible,
  notifications,
  unreadCount,
  loading,
  markingAllRead,
  isDark,
  pushPermission,
  onClose,
  onSelectNotification,
  onMarkAllRead,
  onViewAll,
  onRefresh,
  onRequestPushPermission,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const palette = {
    card: isDark ? '#1F2937' : '#FFFFFF',
    surface: isDark ? '#111827' : '#F8FAFC',
    unreadBg: isDark ? 'rgba(59, 125, 221, 0.14)' : 'rgba(59, 125, 221, 0.06)',
    border: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
    text: isDark ? '#F9FAFB' : '#1E293B',
    subtext: isDark ? '#9CA3AF' : '#64748B',
    accent: '#3B7DDD',
  };

  // Prioritize unread items first, then latest items, capped at 8 in the quick dropdown
  const previewNotifications = useMemo(() => {
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);
    return [...unread, ...read].slice(0, 8);
  }, [notifications]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.popoverOverlay}>
        <TouchableOpacity
          testID="admin-bell-popover-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          testID="admin-bell-popover"
          style={[
            styles.popoverCard,
            isMobile ? styles.popoverCardMobile : styles.popoverCardDesktop,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.popoverHeader, { borderBottomColor: palette.border }]}>
            <View style={styles.popoverTitleRow}>
              <Text style={[styles.popoverTitle, { color: palette.text }]}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.popoverUnreadPill}>
                  <Text style={styles.popoverUnreadPillText}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            <View style={styles.popoverHeaderActions}>
              <TouchableOpacity
                testID="admin-popover-refresh"
                onPress={onRefresh}
                style={[styles.iconActionBtn, { borderColor: palette.border }]}
                accessibilityLabel="Refresh notifications"
              >
                <Text style={{ color: palette.subtext, fontSize: 13 }}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="admin-popover-mark-all-read"
                onPress={onMarkAllRead}
                disabled={unreadCount === 0 || markingAllRead}
                style={[
                  styles.smallTextBtn,
                  (unreadCount === 0 || markingAllRead) && { opacity: 0.45 },
                ]}
              >
                <Text style={[styles.smallTextBtnLabel, { color: palette.accent }]}>
                  {markingAllRead ? 'Marking...' : 'Mark all read'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Compact Web Push Status Row */}
          {Platform.OS === 'web' && (pushPermission === 'default' || pushPermission === 'denied') && (
            <View
              style={[
                styles.popoverPushBar,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
                  borderBottomColor: palette.border,
                },
              ]}
            >
              <Text
                style={{
                  color: isDark ? '#FCD34D' : '#92400E',
                  fontSize: 11,
                  flex: 1,
                  marginRight: 8,
                }}
              >
                {pushPermission === 'default'
                  ? 'Desktop push alerts are disabled.'
                  : 'Push alerts blocked in browser settings.'}
              </Text>
              {pushPermission === 'default' && (
                <TouchableOpacity
                  testID="admin-popover-enable-push"
                  onPress={onRequestPushPermission}
                  style={styles.enablePushMiniBtn}
                >
                  <Text style={styles.enablePushMiniBtnText}>Enable</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Notification Items */}
          <ScrollView style={styles.popoverList} showsVerticalScrollIndicator={false}>
            {loading && previewNotifications.length === 0 ? (
              <View style={styles.popoverEmpty}>
                <ActivityIndicator color={palette.accent} size="small" />
                <Text style={[styles.popoverEmptyText, { color: palette.subtext, marginTop: 8 }]}>
                  Loading alerts...
                </Text>
              </View>
            ) : previewNotifications.length === 0 ? (
              <View style={styles.popoverEmpty}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🔔</Text>
                <Text style={[styles.popoverEmptyTitle, { color: palette.text }]}>All caught up</Text>
                <Text style={[styles.popoverEmptyText, { color: palette.subtext }]}>
                  No recent platform notifications.
                </Text>
              </View>
            ) : (
              previewNotifications.map((item) => {
                const appearance = getNotificationAppearance(item.type, item.category);
                return (
                  <TouchableOpacity
                    key={item.id}
                    testID={`admin-popover-item-${item.id}`}
                    onPress={() => onSelectNotification(item)}
                    activeOpacity={0.75}
                    style={[
                      styles.popoverItem,
                      {
                        borderBottomColor: palette.border,
                        backgroundColor: item.read ? 'transparent' : palette.unreadBg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.popoverItemIcon,
                        { backgroundColor: `${appearance.color}22` },
                      ]}
                    >
                      <Text style={{ fontSize: 15 }}>{appearance.icon}</Text>
                    </View>
                    <View style={styles.popoverItemBody}>
                      <View style={styles.popoverItemTopRow}>
                        <Text
                          style={[
                            styles.popoverItemTitle,
                            { color: palette.text, fontWeight: item.read ? '600' : '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={[styles.popoverItemTime, { color: palette.subtext }]}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.popoverItemMessage, { color: palette.subtext }]}
                        numberOfLines={2}
                      >
                        {item.message}
                      </Text>
                    </View>
                    {!item.read && (
                      <View
                        style={[styles.unreadDot, { backgroundColor: palette.accent }]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <TouchableOpacity
            testID="admin-popover-view-all"
            onPress={onViewAll}
            style={[styles.popoverFooter, { borderTopColor: palette.border, backgroundColor: palette.surface }]}
          >
            <Text style={[styles.popoverFooterText, { color: palette.accent }]}>
              View all notifications →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Full Admin Notifications Center View ─────────────────────────────────────

interface AdminNotificationsViewProps {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  markingAllRead: boolean;
  clearing: boolean;
  testingPush: boolean;
  searchQuery?: string;
  isDark: boolean;
  pushPermission: WebPushPermissionState;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: (category?: AdminNotificationFilter) => void;
  onClearAll: () => void;
  onNavigateNotification: (notif: AdminNotification) => void;
  onRequestPushPermission: () => void;
  onSendTestPush: () => void;
}

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  notifications,
  unreadCount,
  loading,
  refreshing,
  error,
  markingAllRead,
  clearing,
  testingPush,
  searchQuery = '',
  isDark,
  pushPermission,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateNotification,
  onRequestPushPermission,
  onSendTestPush,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [selectedFilter, setSelectedFilter] = useState<AdminNotificationFilter>('all');

  const T = {
    bg: isDark ? '#111827' : '#F7F9FC',
    card: isDark ? '#1F2937' : '#FFFFFF',
    cardUnread: isDark ? '#1E293B' : '#F0F7FF',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    text: isDark ? '#F9FAFB' : '#1E293B',
    sub: isDark ? '#9CA3AF' : '#64748B',
    accent: '#3B7DDD',
    chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6',
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<AdminNotificationFilter, number> = {
      all: notifications.length,
      unread: 0,
      drivers: 0,
      rides: 0,
      bookings: 0,
      parcels: 0,
      users: 0,
      reviews: 0,
      system: 0,
    };
    for (const n of notifications) {
      if (!n.read) counts.unread += 1;
      const cat = resolveNotificationCategory({
        category: n.category,
        type: n.type,
        metadata: n.metadata,
      });
      counts[cat] += 1;
    }
    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (selectedFilter === 'unread' && n.read) return false;
      if (selectedFilter !== 'all' && selectedFilter !== 'unread') {
        const cat = resolveNotificationCategory({
          category: n.category,
          type: n.type,
          metadata: n.metadata,
        });
        if (cat !== selectedFilter) return false;
      }
      if (!q) return true;
      const metaText = n.metadata ? Object.values(n.metadata).join(' ').toLowerCase() : '';
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        metaText.includes(q)
      );
    });
  }, [notifications, selectedFilter, searchQuery]);

  const scopedUnreadCount = useMemo(() => {
    if (selectedFilter === 'all' || selectedFilter === 'unread') {
      return unreadCount;
    }
    return notifications.filter((n) => {
      if (n.read) return false;
      const cat = resolveNotificationCategory({
        category: n.category,
        type: n.type,
        metadata: n.metadata,
      });
      return cat === selectedFilter;
    }).length;
  }, [notifications, selectedFilter, unreadCount]);

  return (
    <View style={[styles.pageContainer, isMobile && { padding: 16 }]}>
      {/* Page Header */}
      <View style={[styles.pageHeader, isMobile && styles.pageHeaderMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.pageTitle, { color: T.text }]}>System Notifications</Text>
          <Text style={[styles.pageSubtitle, { color: T.sub }]}>
            {unreadCount} unread · {notifications.length} total alerts (last 30 days)
          </Text>
        </View>
        <View style={styles.pageActions}>
          <TouchableOpacity
            testID="admin-notifs-refresh-btn"
            onPress={onRefresh}
            disabled={refreshing}
            style={[styles.ghostBtn, { backgroundColor: T.card, borderColor: T.border }, refreshing && { opacity: 0.6 }]}
          >
            <Text style={[styles.ghostBtnText, { color: T.text }]}>
              {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="admin-notifs-mark-all-btn"
            onPress={() => onMarkAllRead(selectedFilter)}
            disabled={scopedUnreadCount === 0 || markingAllRead}
            style={[
              styles.primaryBtn,
              (scopedUnreadCount === 0 || markingAllRead) && { opacity: 0.45 },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {markingAllRead ? 'Marking...' : '✓ Mark all read'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="admin-notifs-test-push-btn"
            onPress={onSendTestPush}
            disabled={testingPush}
            style={[styles.ghostBtn, { backgroundColor: T.card, borderColor: T.border }, testingPush && { opacity: 0.6 }]}
          >
            <Text style={[styles.ghostBtnText, { color: T.text }]}>
              {testingPush ? 'Sending...' : '🔔 Test Push'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="admin-notifs-clear-all-btn"
            onPress={onClearAll}
            disabled={notifications.length === 0 || clearing}
            style={[
              styles.dangerGhostBtn,
              (notifications.length === 0 || clearing) && { opacity: 0.45 },
            ]}
          >
            <Text style={styles.dangerGhostBtnText}>
              {clearing ? 'Clearing...' : '🗑 Clear all'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Web Push Status Card */}
      {Platform.OS === 'web' && (
        <View
          style={[
            styles.pushStatusCard,
            {
              backgroundColor:
                pushPermission === 'granted'
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.1)'
                    : '#ECFDF5'
                  : pushPermission === 'denied'
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.12)'
                      : '#FEF2F2'
                    : isDark
                      ? 'rgba(245, 158, 11, 0.12)'
                      : '#FFFBEB',
              borderColor:
                pushPermission === 'granted'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : pushPermission === 'denied'
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(245, 158, 11, 0.35)',
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color:
                  pushPermission === 'granted'
                    ? '#10B981'
                    : pushPermission === 'denied'
                      ? '#EF4444'
                      : isDark
                        ? '#FCD34D'
                        : '#92400E',
              }}
            >
              {pushPermission === 'granted'
                ? '● Browser Push Notifications Active'
                : pushPermission === 'denied'
                  ? '🔕 Browser Push Notifications Blocked'
                  : pushPermission === 'default'
                    ? '🔔 Enable Desktop Push Notifications'
                    : 'ℹ️ Browser Push Unsupported (Live Polling Active)'}
            </Text>
            <Text style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
              {pushPermission === 'granted'
                ? 'You will receive real-time alerts for new KYC submissions, rides, bookings, parcels, and reviews.'
                : pushPermission === 'denied'
                  ? 'Allow notifications in your browser site settings and reload to receive background alerts.'
                  : pushPermission === 'default'
                    ? 'Turn on browser notifications to get instant alerts even when this tab is in the background.'
                    : 'This browser does not support Web Push APIs. In-app auto-refresh remains active.'}
            </Text>
          </View>
          {pushPermission === 'default' && (
            <TouchableOpacity
              testID="admin-notifs-enable-push-btn"
              onPress={onRequestPushPermission}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Enable Push</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={{ color: T.accent, fontWeight: '700', fontSize: 13 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category & Unread Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {CATEGORY_TABS.map((tab) => {
          const active = selectedFilter === tab.id;
          const count = categoryCounts[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              testID={`admin-notifs-filter-${tab.id}`}
              onPress={() => setSelectedFilter(tab.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? T.accent : T.chipBg,
                  borderColor: active ? T.accent : T.border,
                },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{tab.icon}</Text>
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? '#FFFFFF' : T.text },
                ]}
              >
                {tab.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Notification Cards */}
      {loading && notifications.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={{ color: T.sub, marginTop: 12, fontSize: 14 }}>Loading notifications...</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
            {selectedFilter === 'unread' ? 'No unread notifications' : 'No notifications found'}
          </Text>
          <Text style={{ color: T.sub, fontSize: 13, textAlign: 'center' }}>
            {searchQuery
              ? `No alerts match "${searchQuery}".`
              : 'Platform activity alerts will appear here in real time.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filteredNotifications.map((n) => {
            const appearance = getNotificationAppearance(n.type, n.category);
            const targetView = resolveAdminTargetView({
              targetView: n.targetView,
              type: n.type,
              metadata: n.metadata,
            });
            const targetTitle = ADMIN_PAGE_TITLES[targetView] || 'Dashboard';
            const contextTags = getContextTagsFromNotification(n);

            return (
              <TouchableOpacity
                key={n.id}
                testID={`admin-notif-card-${n.id}`}
                onPress={() => onNavigateNotification(n)}
                activeOpacity={0.82}
                style={[
                  styles.notifCard,
                  {
                    backgroundColor: n.read ? T.card : T.cardUnread,
                    borderColor: n.read ? T.border : `${appearance.color}55`,
                    borderLeftColor: appearance.color,
                    opacity: n.read ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.notifIconBox, { backgroundColor: `${appearance.color}20` }]}>
                  <Text style={{ fontSize: 20 }}>{appearance.icon}</Text>
                </View>

                <View style={styles.notifContent}>
                  <View style={styles.notifMetaRow}>
                    <View style={[styles.categoryPill, { backgroundColor: `${appearance.color}20` }]}>
                      <Text style={[styles.categoryPillText, { color: appearance.color }]}>
                        {appearance.label}
                      </Text>
                    </View>
                    <Text style={[styles.timeText, { color: T.sub }]}>
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                    {!isMobile && (
                      <Text style={[styles.timeText, { color: T.sub, opacity: 0.7 }]}>
                        · {formatAbsoluteTime(n.createdAt)}
                      </Text>
                    )}
                    {!n.read && <View style={[styles.unreadDot, { backgroundColor: T.accent }]} />}
                  </View>

                  <Text style={[styles.notifTitle, { color: T.text }]}>{n.title}</Text>
                  <Text style={[styles.notifMessage, { color: T.sub }]}>{n.message}</Text>

                  {contextTags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {contextTags.map((tag, idx) => (
                        <View
                          key={`${n.id}-tag-${idx}`}
                          style={[styles.contextTag, { backgroundColor: T.chipBg, borderColor: T.border }]}
                        >
                          <Text style={[styles.contextTagText, { color: T.text }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.notifFooterRow}>
                    <Text style={[styles.openTargetLabel, { color: T.accent }]}>
                      Open {targetTitle} →
                    </Text>
                    {!n.read && (
                      <TouchableOpacity
                        testID={`admin-notif-mark-read-${n.id}`}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          onMarkRead(n.id);
                        }}
                        style={[styles.markSingleReadBtn, { borderColor: T.border }]}
                      >
                        <Text style={[styles.markSingleReadText, { color: T.sub }]}>
                          Mark read
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ─── Push Permission Banner (Top of Admin Dashboard Content) ───────────────────

interface AdminPushPermissionBannerProps {
  permission: WebPushPermissionState;
  isDark: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export const AdminPushPermissionBanner: React.FC<AdminPushPermissionBannerProps> = ({
  permission,
  isDark,
  onEnable,
  onDismiss,
}) => {
  if (Platform.OS !== 'web' || (permission !== 'default' && permission !== 'denied')) {
    return null;
  }

  const isDefault = permission === 'default';
  return (
    <View
      testID="admin-push-permission-banner"
      style={[
        styles.topBanner,
        {
          backgroundColor: isDefault
            ? isDark
              ? 'rgba(59, 125, 221, 0.14)'
              : '#EFF6FF'
            : isDark
              ? 'rgba(239, 68, 68, 0.12)'
              : '#FEF2F2',
          borderColor: isDefault ? 'rgba(59, 125, 221, 0.35)' : 'rgba(239, 68, 68, 0.35)',
        },
      ]}
    >
      <Text style={{ fontSize: 16, marginRight: 10 }}>{isDefault ? '🔔' : '🔕'}</Text>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          color: isDark ? '#F3F4F6' : '#1E293B',
          marginRight: 12,
        }}
      >
        {isDefault
          ? 'Enable browser push notifications for instant alerts on KYC submissions, rides, bookings & parcels.'
          : 'Browser notifications are currently blocked. Enable notifications in browser site settings for real-time alerts.'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isDefault && (
          <TouchableOpacity
            testID="admin-banner-enable-push"
            onPress={onEnable}
            style={styles.bannerEnableBtn}
          >
            <Text style={styles.bannerEnableBtnText}>Enable Push</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="admin-banner-dismiss-push"
          onPress={onDismiss}
          style={styles.bannerDismissBtn}
        >
          <Text style={{ color: isDark ? '#9CA3AF' : '#64748B', fontSize: 13, fontWeight: '600' }}>
            ✕
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Foreground Push Toast Banner ─────────────────────────────────────────────

interface AdminForegroundToastProps {
  toast: {
    id: string;
    title: string;
    body: string;
    type?: string;
    category?: string;
  } | null;
  isDark: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

export const AdminForegroundToast: React.FC<AdminForegroundToastProps> = ({
  toast,
  isDark,
  onOpen,
  onDismiss,
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!toast) return null;

  const appearance = getNotificationAppearance(toast.type, toast.category);

  return (
    <View
      testID="admin-foreground-toast"
      style={[
        styles.toastContainer,
        isMobile ? styles.toastContainerMobile : styles.toastContainerDesktop,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: appearance.color,
        },
      ]}
    >
      <TouchableOpacity
        testID="admin-foreground-toast-open"
        style={styles.toastClickArea}
        onPress={onOpen}
        activeOpacity={0.85}
      >
        <View style={[styles.toastIconBox, { backgroundColor: `${appearance.color}22` }]}>
          <Text style={{ fontSize: 18 }}>{appearance.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: isDark ? '#F9FAFB' : '#111827',
            }}
            numberOfLines={1}
          >
            {toast.title}
          </Text>
          {Boolean(toast.body) && (
            <Text
              style={{
                fontSize: 12,
                color: isDark ? '#CBD5E1' : '#475569',
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {toast.body}
            </Text>
          )}
          <Text style={{ fontSize: 11, color: appearance.color, fontWeight: '700', marginTop: 4 }}>
            Tap to view →
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        testID="admin-foreground-toast-close"
        onPress={onDismiss}
        style={styles.toastCloseBtn}
        accessibilityLabel="Dismiss notification"
      >
        <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 14, fontWeight: '700' }}>
          ✕
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Popover
  popoverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  popoverCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  popoverCardDesktop: {
    position: 'absolute',
    top: 62,
    right: 24,
    width: 400,
    maxHeight: 520,
  },
  popoverCardMobile: {
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: 64,
    maxHeight: '78%',
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  popoverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  popoverTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  popoverUnreadPill: {
    backgroundColor: '#3B7DDD',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popoverUnreadPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  popoverHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  smallTextBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  popoverPushBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  enablePushMiniBtn: {
    backgroundColor: '#3B7DDD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enablePushMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  popoverList: {
    maxHeight: 380,
  },
  popoverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  popoverEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  popoverEmptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  popoverItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  popoverItemBody: {
    flex: 1,
    minWidth: 0,
  },
  popoverItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  popoverItemTitle: {
    fontSize: 13,
    flex: 1,
    minWidth: 0,
  },
  popoverItemTime: {
    fontSize: 11,
    flexShrink: 0,
  },
  popoverItemMessage: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  popoverFooter: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  popoverFooterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },

  // Full Notifications View
  pageContainer: {
    padding: 24,
    paddingBottom: 60,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  pageHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  pageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  ghostBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#3B7DDD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dangerGhostBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dangerGhostBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  pushStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  filterBar: {
    flexGrow: 0,
    marginBottom: 16,
  },
  filterBarContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    gap: 14,
  },
  notifIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    minWidth: 0,
  },
  notifMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 11,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  contextTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  contextTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notifFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  openTargetLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  markSingleReadBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  markSingleReadText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Top Permission Banner
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bannerEnableBtn: {
    backgroundColor: '#3B7DDD',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerEnableBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerDismissBtn: {
    padding: 4,
  },

  // Foreground Toast
  toastContainer: {
    position: 'absolute',
    zIndex: 999,
    elevation: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  toastContainerDesktop: {
    top: 74,
    right: 24,
    width: 360,
  },
  toastContainerMobile: {
    top: 70,
    left: 12,
    right: 12,
  },
  toastClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  toastCloseBtn: {
    padding: 10,
  },
});
