/**
 * fcmService.ts
 * Firebase Cloud Messaging integration for RaahiApp (Web PWA).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../apiConfig';
import { firebaseWebConfig, VAPID_KEY } from '../config/firebaseWebConfig';

// ─── Type Definitions ──────────────────────────────────────────────────────────

export type FCMNotificationPayload = {
  type?: string;
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

async function uploadToken(fcmToken: string, authToken: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/user/fcm-token`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken }),
    });
    if (res.ok) {
      console.log('[FCM] Token uploaded to backend successfully');
      await AsyncStorage.removeItem('pending_fcm_token');
    } else {
      console.warn('[FCM] Backend token upload failed:', res.status);
      await AsyncStorage.setItem('pending_fcm_token', fcmToken);
    }
  } catch (e) {
    console.warn('[FCM] Failed to upload token (network error). Caching for retry:', e);
    await AsyncStorage.setItem('pending_fcm_token', fcmToken);
  }
}

async function syncPendingToken(authToken: string): Promise<void> {
  try {
    const pendingToken = await AsyncStorage.getItem('pending_fcm_token');
    if (pendingToken) {
      console.log('[FCM] Found pending token, syncing...');
      await uploadToken(pendingToken, authToken);
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
// Track whether SW message listener is already attached to avoid duplicates
let swMessageListenerAttached = false;

export async function registerFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  await syncPendingToken(authToken);

  if (Platform.OS === 'web') {
    await registerWebFCM(authToken, onNavigate);
  }
  // Native (Android/iOS) is not used — this is a web-only PWA.
}

// ─── Web Registration Logic ────────────────────────────────────────────────────
async function registerWebFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  const messaging = await getWebMessaging();
  if (!messaging) return;

  try {
    // 1. Request notification permission from the browser
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM Web] Notification permission denied. Lock screen notifications will not work.');
      return;
    }

    const { getToken, onMessage } = await import('firebase/messaging');

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
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('[FCM Web] Got web push token');
      await uploadToken(token, authToken);
    } else {
      console.warn('[FCM Web] Empty token — check VAPID key and SW registration. Notifications will not work.');
    }

    // 4. Foreground message handler: when the tab is open and visible, Firebase
    //    suppresses the system notification and calls this handler instead.
    //    We explicitly show a notification via the SW so behaviour is consistent
    //    with background messages. A dedup set prevents double-firing.
    const shownForegroundIds = new Set<string>();

    if (foregroundUnsubscribe) foregroundUnsubscribe();
    foregroundUnsubscribe = onMessage(messaging, (payload: any) => {
      console.log('[FCM Web] Foreground message received:', payload);

      // Deduplicate by message ID
      const msgId = payload?.messageId || payload?.fcmMessageId || '';
      if (msgId && shownForegroundIds.has(msgId)) {
        console.log('[FCM Web] Duplicate foreground message suppressed:', msgId);
        return;
      }
      if (msgId) shownForegroundIds.add(msgId);

      const data     = payload?.data || {};
      const type     = data.type     || 'general';
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
    if ('serviceWorker' in navigator && !swMessageListenerAttached) {
      swMessageListenerAttached = true;
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          console.log('[FCM Web] SW notification click relayed:', event.data.data);
          handleNotificationNavigation(event.data.data as FCMNotificationPayload, onNavigate);
        }
      });
    }

  } catch (e) {
    console.error('[FCM Web] Registration failed:', e);
  }
}

/**
 * Unsubscribes foreground FCM listener on logout.
 */
export function unregisterFCM(): void {
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
  // Keep swMessageListenerAttached = true — the listener is on navigator.serviceWorker
  // which persists across login/logout; removing it would break notification clicks.
  console.log('[FCM] Foreground listener unregistered');
}
