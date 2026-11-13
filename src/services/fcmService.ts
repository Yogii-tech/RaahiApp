/**
 * fcmService.ts
 * Firebase Cloud Messaging integration for RaahiApp.
 * Supports both Web (PWA via Firebase JS SDK) and Native Android/iOS
 * (via @react-native-firebase/messaging).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import { firebaseWebConfig, VAPID_KEY } from '../config/firebaseWebConfig';
import { getAuthSessionGeneration, refreshAuthToken } from '../utils/api';

// ─── Type Definitions ──────────────────────────────────────────────────────────

export type FCMNotificationPayload = {
  type?: string;
  action?: string;
  category?: string;
  targetView?: string;
  adminView?: string;
  bookingId?: string;
  bid?: string;
  rideId?: string;
  driverId?: string;
  userId?: string;
  notificationId?: string;
  audience?: string;
  status?: string;
  relatedId?: string;
  pickup?: string;
  dropoff?: string;
  actorName?: string;
  actorPhone?: string;
  vehicleNumber?: string;
  vehicleName?: string;
  bookingType?: string;
  rating?: string;
  parcelSize?: string;
  recipientName?: string;
  title?: string;
  body?: string;
  url?: string;
};

export type WebPushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export type RegisterFCMOptions = {
  onForegroundMessage?: (payload: FCMNotificationPayload) => void;
  onPushReceived?: (payload: FCMNotificationPayload) => void;
  promptIfDefault?: boolean;
};

export type FCMRegistrationResult = {
  permission: WebPushPermissionState;
  tokenUploaded: boolean;
};

type NavigateToScreen = (type: string, data: FCMNotificationPayload) => void;
type PayloadCallback = (payload: FCMNotificationPayload) => void;

// ─── Web Firebase Lazy Imports ─────────────────────────────────────────────────

let webMessaging: any = null;

async function getWebMessaging() {
  if (Platform.OS !== 'web') return null;
  if (!webMessaging) {
    try {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, isSupported } = await import('firebase/messaging');

      const app = getApps().length === 0 ? initializeApp(firebaseWebConfig) : getApp();
      const supported = await isSupported();

      if (supported) {
        webMessaging = getMessaging(app);
      } else {
        console.warn('[FCM Web] Push notifications are not supported in this browser.');
      }
    } catch (e) {
      console.warn('[FCM Web] Firebase setup failed:', e);
      webMessaging = null;
    }
  }
  return webMessaging;
}

export function getWebNotificationPermission(): WebPushPermissionState {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return 'unsupported';
  }
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  const perm = Notification.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'unsupported';
}

// ─── Token Upload ──────────────────────────────────────────────────────────────

const ACTIVE_FCM_TOKEN_KEY = 'active_fcm_token';
const PENDING_FCM_TOKEN_KEY = 'pending_fcm_token';
const MAX_FOREGROUND_DEDUP_IDS = 50;

let currentFCMToken: string | null = null;
let unregisterInFlightPromise: Promise<void> | null = null;

async function safeStorageGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeStorageSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in tests or restricted web private modes
  }
}

async function safeStorageRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

async function uploadToken(fcmToken: string, authToken: string, expectedGeneration?: number): Promise<boolean> {
  try {
    if (expectedGeneration !== undefined && getAuthSessionGeneration() !== expectedGeneration) {
      return false;
    }
    currentFCMToken = fcmToken;
    await safeStorageSetItem(ACTIVE_FCM_TOKEN_KEY, fcmToken);
    const sendPut = async (bearer: string) =>
      fetch(`${API_BASE}/api/user/fcm-token`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fcmToken }),
      });

    let res = await sendPut(authToken);
    if (res.status === 401 && (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration)) {
      const latestToken = await safeStorageGetItem('auth_token');
      const nextToken =
        (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration) &&
        latestToken &&
        latestToken !== authToken
          ? latestToken
          : await refreshAuthToken();
      if (nextToken && (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration)) {
        res = await sendPut(nextToken);
      }
    }

    if (expectedGeneration !== undefined && getAuthSessionGeneration() !== expectedGeneration) {
      return false;
    }

    if (res.ok) {
      console.log('[FCM] Token uploaded to backend successfully');
      await safeStorageRemoveItem(PENDING_FCM_TOKEN_KEY);
      return true;
    } else {
      console.warn('[FCM] Backend token upload failed:', res.status);
      await safeStorageSetItem(PENDING_FCM_TOKEN_KEY, fcmToken);
      return false;
    }
  } catch (e) {
    console.warn('[FCM] Failed to upload token (network error). Caching for retry:', e);
    if (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration) {
      await safeStorageSetItem(PENDING_FCM_TOKEN_KEY, fcmToken);
    }
    return false;
  }
}

async function syncPendingToken(authToken: string, expectedGeneration?: number): Promise<void> {
  try {
    if (expectedGeneration !== undefined && getAuthSessionGeneration() !== expectedGeneration) {
      return;
    }
    const pendingToken = await safeStorageGetItem(PENDING_FCM_TOKEN_KEY);
    if (pendingToken && (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration)) {
      console.log('[FCM] Found pending token, syncing...');
      await uploadToken(pendingToken, authToken, expectedGeneration);
    }
  } catch (e) {
    console.warn('[FCM] Failed to sync pending token:', e);
  }
}

function handleNotificationNavigation(data: FCMNotificationPayload, navigate: NavigateToScreen): void {
  if (!data?.type && !data?.targetView && !data?.adminView && !data?.url) return;
  const resolvedType = data.type || 'general';
  console.log('[FCM] Notification tap → type:', resolvedType);
  navigate(resolvedType, data);
}

// ─── Main Registration ─────────────────────────────────────────────────────────

let foregroundUnsubscribe: (() => void) | null = null;
// Mutable callback refs so persistent SW / native listeners always call the latest handler
let activeNavigateCallback: NavigateToScreen | null = null;
let activeForegroundCallback: PayloadCallback | null = null;
let activePushReceivedCallback: PayloadCallback | null = null;
// Track ServiceWorkerContainer instance that already has the message listener attached
let attachedServiceWorkerContainer: any = null;
// Track native unsubscribe handles
let nativeForegroundUnsubscribe: (() => void) | null = null;
let nativeOpenedAppUnsubscribe: (() => void) | null = null;
let nativeTokenRefreshUnsubscribe: (() => void) | null = null;

function attachWebServiceWorkerMessageListener(): void {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker &&
    attachedServiceWorkerContainer !== navigator.serviceWorker
  ) {
    attachedServiceWorkerContainer = navigator.serviceWorker;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        console.log('[FCM Web] SW notification click relayed:', event.data?.data?.type || 'tap');
        if (activeNavigateCallback) {
          handleNotificationNavigation((event.data.data || {}) as FCMNotificationPayload, activeNavigateCallback);
        }
      } else if (event.data?.type === 'PUSH_RECEIVED') {
        const payload = (event.data.data || {}) as FCMNotificationPayload;
        activePushReceivedCallback?.(payload);
      }
    });
  }
}

export async function registerFCM(
  authToken: string,
  onNavigate: NavigateToScreen,
  options?: RegisterFCMOptions
): Promise<FCMRegistrationResult> {
  const startGen = getAuthSessionGeneration();
  activeNavigateCallback = onNavigate;
  activeForegroundCallback = options?.onForegroundMessage ?? null;
  activePushReceivedCallback = options?.onPushReceived ?? null;

  const dispatchNavigate: NavigateToScreen = (type, data) => {
    activeNavigateCallback?.(type, data);
  };

  attachWebServiceWorkerMessageListener();

  await syncPendingToken(authToken, startGen);
  if (getAuthSessionGeneration() !== startGen) {
    return { permission: getWebNotificationPermission(), tokenUploaded: false };
  }

  if (Platform.OS === 'web') {
    return registerWebFCM(authToken, dispatchNavigate, startGen, options);
  } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
    const uploaded = await registerNativeFCM(authToken, dispatchNavigate, startGen);
    return { permission: uploaded ? 'granted' : 'default', tokenUploaded: uploaded };
  }

  return { permission: 'unsupported', tokenUploaded: false };
}

// ─── Native (Android / iOS) Registration Logic ────────────────────────────────
async function registerNativeFCM(
  authToken: string,
  onNavigate: NavigateToScreen,
  startGen: number
): Promise<boolean> {
  try {
    // Dynamically import @react-native-firebase/messaging modular API (not available on web build)
    const {
      getMessaging,
      getToken,
      onMessage,
      onNotificationOpenedApp,
      getInitialNotification,
      onTokenRefresh,
      requestPermission,
      AuthorizationStatus,
    } = await import('@react-native-firebase/messaging');
    const messagingInstance = getMessaging();

    // Android 13+ (API 33+) requires POST_NOTIFICATIONS at runtime.
    // Declaring it in the manifest is not enough — the user must also grant it interactively.
    if (Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33) {
      // Lazy-require PermissionsAndroid so the web webpack bundle never sees it
      // (react-native-web does not export it and webpack would warn).
      const { PermissionsAndroid } = require('react-native');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'GoRaahi Notifications',
          message: 'Allow GoRaahi to send you ride, booking, and platform notifications.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[FCM Native] POST_NOTIFICATIONS permission denied. Lock screen notifications will not work.');
        return false;
      }
    }

    // iOS: request notification permission via Firebase Messaging
    if (Platform.OS === 'ios') {
      const authStatus = await requestPermission(messagingInstance);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.warn('[FCM Native iOS] Notification permission denied.');
        return false;
      }
    }

    // Get the native device FCM token
    if (getAuthSessionGeneration() !== startGen) return false;
    const token = await getToken(messagingInstance);
    if (getAuthSessionGeneration() !== startGen) return false;
    let uploaded = false;
    if (token) {
      console.log('[FCM Native] Got device token, uploading...');
      uploaded = await uploadToken(token, authToken, startGen);
    } else {
      console.warn('[FCM Native] Empty token — check google-services.json / APNs configuration.');
    }
    if (getAuthSessionGeneration() !== startGen) return false;

    // Handle foreground messages (app is open and in focus)
    if (nativeForegroundUnsubscribe) nativeForegroundUnsubscribe();
    nativeForegroundUnsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      console.log('[FCM Native] Foreground message:', remoteMessage?.messageId);
      const rawData = (remoteMessage?.data || {}) as Record<string, string>;
      const normalizedPayload: FCMNotificationPayload = {
        ...rawData,
        title: remoteMessage?.notification?.title || rawData.title,
        body: remoteMessage?.notification?.body || rawData.body,
      };
      activePushReceivedCallback?.(normalizedPayload);
      if (activeForegroundCallback) {
        activeForegroundCallback(normalizedPayload);
      } else {
        handleNotificationNavigation(normalizedPayload, onNavigate);
      }
    });

    // Handle notification taps when app is in background (not fully quit)
    if (nativeOpenedAppUnsubscribe) nativeOpenedAppUnsubscribe();
    nativeOpenedAppUnsubscribe = onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
      console.log('[FCM Native] Background tap:', remoteMessage?.messageId);
      const data = remoteMessage?.data || {};
      handleNotificationNavigation(data as FCMNotificationPayload, onNavigate);
    });

    // Handle notification taps when app was fully quit (cold start)
    const initialMessage = await getInitialNotification(messagingInstance);
    if (initialMessage) {
      console.log('[FCM Native] Cold-start tap:', initialMessage?.messageId);
      const data = initialMessage?.data || {};
      handleNotificationNavigation(data as FCMNotificationPayload, onNavigate);
    }

    // Listen for token refreshes and re-upload to keep backend in sync
    if (nativeTokenRefreshUnsubscribe) nativeTokenRefreshUnsubscribe();
    nativeTokenRefreshUnsubscribe = onTokenRefresh(messagingInstance, async (newToken: string) => {
      if (getAuthSessionGeneration() !== startGen) return;
      console.log('[FCM Native] Token refreshed, uploading...');
      const latestAuthToken = await safeStorageGetItem('auth_token');
      if (!latestAuthToken || getAuthSessionGeneration() !== startGen) return;
      await uploadToken(newToken, latestAuthToken, startGen);
    });

    console.log('[FCM Native] Registration complete.');
    return uploaded;
  } catch (e) {
    console.warn('[FCM Native] Registration failed (google-services.json may be missing or this is a web build):', e);
    return false;
  }
}

// ─── Web Registration Logic ────────────────────────────────────────────────────
async function registerWebFCM(
  authToken: string,
  onNavigate: NavigateToScreen,
  startGen: number,
  options?: RegisterFCMOptions
): Promise<FCMRegistrationResult> {
  const initialPermission = getWebNotificationPermission();
  if (initialPermission === 'unsupported') {
    return { permission: 'unsupported', tokenUploaded: false };
  }

  let permission: WebPushPermissionState = initialPermission;
  if (permission === 'default') {
    if (options?.promptIfDefault === false) {
      return { permission: 'default', tokenUploaded: false };
    }
    try {
      const requested = await Notification.requestPermission();
      permission = requested === 'granted' || requested === 'denied' || requested === 'default'
        ? requested
        : 'unsupported';
    } catch {
      return { permission: getWebNotificationPermission(), tokenUploaded: false };
    }
  }

  if (getAuthSessionGeneration() !== startGen) {
    return { permission, tokenUploaded: false };
  }

  if (permission !== 'granted') {
    console.warn('[FCM Web] Notification permission not granted:', permission);
    return { permission, tokenUploaded: false };
  }

  const messaging = await getWebMessaging();
  if (!messaging || getAuthSessionGeneration() !== startGen) {
    return { permission, tokenUploaded: false };
  }

  try {
    const { getToken, onMessage } = await import('firebase/messaging');
    if (getAuthSessionGeneration() !== startGen) {
      return { permission, tokenUploaded: false };
    }

    // 2. Register & activate the service worker BEFORE getting the FCM token.
    //    The SW MUST be active for the FCM token to be tied to it — otherwise
    //    background/lock screen messages have nowhere to land.
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          { scope: '/', updateViaCache: 'none' }  // updateViaCache: 'none' bypasses browser cache
        );

        // If there's a new SW waiting, force it to activate immediately.
        // This ensures users always have the latest SW without needing a tab close.
        if (swRegistration.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Also trigger an update check on every app load so stale SWs get replaced
        swRegistration.update().catch(() => {/* ignore — SW update is best-effort */});

        await navigator.serviceWorker.ready;
        console.log('[FCM Web] Service worker active at scope:', swRegistration.scope);
      } catch (swErr) {
        console.error('[FCM Web] Service worker registration failed:', swErr);
        // Continue — FCM token can still work for foreground, but background will be broken.
      }
    }

    // 3. Get the FCM registration token tied to this SW + VAPID key combination.
    //    This token is what the backend uses to send push notifications.
    if (getAuthSessionGeneration() !== startGen) {
      return { permission, tokenUploaded: false };
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (getAuthSessionGeneration() !== startGen) {
      return { permission, tokenUploaded: false };
    }

    let tokenUploaded = false;
    if (token) {
      console.log('[FCM Web] Got web push token');
      tokenUploaded = await uploadToken(token, authToken, startGen);
    } else {
      console.warn('[FCM Web] Empty token — check VAPID key and SW registration. Notifications will not work.');
    }
    if (getAuthSessionGeneration() !== startGen) {
      return { permission, tokenUploaded };
    }

    // 4. Foreground message handler: when the tab is open and visible, Firebase
    //    suppresses the system notification and calls this handler instead.
    const shownForegroundIds = new Set<string>();

    if (foregroundUnsubscribe) foregroundUnsubscribe();
    foregroundUnsubscribe = onMessage(messaging, (payload: any) => {
      const data      = payload?.data || {};
      const type      = data.type     || 'general';
      const relatedId = data.relatedId || data.bookingId || '';
      const bookingId = data.bookingId || '';
      const pickup    = data.pickup   || '';
      const dropoff   = data.dropoff  || '';

      const title = payload?.notification?.title || data.title || 'GoRaahi';
      let   body  = payload?.notification?.body  || data.body  || '';

      // Deduplicate by message ID or notificationId
      const dedupKey = payload?.messageId || payload?.fcmMessageId || data.notificationId || '';
      console.log('[FCM Web] Foreground message received:', dedupKey || type);
      if (dedupKey && shownForegroundIds.has(dedupKey)) {
        console.log('[FCM Web] Duplicate foreground message suppressed:', dedupKey);
        return;
      }
      if (dedupKey) {
        shownForegroundIds.add(dedupKey);
        if (shownForegroundIds.size > MAX_FOREGROUND_DEDUP_IDS) {
          const oldest = shownForegroundIds.values().next().value;
          if (oldest !== undefined) shownForegroundIds.delete(oldest);
        }
      }

      const normalizedPayload: FCMNotificationPayload = {
        ...data,
        type,
        relatedId,
        title,
        body,
      };

      activePushReceivedCallback?.(normalizedPayload);

      if (activeForegroundCallback) {
        activeForegroundCallback(normalizedPayload);
        return;
      }

      // Build rich body for booking_request (same as SW background handler)
      if (type === 'booking_request' && pickup && dropoff) {
        body = body + `\n📍 ${pickup} → ${dropoff}`;
        if (bookingId) {
          body = body + `\n🔖 Booking #${bookingId.slice(-6).toUpperCase()}`;
        }
      }

      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon:               '/logo192.png',
            badge:              '/logo192.png',
            tag:                relatedId ? `${type}-${relatedId}` : `${type}-${data.notificationId || Date.now()}`,
            renotify:           true,
            requireInteraction: type === 'booking_request' || type === 'chat',
            vibrate:            [200, 100, 200, 100, 200],
            data:               normalizedPayload,
          } as NotificationOptions & Record<string, any>);
        }).catch(err => console.warn('[FCM Web] Foreground showNotification error:', err));
      }
    });

    // 5. Listen for messages posted FROM the service worker (e.g. notification click / push received).
    attachWebServiceWorkerMessageListener();
    return { permission, tokenUploaded };
  } catch (e) {
    console.error('[FCM Web] Registration failed:', e);
    return { permission, tokenUploaded: false };
  }
}

