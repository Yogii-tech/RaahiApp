// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker — handles background & lock screen notifications.
// v4 — fixes: reliable lock-screen delivery via raw push event, proper event.waitUntil usage.

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
// NOTE: The raw `push` event listener below is the PRIMARY handler for ALL FCM
// messages (including those with a notification block). The Firebase compat SDK's
// onBackgroundMessage has historically had issues with event.waitUntil not being
// properly propagated, causing the SW to terminate before showNotification completes.
//
// We register onBackgroundMessage as a secondary safety net ONLY. It will be a
// no-op for any message the `push` event already deduplicated.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] onBackgroundMessage (secondary handler):', payload?.messageId || '');
  // The raw push handler below has already shown or will show this notification.
  // Return undefined (no-op) to prevent the compat SDK from showing a generic
  // notification on its own.
  return Promise.resolve();
});

// ─── Primary push event handler ───────────────────────────────────────────────
// This is the ONLY reliable way to show lock-screen notifications for ALL FCM
// message types (data-only AND notification+data). The raw `push` event fires
// for every FCM delivery, regardless of whether the Firebase compat SDK surfaces
// it through onBackgroundMessage. We handle everything here and deduplicate so
// the compat SDK's secondary handler is always a no-op.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { data: { body: event.data.text() } }; }

  // FCM wraps data-only pushes under payload.data and notification pushes under
  // payload.notification (and also under payload.data.FCM_MSG in some cases).
  // We normalise both shapes into a single `data` object and `notification` object.
  const notifBlock = payload.notification || {};
  const dataBlock  = payload.data        || {};

  // Extract the real message ID from whichever field FCM uses
  const msgId = payload.messageId || payload.fcmMessageId ||
                dataBlock.google?.c_id || '';

  // Deduplicate — use the raw message ID (no prefix) so both this handler and
  // onBackgroundMessage reference the same dedup set.
  if (isDuplicate(msgId)) {
    console.log('[SW] push: duplicate suppressed:', msgId);
    return;
  }

  const data  = dataBlock;
  const type  = data.type || 'general';
  const title = notifBlock.title || data.title || 'GoRaahi';
  const opts  = buildNotificationOptions(data, type);

  let body = notifBlock.body || data.body || 'You have a new update.';
  if (opts.data?._extraLines) {
    body = body + opts.data._extraLines;
  }

  console.log('[SW] push: showing notification — type:', type, 'title:', title);

  // CRITICAL: event.waitUntil keeps the SW alive until showNotification resolves.
  // Without this the browser may kill the SW before the OS delivers the notification.
  event.waitUntil(
    self.registration.showNotification(title, { body, ...opts })
      .then(() => console.log('[SW] push: showNotification resolved for type:', type))
      .catch(err => console.error('[SW] push: showNotification error:', err))
  );
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
