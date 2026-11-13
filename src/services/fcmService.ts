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
  bookingId?: string;
  rideId?: string;
  status?: string;
  relatedId?: string;
  pickup?: string;
  dropoff?: string;
  url?: string;
};

type NavigateToScreen = (type: string, data: FCMNotificationPayload) => void;

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

// ─── Token Upload ──────────────────────────────────────────────────────────────

const ACTIVE_FCM_TOKEN_KEY = 'active_fcm_token';
const PENDING_FCM_TOKEN_KEY = 'pending_fcm_token';

let currentFCMToken: string | null = null;

async function uploadToken(fcmToken: string, authToken: string, expectedGeneration?: number): Promise<void> {
  try {
    if (expectedGeneration !== undefined && getAuthSessionGeneration() !== expectedGeneration) {
      return;
    }
    currentFCMToken = fcmToken;
    await AsyncStorage.setItem(ACTIVE_FCM_TOKEN_KEY, fcmToken).catch(() => {});
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
      const latestToken = await AsyncStorage.getItem('auth_token').catch(() => null);
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
      return;
    }

    if (res.ok) {
      console.log('[FCM] Token uploaded to backend successfully');
      await AsyncStorage.removeItem(PENDING_FCM_TOKEN_KEY);
    } else {
      console.warn('[FCM] Backend token upload failed:', res.status);
      await AsyncStorage.setItem(PENDING_FCM_TOKEN_KEY, fcmToken);
    }
  } catch (e) {
    console.warn('[FCM] Failed to upload token (network error). Caching for retry:', e);
    if (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration) {
      await AsyncStorage.setItem(PENDING_FCM_TOKEN_KEY, fcmToken);
    }
  }
}

async function syncPendingToken(authToken: string, expectedGeneration?: number): Promise<void> {
  try {
    if (expectedGeneration !== undefined && getAuthSessionGeneration() !== expectedGeneration) {
      return;
    }
    const pendingToken = await AsyncStorage.getItem(PENDING_FCM_TOKEN_KEY);
    if (pendingToken && (expectedGeneration === undefined || getAuthSessionGeneration() === expectedGeneration)) {
      console.log('[FCM] Found pending token, syncing...');
      await uploadToken(pendingToken, authToken, expectedGeneration);
    }
  } catch (e) {
    console.warn('[FCM] Failed to sync pending token:', e);
  }
}

function handleNotificationNavigation(data: FCMNotificationPayload, navigate: NavigateToScreen): void {
  if (!data?.type) return;
  console.log('[FCM] Notification tap → type:', data.type);
  navigate(data.type, data);
}

// ─── Main Registration ─────────────────────────────────────────────────────────

let foregroundUnsubscribe: (() => void) | null = null;
// Mutable callback ref so persistent SW / native listeners always call the latest MainTabs handler
let activeNavigateCallback: NavigateToScreen | null = null;
// Track whether SW message listener is already attached to avoid duplicates
let swMessageListenerAttached = false;
// Track native unsubscribe handles
let nativeForegroundUnsubscribe: (() => void) | null = null;
let nativeOpenedAppUnsubscribe: (() => void) | null = null;
let nativeTokenRefreshUnsubscribe: (() => void) | null = null;

export async function registerFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  const startGen = getAuthSessionGeneration();
  activeNavigateCallback = onNavigate;
  const dispatchNavigate: NavigateToScreen = (type, data) => {
    activeNavigateCallback?.(type, data);
  };

  await syncPendingToken(authToken, startGen);
  if (getAuthSessionGeneration() !== startGen) return;

  if (Platform.OS === 'web') {
    await registerWebFCM(authToken, dispatchNavigate, startGen);
  } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
    await registerNativeFCM(authToken, dispatchNavigate, startGen);
  }
}

// ─── Native (Android / iOS) Registration Logic ────────────────────────────────
async function registerNativeFCM(authToken: string, onNavigate: NavigateToScreen, startGen: number): Promise<void> {
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
          message: 'Allow GoRaahi to send you ride and booking notifications.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[FCM Native] POST_NOTIFICATIONS permission denied. Lock screen notifications will not work.');
        return;
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
        return;
      }
    }

    // Get the native device FCM token
    if (getAuthSessionGeneration() !== startGen) return;
    const token = await getToken(messagingInstance);
    if (getAuthSessionGeneration() !== startGen) return;
    if (token) {
      console.log('[FCM Native] Got device token, uploading...');
      await uploadToken(token, authToken, startGen);
    } else {
      console.warn('[FCM Native] Empty token — check google-services.json / APNs configuration.');
    }
    if (getAuthSessionGeneration() !== startGen) return;

    // Handle foreground messages (app is open and in focus)
    if (nativeForegroundUnsubscribe) nativeForegroundUnsubscribe();
    nativeForegroundUnsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      console.log('[FCM Native] Foreground message:', remoteMessage?.messageId);
      const data = remoteMessage?.data || {};
      handleNotificationNavigation(data as FCMNotificationPayload, onNavigate);
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
      const latestAuthToken = await AsyncStorage.getItem('auth_token').catch(() => null);
      if (!latestAuthToken || getAuthSessionGeneration() !== startGen) return;
      await uploadToken(newToken, latestAuthToken, startGen);
    });

    console.log('[FCM Native] Registration complete.');
  } catch (e) {
    console.warn('[FCM Native] Registration failed (google-services.json may be missing or this is a web build):', e);
  }
}

