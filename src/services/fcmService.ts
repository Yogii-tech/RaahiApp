/**
 * fcmService.ts
 * Firebase Cloud Messaging integration for RaahiApp.
 * Supports both Native (Android/iOS) and Web.
 */

import { Platform } from 'react-native';
import { API_BASE } from '../apiConfig';
import { firebaseWebConfig, VAPID_KEY } from '../config/firebaseWebConfig';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type FCMNotificationPayload = {
  type?: string;
  bookingId?: string;
  rideId?: string;
  status?: string;
};

type NavigateToScreen = (type: string, data: FCMNotificationPayload) => void;

// ─── Native Firebase Lazy Imports ──────────────────────────────────────────────

let nativeMessaging: any = null;

async function getNativeMessaging() {
  if (Platform.OS === 'web') return null;
  if (!nativeMessaging) {
    try {
      const mod = await import('@react-native-firebase/messaging');
      nativeMessaging = mod.default;
    } catch (e) {
      console.warn('[FCM Native] @react-native-firebase/messaging not available:', e);
      nativeMessaging = null;
    }
  }
  return nativeMessaging;
}

// ─── Web Firebase Lazy Imports ─────────────────────────────────────────────────

let webMessaging: any = null;

async function getWebMessaging() {
  if (Platform.OS !== 'web') return null;
  if (!webMessaging) {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getMessaging, isSupported } = await import('firebase/messaging');
      
      const app = initializeApp(firebaseWebConfig);
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
    } else {
      console.warn('[FCM] Backend token upload failed:', res.status);
    }
  } catch (e) {
    console.warn('[FCM] Failed to upload token to backend:', e);
  }
}

function handleNotificationNavigation(data: FCMNotificationPayload, navigate: NavigateToScreen): void {
  if (!data?.type) return;
  console.log('[FCM] Handling notification tap, type:', data.type);
  navigate(data.type, data);
}

// ─── Main Registration ─────────────────────────────────────────────────────────

let tokenRefreshUnsubscribe: (() => void) | null = null;
let foregroundUnsubscribe: (() => void) | null = null;

export async function registerFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  if (Platform.OS === 'web') {
    await registerWebFCM(authToken, onNavigate);
  } else {
    await registerNativeFCM(authToken, onNavigate);
  }
}

// ─── Native Registration Logic ─────────────────────────────────────────────────
async function registerNativeFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  const fcm = await getNativeMessaging();
  if (!fcm) return;

  try {
    const authStatus = await fcm().requestPermission();
    const granted = authStatus === fcm.AuthorizationStatus.AUTHORIZED || authStatus === fcm.AuthorizationStatus.PROVISIONAL;
    if (!granted) {
      console.log('[FCM Native] Notifications not permitted');
      return;
    }
    
    const token = await fcm().getToken();
    if (token) {
      console.log('[FCM Native] Got device token');
      await uploadToken(token, authToken);
    }
  } catch (e) {
    console.warn('[FCM Native] Failed to register:', e);
  }

  if (tokenRefreshUnsubscribe) tokenRefreshUnsubscribe();
  tokenRefreshUnsubscribe = fcm().onTokenRefresh(async (newToken: string) => {
    console.log('[FCM Native] Token refreshed');
    await uploadToken(newToken, authToken);
  });

  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = fcm().onMessage(async (remoteMessage: any) => {
    console.log('[FCM Native] Foreground message:', remoteMessage?.notification?.title);
  });

  fcm().onNotificationOpenedApp((remoteMessage: any) => {
    if (remoteMessage?.data) handleNotificationNavigation(remoteMessage.data as FCMNotificationPayload, onNavigate);
  });

  fcm().getInitialNotification().then((remoteMessage: any) => {
    if (remoteMessage?.data) {
      setTimeout(() => {
        handleNotificationNavigation(remoteMessage.data as FCMNotificationPayload, onNavigate);
      }, 500);
    }
  });
}

// ─── Web Registration Logic ────────────────────────────────────────────────────
async function registerWebFCM(authToken: string, onNavigate: NavigateToScreen): Promise<void> {
  const messaging = await getWebMessaging();
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM Web] Notifications not permitted');
      return;
    }

    const { getToken, onMessage } = await import('firebase/messaging');
    
    // Get token using VAPID key
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      console.log('[FCM Web] Got browser token');
      await uploadToken(token, authToken);
    } else {
      console.warn('[FCM Web] No registration token available.');
    }

    // Foreground message handler
    if (foregroundUnsubscribe) foregroundUnsubscribe();
    foregroundUnsubscribe = onMessage(messaging, (payload: any) => {
      console.log('[FCM Web] Foreground message:', payload);
      // Optional: show a custom in-app toast/banner here for web users
    });

    // Note: Web background messages are handled by firebase-messaging-sw.js.
    // Notification clicks on web are handled by the service worker bringing the window to focus,
    // which may not directly trigger `onNavigate` inside the React lifecycle like Native does.

  } catch (e) {
    console.warn('[FCM Web] Failed to register:', e);
  }
}

/**
 * Unsubscribes all FCM listeners.
 */
export function unregisterFCM(): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
  if (foregroundUnsubscribe) {
    foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  }
  console.log('[FCM] Listeners unregistered');
}