/**
 * Unsubscribes foreground FCM listeners on logout and removes token from backend.
 */
export async function unregisterFCM(authToken?: string): Promise<void> {
  if (unregisterInFlightPromise) {
    return unregisterInFlightPromise;
  }

  activeNavigateCallback = null;
  activeForegroundCallback = null;
  activePushReceivedCallback = null;

  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
  if (nativeForegroundUnsubscribe) {
    nativeForegroundUnsubscribe();
    nativeForegroundUnsubscribe = null;
  }
  if (nativeOpenedAppUnsubscribe) {
    nativeOpenedAppUnsubscribe();
    nativeOpenedAppUnsubscribe = null;
  }
  if (nativeTokenRefreshUnsubscribe) {
    nativeTokenRefreshUnsubscribe();
    nativeTokenRefreshUnsubscribe = null;
  }

  const capturedCurrentToken = currentFCMToken;
  const unregisterStartGen = getAuthSessionGeneration();
  currentFCMToken = null;

  const run = (async () => {
    const tokenToRemove =
      capturedCurrentToken || (await safeStorageGetItem(ACTIVE_FCM_TOKEN_KEY));

    if (getAuthSessionGeneration() === unregisterStartGen) {
      await safeStorageRemoveItem(ACTIVE_FCM_TOKEN_KEY);
      await safeStorageRemoveItem(PENDING_FCM_TOKEN_KEY);
    }

    if (tokenToRemove && authToken) {
      try {
        await fetch(`${API_BASE}/api/user/fcm-token`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ fcmToken: tokenToRemove }),
        });
        console.log('[FCM] Token removed from backend on logout');
      } catch (e) {
        console.warn('[FCM] Failed to remove token from backend on logout:', e);
      }
    }

    // Keep swMessageListenerAttached = true — the listener is on navigator.serviceWorker
    // which persists across login/logout; active callbacks update on next registerFCM.
    console.log('[FCM] Foreground listeners unregistered');
  })().finally(() => {
    if (unregisterInFlightPromise === run) {
      unregisterInFlightPromise = null;
    }
  });

  unregisterInFlightPromise = run;
  return run;
}
