import { API_BASE } from '../apiConfig';
import { parseJsonSafe, getApiErrorMessage } from './json';

export type AdminView =
  | 'dashboard'
  | 'driver_verification'
  | 'document_review'
  | 'drivers'
  | 'vehicles'
  | 'active_rides'
  | 'completed_rides'
  | 'cancelled_rides'
  | 'routes'
  | 'bookings'
  | 'parcels'
  | 'finance'
  | 'NOTIFICATIONS'
  | 'reports'
  | 'audit_logs'
  | 'admin_users'
  | 'permissions'
  | 'settings';

export type AdminNotificationCategory =
  | 'users'
  | 'drivers'
  | 'rides'
  | 'bookings'
  | 'parcels'
  | 'reviews'
  | 'system';

export type AdminNotificationFilter = 'all' | 'unread' | AdminNotificationCategory;

export interface AdminNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: string;
  category?: AdminNotificationCategory | string;
  targetView?: string;
  relatedId?: string;
  metadata?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface AdminDeepLinkPayload {
  type?: string;
  category?: string;
  targetView?: string;
  adminView?: string;
  relatedId?: string;
  notificationId?: string;
  url?: string;
  title?: string;
  body?: string;
  metadata?: Record<string, string>;
  bid?: string;
  bookingId?: string;
  rideId?: string;
  driverId?: string;
  userId?: string;
  actorName?: string;
  actorPhone?: string;
  vehicleNumber?: string;
  vehicleName?: string;
  pickup?: string;
  dropoff?: string;
  status?: string;
  rating?: string;
  recipientName?: string;
}

export interface NotificationAppearance {
  icon: string;
  color: string;
  label: string;
}

export type FetchWithAuthFn = (url: string, options?: RequestInit) => Promise<Response>;

export const ADMIN_PAGE_TITLES: Record<AdminView, string> = {
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
  parcels: 'Parcels Overview',
  finance: 'Commission & Settlement',
  NOTIFICATIONS: 'System Notifications',
  reports: 'Reports & Analytics',
  audit_logs: 'Audit Logs',
  admin_users: 'Admin Users',
  permissions: 'Permissions',
  settings: 'Settings',
};

const VALID_ADMIN_VIEW_MAP: Record<string, AdminView> = {
  dashboard: 'dashboard',
  driver_verification: 'driver_verification',
  document_review: 'document_review',
  drivers: 'drivers',
  vehicles: 'vehicles',
  active_rides: 'active_rides',
  completed_rides: 'completed_rides',
  cancelled_rides: 'cancelled_rides',
  routes: 'routes',
  bookings: 'bookings',
  parcels: 'parcels',
  finance: 'finance',
  notifications: 'NOTIFICATIONS',
  reports: 'reports',
  audit_logs: 'audit_logs',
  admin_users: 'admin_users',
  visitors: 'admin_users',
  users: 'admin_users',
  permissions: 'permissions',
  settings: 'settings',
};

const TYPE_TO_ADMIN_VIEW: Record<string, AdminView> = {
  // Users
  user_registered: 'admin_users',
  admin_promoted: 'admin_users',
  incomplete_users_cleaned: 'admin_users',
  // Drivers & Vehicles
  driver_kyc_submitted: 'driver_verification',
  driver_kyc_resubmitted: 'driver_verification',
  admin_alert: 'driver_verification',
  document_verification: 'document_review',
  vehicle_updated: 'vehicles',
  driver_verified: 'drivers',
  driver_rejected: 'drivers',
  driver_rekyc_requested: 'drivers',
  driver_deleted: 'drivers',
  // Rides
  ride_created: 'active_rides',
  ride_started: 'active_rides',
  ride_completed: 'completed_rides',
  ride_cancelled: 'cancelled_rides',
  // Bookings
  booking_created: 'bookings',
  booking_confirmed: 'bookings',
  booking_rejected: 'bookings',
  booking_cancelled: 'bookings',
  booking_completed: 'bookings',
  booking_request: 'bookings',
  booking_status: 'bookings',
  // Parcels
  parcel_created: 'parcels',
  parcel_confirmed: 'parcels',
  parcel_rejected: 'parcels',
  parcel_cancelled: 'parcels',
  parcel_completed: 'parcels',
  // Reviews
  review_submitted: 'drivers',
};

