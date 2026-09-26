// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker — handles background & lock screen notifications.
// v3 — fixes: deduplication, rich booking_request notifications, deep-link on cold-start.

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

function isDuplicate(msgId) {
  if (!msgId) return false;
  if (shownMessageIds.has(msgId)) return true;
  shownMessageIds.add(msgId);
  // Keep set bounded: remove oldest entries beyond 20
  if (shownMessageIds.size > 20) {
    shownMessageIds.delete(shownMessageIds.values().next().value);
  }
  return false;
}

// ─── Build rich notification options from FCM payload ───────────────────────
function buildNotificationOptions(data, notificationType) {
  const type      = data?.type      || notificationType || 'general';
  const relatedId = data?.relatedId || data?.bookingId  || '';
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

  return {
    icon:               '/logo192.png',
    badge:              '/logo192.png',
    tag:                `${type}-${relatedId}`,   // collapse duplicates per type+ride
    renotify:           true,                      // vibrate even if tag already exists
    requireInteraction: type === 'booking_request' || type === 'chat', // stay on screen for actionable notifs
    vibrate:            [200, 100, 200, 100, 200],
    silent:             false,
    data:               { ...data, _extraLines: extraLines },
  };
}

// ─── Background message handler ──────────────────────────────────────────────
// Firebase calls this for every FCM message received while the app is in
// background or the screen is locked. We MUST call showNotification ourselves.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', JSON.stringify(payload));

  // FCM messages have a unique message_id — use it to deduplicate
  const msgId = payload.messageId || payload.fcmMessageId || '';
  if (isDuplicate(msgId)) {
    console.log('[SW] Duplicate message suppressed:', msgId);
    return;
  }

  const data   = payload.data   || {};
  const type   = data.type || 'general';

  const title  = payload.notification?.title || data.title || 'GoRaahi';
  const opts   = buildNotificationOptions(data, type);

  // Compose body: use notification block body first, then data body, then generic
  let body = payload.notification?.body || data.body || 'You have a new update.';
  if (opts.data?._extraLines) {
    body = body + opts.data._extraLines;
  }

  return self.registration.showNotification(title, { body, ...opts });
});

// ─── Raw push fallback ────────────────────────────────────────────────────────
// Catches data-only FCM messages that Firebase's SDK may not surface through
// onBackgroundMessage (messages sent with content_available but no notification block).
// We use a separate tag ('raw-*') to avoid duplicating what onBackgroundMessage shows.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { data: { body: event.data.text() } }; }

  // If FCM included a notification block, onBackgroundMessage already handled it.
  const hasNotificationBlock = !!(payload.notification?.title);
  if (hasNotificationBlock) return;

  // Data-only push: deduplicate by messageId if present
  const msgId = payload.messageId || payload.fcmMessageId || '';
  if (isDuplicate('raw-' + msgId)) return;

  const data  = payload.data || {};
  const type  = data.type || 'general';
  const title = data.title || 'GoRaahi';
  const opts  = buildNotificationOptions(data, type);
  let body = data.body || 'You have a new update.';
  if (opts.data?._extraLines) {
    body = body + opts.data._extraLines;
  }

  // Use a distinct tag prefix so it doesn't collide with onBackgroundMessage
  opts.tag = 'raw-' + opts.tag;

  event.waitUntil(self.registration.showNotification(title, { body, ...opts }));
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawData = event.notification.data || {};
  // Firebase Web SDK may nest the real payload under FCM_MSG
  const payloadData = rawData.FCM_MSG?.data || rawData;
  // Clean up internal helpers
  delete payloadData._extraLines;

  const type      = payloadData.type;
  const relatedId = payloadData.relatedId || payloadData.bookingId || '';
  const bookingId = payloadData.bookingId || '';

  console.log('[SW] Notification clicked, type:', type, 'bookingId:', bookingId);

  // Determine the deep-link URL.
  // Priority: explicit url field → type-based path → root
  let path = payloadData.url || '/';

  // Override for well-known types if url wasn't set in data
  if (!payloadData.url) {
    if (type === 'booking_request') {
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
      // No existing tab — open a new window. The app reads URL params on load
      // to handle navigation (see App.tsx cold-start handler).
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Service Worker lifecycle ─────────────────────────────────────────────────
// Skip waiting so the new SW activates immediately without requiring a page reload.
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
