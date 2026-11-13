// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker — handles background & lock screen notifications.
// v5 — adds: admin deep-link routing, unique tags when relatedId is empty, and PUSH_RECEIVED relay to open tabs.

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAQ_mrNt4HncSj3t-ONgk8OLviSa2ZkTNM",
  authDomain: "project-4e312d2c-0d4c-4929-860.firebaseapp.com",
  projectId: "project-4e312d2c-0d4c-4929-860",
  storageBucket: "project-4e312d2c-0d4c-4929-860.firebasestorage.app",
  messagingSenderId: "137804375265",
  appId: "1:137804375265:web:8e5f4bc7ffccbe266343a0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ─── Deduplication: track recently shown notification IDs ────────────────────
// FCM can deliver the same push multiple times in edge cases. We track the last
// 20 message IDs and suppress any duplicate within the same SW lifetime.
const shownMessageIds = new Set();
const recentFallbackKeys = new Map();
const FALLBACK_DEDUP_WINDOW_MS = 10000;

function isDuplicate(msgId, fallbackKey) {
  if (msgId) {
    if (shownMessageIds.has(msgId)) return true;
    shownMessageIds.add(msgId);
    // Keep set bounded: remove oldest entries beyond 20
    if (shownMessageIds.size > 20) {
      shownMessageIds.delete(shownMessageIds.values().next().value);
    }
    return false;
  }

  if (!fallbackKey) return false;
  const now = Date.now();
  // Prune expired fallback keys
  for (const [key, ts] of recentFallbackKeys.entries()) {
    if (now - ts > FALLBACK_DEDUP_WINDOW_MS) {
      recentFallbackKeys.delete(key);
    }
  }
  const prevTs = recentFallbackKeys.get(fallbackKey);
  if (prevTs !== undefined && now - prevTs <= FALLBACK_DEDUP_WINDOW_MS) {
    return true;
  }
  recentFallbackKeys.set(fallbackKey, now);
  return false;
}

// ─── Build rich notification options from FCM payload ───────────────────────
function buildNotificationOptions(data, notificationType) {
  const type      = data?.type      || notificationType || 'general';
  const relatedId = data?.relatedId || data?.bookingId || data?.rideId || data?.driverId || data?.userId || '';
  const notifId   = data?.notificationId || '';
  const bookingId = data?.bookingId || '';
  const pickup    = data?.pickup    || '';
  const dropoff   = data?.dropoff   || '';

  // Build a rich body for driver booking-request notifications
  let extraLines = '';
  if (type === 'booking_request' && pickup && dropoff) {
    extraLines = `\n📍 ${pickup} → ${dropoff}`;
    if (bookingId) {
      // Show short ID (last 6 chars) so driver can cross-reference
      extraLines += `\n🔖 Booking #${bookingId.slice(-6).toUpperCase()}`;
    }
  }

  const tag = relatedId
    ? `${type}-${relatedId}`
    : (notifId ? `${type}-${notifId}` : `${type}-${Date.now()}`);

  return {
    icon:               '/logo192.png',
    badge:              '/logo192.png',
    tag,
    renotify:           true,
    requireInteraction:
      type === 'booking_request' ||
      type === 'chat' ||
      type === 'driver_kyc_submitted' ||
      type === 'driver_kyc_resubmitted',
    vibrate:            [200, 100, 200, 100, 200],
    silent:             false,
    data:               { ...data, _extraLines: extraLines },
  };
}

// ─── Background message handler ──────────────────────────────────────────────
// NOTE: The raw `push` event listener below is the PRIMARY handler for ALL FCM
// messages (including those with a notification block). The Firebase compat SDK's
// onBackgroundMessage has historically had issues with event.waitUntil not being
// properly propagated, causing the SW to terminate before showNotification completes.
//
// We register onBackgroundMessage as a secondary safety net ONLY. It will be a
// no-op for any message the `push` event already deduplicated.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] onBackgroundMessage (secondary handler):', payload?.messageId || '');
  return Promise.resolve();
});

// ─── Primary push event handler ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { data: { body: event.data.text() } }; }

  const notifBlock = payload.notification || {};
  const dataBlock  = payload.data        || {};

  // Extract the real message ID from whichever field FCM uses
  const msgId = payload.messageId || payload.fcmMessageId ||
                dataBlock.notificationId || dataBlock.google?.c_id || '';

  const data  = dataBlock;
  const type  = data.type || 'general';
  const relatedId = data.relatedId || data.bookingId || data.rideId || data.driverId || data.userId || '';
  const title = notifBlock.title || data.title || 'GoRaahi';
  const opts  = buildNotificationOptions(data, type);

  let body = notifBlock.body || data.body || 'You have a new update.';
  if (opts.data?._extraLines) {
    body = body + opts.data._extraLines;
  }

  // Deduplicate — use messageId/notificationId when present, otherwise a time-windowed fallback key
  const fallbackKey = `${type}:${relatedId}:${data.action || ''}:${title}:${body}`;
  if (isDuplicate(msgId, fallbackKey)) {
    console.log('[SW] push: duplicate suppressed:', msgId || fallbackKey);
    return;
  }

  console.log('[SW] push: showing notification — type:', type, 'title:', title);

  const showPromise = self.registration.showNotification(title, { body, ...opts })
    .then(() => console.log('[SW] push: showNotification resolved for type:', type))
    .catch(err => console.error('[SW] push: showNotification error:', err));

  // Notify any open GoRaahi tabs so the Admin bell badge refreshes immediately
  const relayPromise = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.postMessage({
            type: 'PUSH_RECEIVED',
            data: { ...data, title, body },
          });
        }
      }
    })
    .catch(() => {});

  event.waitUntil(Promise.all([showPromise, relayPromise]));
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawData = event.notification.data || {};
  // Clone so we never mutate event.notification.data in-place
  const payloadData = { ...(rawData.FCM_MSG?.data || rawData) };
  // Clean up internal helpers
  delete payloadData._extraLines;

  const type      = payloadData.type;
  const relatedId = payloadData.relatedId || payloadData.bookingId || payloadData.rideId || payloadData.driverId || payloadData.userId || '';
  const bookingId = payloadData.bookingId || '';

  console.log('[SW] Notification clicked, type:', type, 'bookingId:', bookingId, 'targetView:', payloadData.targetView || '');

  // Determine the deep-link URL.
  // Priority: explicit url field → admin targetView → user/driver type-based path → root
  let path = payloadData.url || '/';

  if (!payloadData.url) {
    if (payloadData.audience === 'admin' || payloadData.targetView || payloadData.adminView) {
      const view = payloadData.targetView || payloadData.adminView || 'NOTIFICATIONS';
      const params = new URLSearchParams();
      params.set('adminView', view);
      if (relatedId) params.set('relatedId', relatedId);
      if (type) params.set('type', type);
      if (payloadData.notificationId) params.set('notificationId', payloadData.notificationId);
      path = `/?${params.toString()}`;
    } else if (payloadData.action === 'rekyc') {
      path = '/?rekyc=true';
    } else if (type === 'booking_request') {
      path = '/?openRequests=true';
    } else if (type === 'booking_status' || type === 'ride_started' || type === 'ride_completed') {
      path = '/?openTrips=true';
    } else if (type === 'chat' && relatedId) {
      path = `/?chat=${relatedId}`;
    }
  }

  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing GoRaahi tab and relay the click payload via postMessage
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: payloadData });
          return client.focus();
        }
      }
      // No existing tab — open a new window. The app reads URL params on load.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Service Worker lifecycle ─────────────────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
self.addEventListener('message',  (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