const VALID_CATEGORIES = new Set<AdminNotificationCategory>([
  'users',
  'drivers',
  'rides',
  'bookings',
  'parcels',
  'reviews',
  'system',
]);

const DESTRUCTIVE_TYPES_WITHOUT_ROW = new Set([
  'driver_deleted',
  'incomplete_users_cleaned',
]);

export function parseQueryString(rawQuery: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawQuery) return result;
  const cleaned = rawQuery.includes('?') ? rawQuery.slice(rawQuery.indexOf('?') + 1) : rawQuery;
  if (!cleaned) return result;

  for (const part of cleaned.split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    const rawKey = eqIdx >= 0 ? part.slice(0, eqIdx) : part;
    const rawVal = eqIdx >= 0 ? part.slice(eqIdx + 1) : '';
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      const val = decodeURIComponent(rawVal.replace(/\+/g, ' '));
      if (key) result[key] = val;
    } catch {
      if (rawKey) result[rawKey] = rawVal;
    }
  }
  return result;
}

export function normalizeAdminViewName(view?: string | null): AdminView | null {
  if (!view || typeof view !== 'string') return null;
  const key = view.trim().toLowerCase();
  return VALID_ADMIN_VIEW_MAP[key] ?? null;
}

export function resolveAdminTargetView(input?: {
  targetView?: string;
  adminView?: string;
  type?: string;
  url?: string;
  metadata?: Record<string, string>;
}): AdminView {
  if (!input) return 'NOTIFICATIONS';

  const candidates = [
    input.targetView,
    input.adminView,
    input.metadata?.targetView,
    input.metadata?.adminView,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAdminViewName(candidate);
    if (normalized) return normalized;
  }

  const urlToInspect = input.url || input.metadata?.url;
  if (urlToInspect) {
    const query = parseQueryString(urlToInspect);
    const fromUrl = normalizeAdminViewName(query.adminView || query.targetView);
    if (fromUrl) return fromUrl;
  }

  const typeKey = (input.type || '').trim().toLowerCase();
  if (typeKey && TYPE_TO_ADMIN_VIEW[typeKey]) {
    return TYPE_TO_ADMIN_VIEW[typeKey];
  }

  return 'NOTIFICATIONS';
}

export function resolveNotificationCategory(input: {
  category?: string;
  type?: string;
  metadata?: Record<string, string>;
}): AdminNotificationCategory {
  const explicit = (input.category || input.metadata?.category || '').trim().toLowerCase();
  if (VALID_CATEGORIES.has(explicit as AdminNotificationCategory)) {
    return explicit as AdminNotificationCategory;
  }

  const t = (input.type || '').trim().toLowerCase();
  if (t.startsWith('driver_') || t.startsWith('vehicle_') || t === 'document_verification' || t === 'admin_alert') {
    return 'drivers';
  }
  if (t.startsWith('ride_')) return 'rides';
  if (t.startsWith('parcel_')) return 'parcels';
  if (t.startsWith('booking_')) return 'bookings';
  if (t.startsWith('review_')) return 'reviews';
  if (t === 'user_registered') return 'users';
  return 'system';
}