// ─── Web Registration Logic ────────────────────────────────────────────────────
async function registerWebFCM(authToken: string, onNavigate: NavigateToScreen, startGen: number): Promise<void> {
  const messaging = await getWebMessaging();
  if (!messaging || getAuthSessionGeneration() !== startGen) return;

  try {
    // 1. Request notification permission from the browser
    const permission = await Notification.requestPermission();
    if (getAuthSessionGeneration() !== startGen) return;
    if (permission !== 'granted') {
      console.warn('[FCM Web] Notification permission denied. Lock screen notifications will not work.');
      return;
    }

    const { getToken, onMessage } = await import('firebase/messaging');
    if (getAuthSessionGeneration() !== startGen) return;

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
    if (getAuthSessionGeneration() !== startGen) return;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (getAuthSessionGeneration() !== startGen) return;

    if (token) {
      console.log('[FCM Web] Got web push token');
      await uploadToken(token, authToken, startGen);
    } else {
      console.warn('[FCM Web] Empty token — check VAPID key and SW registration. Notifications will not work.');
    }
    if (getAuthSessionGeneration() !== startGen) return;

    // 4. Foreground message handler: when the tab is open and visible, Firebase
    //    suppresses the system notification and calls this handler instead.
    //    We explicitly show a notification via the SW so behaviour is consistent
    //    with background messages. A dedup set prevents double-firing.
    const shownForegroundIds = new Set<string>();

    if (foregroundUnsubscribe) foregroundUnsubscribe();
    foregroundUnsubscribe = onMessage(messaging, (payload: any) => {
      // Deduplicate by message ID
      const msgId = payload?.messageId || payload?.fcmMessageId || '';
      console.log('[FCM Web] Foreground message received:', msgId || payload?.data?.type || 'notification');
      if (msgId && shownForegroundIds.has(msgId)) {
        console.log('[FCM Web] Duplicate foreground message suppressed:', msgId);
        return;
      }
      if (msgId) shownForegroundIds.add(msgId);

      const data      = payload?.data || {};
      const type      = data.type     || 'general';
      const relatedId = data.relatedId || data.bookingId || '';
      const bookingId = data.bookingId || '';
      const pickup    = data.pickup   || '';
      const dropoff   = data.dropoff  || '';

      const title = payload?.notification?.title || data.title || 'GoRaahi';
      let   body  = payload?.notification?.body  || data.body  || '';

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
            tag:                `${type}-${relatedId}`,
            renotify:           true,
            requireInteraction: type === 'booking_request' || type === 'chat',
            vibrate:            [200, 100, 200, 100, 200],
            data:               data,
          } as NotificationOptions);
        }).catch(err => console.warn('[FCM Web] Foreground showNotification error:', err));
      }
    });

    // 5. Listen for messages posted FROM the service worker (e.g. notification click).
    //    Guard with a flag so multiple registerFCM calls don't stack duplicate listeners.
    //    Uses mutable activeNavigateCallback so logout/re-login never invokes a stale closure.
    if ('serviceWorker' in navigator && !swMessageListenerAttached) {
      swMessageListenerAttached = true;
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          console.log('[FCM Web] SW notification click relayed:', event.data?.data?.type || 'tap');
          if (activeNavigateCallback) {
            handleNotificationNavigation(event.data.data as FCMNotificationPayload, activeNavigateCallback);
          }
        }
      });
    }

  } catch (e) {
    console.error('[FCM Web] Registration failed:', e);
  }
}

/**
 * Unsubscribes foreground FCM listeners on logout and removes token from backend.
 */
export async function unregisterFCM(authToken?: string): Promise<void> {
  activeNavigateCallback = null;

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

  const tokenToRemove =
    currentFCMToken || (await AsyncStorage.getItem(ACTIVE_FCM_TOKEN_KEY).catch(() => null));

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

  currentFCMToken = null;
  await AsyncStorage.removeItem(ACTIVE_FCM_TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(PENDING_FCM_TOKEN_KEY).catch(() => {});

  // Keep swMessageListenerAttached = true — the listener is on navigator.serviceWorker
  // which persists across login/logout; activeNavigateCallback updates on next registerFCM.
  console.log('[FCM] Foreground listeners unregistered');
}