export function getNotificationAppearance(
  type?: string,
  category?: string
): NotificationAppearance {
  const t = (type || '').trim().toLowerCase();
  const cat = resolveNotificationCategory({ category, type: t });

  switch (t) {
    case 'driver_kyc_submitted':
    case 'driver_kyc_resubmitted':
    case 'admin_alert':
      return { icon: '🪪', color: '#F59E0B', label: 'KYC REVIEW' };
    case 'driver_verified':
      return { icon: '✅', color: '#10B981', label: 'VERIFIED' };
    case 'driver_rejected':
    case 'driver_deleted':
      return { icon: '🚫', color: '#EF4444', label: 'DRIVER' };
    case 'driver_rekyc_requested':
      return { icon: '🔄', color: '#F59E0B', label: 'RE-KYC' };
    case 'vehicle_updated':
      return { icon: '🚐', color: '#3B7DDD', label: 'VEHICLE' };
    case 'ride_created':
    case 'ride_started':
      return { icon: '🚙', color: '#10B981', label: 'RIDE' };
    case 'ride_completed':
      return { icon: '🏁', color: '#3B7DDD', label: 'RIDE' };
    case 'ride_cancelled':
      return { icon: '❌', color: '#EF4444', label: 'CANCELLED' };
    case 'booking_created':
      return { icon: '🎫', color: '#3B7DDD', label: 'BOOKING' };
    case 'booking_confirmed':
    case 'booking_completed':
      return { icon: '✅', color: '#10B981', label: 'BOOKING' };
    case 'booking_rejected':
    case 'booking_cancelled':
      return { icon: '⚠️', color: '#EF4444', label: 'BOOKING' };
    case 'parcel_created':
      return { icon: '📦', color: '#8B5CF6', label: 'PARCEL' };
    case 'parcel_confirmed':
    case 'parcel_completed':
      return { icon: '📬', color: '#10B981', label: 'PARCEL' };
    case 'parcel_rejected':
    case 'parcel_cancelled':
      return { icon: '📦', color: '#EF4444', label: 'PARCEL' };
    case 'review_submitted':
      return { icon: '⭐', color: '#F59E0B', label: 'REVIEW' };
    case 'user_registered':
      return { icon: '👤', color: '#06B6D4', label: 'NEW USER' };
    case 'admin_promoted':
    case 'incomplete_users_cleaned':
      return { icon: '🛡️', color: '#6366F1', label: 'SYSTEM' };
    default:
      break;
  }

  switch (cat) {
    case 'drivers':
      return { icon: '🪪', color: '#F59E0B', label: 'DRIVER' };
    case 'rides':
      return { icon: '🚙', color: '#10B981', label: 'RIDE' };
    case 'bookings':
      return { icon: '🎫', color: '#3B7DDD', label: 'BOOKING' };
    case 'parcels':
      return { icon: '📦', color: '#8B5CF6', label: 'PARCEL' };
    case 'reviews':
      return { icon: '⭐', color: '#F59E0B', label: 'REVIEW' };
    case 'users':
      return { icon: '👤', color: '#06B6D4', label: 'USER' };
    default:
      return { icon: '🔔', color: '#3B7DDD', label: 'SYSTEM' };
  }
}

export function formatRelativeTime(dateInput?: string | number | Date | null, nowMs = Date.now()): string {
  if (!dateInput) return 'Just now';
  const thenMs = dateInput instanceof Date ? dateInput.getTime() : new Date(dateInput).getTime();
  if (Number.isNaN(thenMs)) return typeof dateInput === 'string' ? dateInput : 'Just now';

  const diffSec = Math.max(0, Math.floor((nowMs - thenMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  try {
    return new Date(thenMs).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return `${diffDays}d ago`;
  }
}

export function formatAbsoluteTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
  try {
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

export function extractNotificationContext(input: {
  type?: string;
  relatedId?: string;
  targetView?: AdminView;
  metadata?: Record<string, string>;
}): { searchQuery: string; bid?: string } {
  const typeKey = (input.type || '').trim().toLowerCase();
  const meta = input.metadata || {};
  const bid = meta.bid || meta.bookingId || undefined;

  if (DESTRUCTIVE_TYPES_WITHOUT_ROW.has(typeKey)) {
    return { searchQuery: '' };
  }

  const target = input.targetView || resolveAdminTargetView({ type: typeKey, metadata: meta });

  if (target === 'NOTIFICATIONS' || target === 'dashboard' || target === 'settings' || target === 'reports' || target === 'audit_logs') {
    return { searchQuery: '', bid };
  }

  if (target === 'bookings') {
    const bookingPerson =
      meta.passengerName ||
      (meta.actorName && meta.actorName !== meta.driverName ? meta.actorName : '') ||
      meta.actorPhone;
    return {
      searchQuery: meta.bid || meta.bookingId || bookingPerson || input.relatedId || '',
      bid,
    };
  }

  if (target === 'parcels') {
    const senderName =
      meta.passengerName ||
      (meta.actorName && meta.actorName !== meta.driverName ? meta.actorName : '');
    const parcelRowId = input.relatedId
      ? input.relatedId.startsWith('RA-P-')
        ? input.relatedId
        : /^[a-f0-9]{24}$/i.test(input.relatedId)
          ? `RA-P-${input.relatedId.slice(-4)}`
          : input.relatedId
      : '';
    return {
      searchQuery:
        senderName ||
        meta.recipientName ||
        meta.pickup ||
        meta.dropoff ||
        parcelRowId ||
        meta.bid ||
        meta.bookingId ||
        '',
      bid,
    };
  }

  if (target === 'vehicles') {
    return {
      searchQuery: meta.vehicleNumber || meta.actorName || meta.actorPhone || meta.driverId || input.relatedId || '',
    };
  }

  if (target === 'driver_verification' || target === 'document_review' || target === 'drivers') {
    return {
      searchQuery: meta.actorPhone || meta.actorName || meta.vehicleNumber || meta.driverId || input.relatedId || '',
    };
  }

  if (target === 'active_rides' || target === 'completed_rides' || target === 'cancelled_rides') {
    return {
      searchQuery: meta.rideId || input.relatedId || meta.actorName || '',
    };
  }

  if (target === 'admin_users') {
    return {
      searchQuery: meta.actorPhone || meta.actorName || meta.userId || input.relatedId || '',
    };
  }

  return { searchQuery: input.relatedId || '', bid };
}

export function parseAdminDeepLinkSearch(search: string): AdminDeepLinkPayload | null {
  const params = parseQueryString(search);
  const adminView = params.adminView || params.targetView;
  const type = params.type;
  const relatedId = params.relatedId || params.bookingId || params.rideId || params.driverId || params.userId;
  const notificationId = params.notificationId;

  if (!adminView && !notificationId && !(type && TYPE_TO_ADMIN_VIEW[type.toLowerCase()])) {
    return null;
  }

  const metadata: Record<string, string> = {};
  const metaKeys = [
    'bid',
    'bookingId',
    'rideId',
    'driverId',
    'userId',
    'actorName',
    'actorPhone',
    'passengerName',
    'driverName',
    'parcelSize',
    'vehicleNumber',
    'vehicleName',
    'pickup',
    'dropoff',
    'status',
    'rating',
    'recipientName',
    'category',
  ];
  for (const key of metaKeys) {
    if (params[key]) metadata[key] = params[key];
  }

  return {
    adminView,
    targetView: adminView,
    type,
    relatedId,
    notificationId,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    bid: params.bid,
    bookingId: params.bookingId,
    rideId: params.rideId,
    driverId: params.driverId,
    userId: params.userId,
    actorName: params.actorName,
    actorPhone: params.actorPhone,
    vehicleNumber: params.vehicleNumber,
  };
}

export function normalizeNotificationRecord(raw: any): AdminNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw._id || '').trim();
  if (!id) return null;

  const metadata: Record<string, string> | undefined =
    raw.metadata && typeof raw.metadata === 'object'
      ? Object.entries(raw.metadata).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v !== undefined && v !== null) acc[k] = String(v);
          return acc;
        }, {})
      : undefined;

  return {
    id,
    userId: raw.userId ? String(raw.userId) : undefined,
    title: String(raw.title || 'Admin Notification'),
    message: String(raw.message || raw.body || ''),
    type: String(raw.type || 'general'),
    category: raw.category ? String(raw.category) : resolveNotificationCategory({ type: raw.type, metadata }),
    targetView: raw.targetView ? String(raw.targetView) : metadata?.targetView,
    relatedId: raw.relatedId ? String(raw.relatedId) : undefined,
    metadata,
    read: Boolean(raw.read),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export function normalizeNotificationsList(raw: any): AdminNotification[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.notifications)
      ? raw.notifications
      : [];

  return list
    .map(normalizeNotificationRecord)
    .filter((item: AdminNotification | null): item is AdminNotification => item !== null)
    .sort((a: AdminNotification, b: AdminNotification) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
}

export function mergeAndDeduplicateNotifications(
  existing: AdminNotification[],
  incoming: AdminNotification[]
): AdminNotification[] {
  const byId = new Map<string, AdminNotification>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export function getContextTagsFromNotification(notif: AdminNotification): string[] {
  const meta = notif.metadata || {};
  const tags: string[] = [];

  if (meta.bid) tags.push(`BID: ${meta.bid}`);
  const actorIsDriverOnly =
    Boolean(meta.actorName) &&
    Boolean(meta.driverName) &&
    meta.actorName === meta.driverName &&
    Boolean(meta.passengerName) &&
    meta.passengerName !== meta.actorName;

  if (meta.passengerName) {
    tags.push(meta.actorPhone ? `${meta.passengerName} (${meta.actorPhone})` : meta.passengerName);
  } else if (meta.actorName) {
    tags.push(
      meta.actorPhone && !actorIsDriverOnly
        ? `${meta.actorName} (${meta.actorPhone})`
        : meta.actorName
    );
  } else if (meta.actorPhone) {
    tags.push(meta.actorPhone);
  }

  if (meta.driverName && meta.driverName !== meta.passengerName) {
    tags.push(`Driver: ${meta.driverName}`);
  } else if (actorIsDriverOnly && meta.actorName) {
    tags.push(`Driver: ${meta.actorName}`);
  }
  if (meta.recipientName && meta.recipientName !== meta.passengerName) {
    tags.push(`To: ${meta.recipientName}`);
  }
  if (meta.pickup && meta.dropoff) {
    tags.push(`${meta.pickup} → ${meta.dropoff}`);
  }
  if (meta.vehicleNumber) {
    tags.push(meta.vehicleNumber);
  }
  if (meta.rating) {
    tags.push(`${meta.rating}★`);
  }
  return tags;
}

// ─── REST API Helpers ─────────────────────────────────────────────────────────

export async function fetchAdminNotificationsApi(
  fetchWithAuth: FetchWithAuthFn,
  options?: { limit?: number; category?: string; unreadOnly?: boolean; signal?: AbortSignal }
): Promise<AdminNotification[]> {
  const params: string[] = [];
  if (options?.limit) params.push(`limit=${encodeURIComponent(String(options.limit))}`);
  if (options?.category && options.category !== 'all' && options.category !== 'unread') {
    params.push(`category=${encodeURIComponent(options.category)}`);
  }
  if (options?.unreadOnly) params.push('unreadOnly=true');
  const qs = params.length > 0 ? `?${params.join('&')}` : '';

  const res = await fetchWithAuth(`${API_BASE}/api/notifications/${qs}`, {
    signal: options?.signal,
  });
  const parsed = await parseJsonSafe<any>(res);
  if (!res.ok) {
    throw new Error(getApiErrorMessage(parsed, `Failed to load notifications (${res.status})`, res));
  }
  return normalizeNotificationsList(parsed);
}

export async function fetchUnreadNotificationCountApi(
  fetchWithAuth: FetchWithAuthFn,
  signal?: AbortSignal
): Promise<number | null> {
  const res = await fetchWithAuth(`${API_BASE}/api/notifications/unread-count`, { signal });
  if (!res.ok) return null;
  const parsed = await parseJsonSafe<any>(res);
  if (typeof parsed?.unreadCount === 'number') {
    return parsed.unreadCount;
  }
  return null;
}

export async function markNotificationReadApi(
  fetchWithAuth: FetchWithAuthFn,
  notificationId: string
): Promise<boolean> {
  if (!notificationId) return false;
  const res = await fetchWithAuth(`${API_BASE}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PUT',
  });
  return res.ok;
}

export async function markAllNotificationsReadApi(
  fetchWithAuth: FetchWithAuthFn,
  category?: string
): Promise<boolean> {
  const qs =
    category && category !== 'all' && category !== 'unread'
      ? `?category=${encodeURIComponent(category)}`
      : '';
  const res = await fetchWithAuth(`${API_BASE}/api/notifications/read-all${qs}`, {
    method: 'PUT',
  });
  return res.ok;
}

export async function clearAllNotificationsApi(fetchWithAuth: FetchWithAuthFn): Promise<boolean> {
  const res = await fetchWithAuth(`${API_BASE}/api/notifications/clear`, {
    method: 'DELETE',
  });
  return res.ok;
}

export async function sendTestPushApi(
  fetchWithAuth: FetchWithAuthFn
): Promise<{ ok: boolean; message: string }> {
  const res = await fetchWithAuth(`${API_BASE}/api/notifications/test-push`, {
    method: 'POST',
  });
  const parsed = await parseJsonSafe<any>(res);
  if (res.ok) {
    return {
      ok: true,
      message: parsed?.message || 'Test push notification sent!',
    };
  }
  return {
    ok: false,
    message: getApiErrorMessage(parsed, `Failed to send test push (${res.status})`, res),
  };
}
