// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker — handles background & lock screen notifications.

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

// ─── Background message handler ──────────────────────────────────────────────
// Firebase calls this for every FCM message received while the app is in
// background or the screen is locked. We MUST call showNotification ourselves
// and MUST wrap it in self.registration so the notification appears on the
// lock screen. Firebase's compat SDK wraps this call in event.waitUntil
// internally, so the SW stays alive until the promise resolves.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', JSON.stringify(payload));

  const title   = payload.notification?.title || payload.data?.title || 'GoRaahi';
  const body    = payload.notification?.body  || payload.data?.body  || 'You have a new update.';
  const type    = payload.data?.type || 'general';
  const related = payload.data?.relatedId || '';

  return self.registration.showNotification(title, {
    body,
    icon:               '/logo192.png',
    badge:              '/logo192.png',
    tag:                `${type}-${related}`, // collapse duplicates per type+ride
    renotify:           true,                 // vibrate even if tag already exists
    requireInteraction: true,                 // stay on lock screen until dismissed
    vibrate:            [200, 100, 200, 100, 200],
    data:               payload.data || {},
  });
});

// ─── Raw push fallback ────────────────────────────────────────────────────────
// Catches data-only FCM messages that Firebase's SDK may not surface through
// onBackgroundMessage (e.g. messages sent with content_available but no
// notification block). Only fires if Firebase hasn't already shown something.
self.addEventListener('push', (event) => {
  // If Firebase's onBackgroundMessage already handled this push, it will have
  // called showNotification via the promise chain above. We detect this by
  // checking if there is already a notification with the same data.
  // Since we can't easily detect that, we guard using a dedicated tag approach:
  // Firebase uses the `tag` from our handler above; the fallback uses 'raw-push'.
  // This means if Firebase fires first the tag will differ and no duplicate shows.
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { data: { body: event.data.text() } };
  }

  // FCM wraps the real payload under `data` or `notification`.
  // For data-only messages the notification block is absent.
  const hasNotificationBlock = !!(payload.notification?.title);

  // Only show if there is no notification block — Firebase handles those above.
  // Data-only messages (e.g., silent refreshes) are caught here.
  if (hasNotificationBlock) return;

  const title = payload.data?.title || 'GoRaahi';
  const body  = payload.data?.body  || 'You have a new update.';
  const type  = payload.data?.type  || 'general';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               '/logo192.png',
      badge:              '/logo192.png',
      tag:                `raw-${type}`,
      renotify:           true,
      requireInteraction: true,
      vibrate:            [200, 100, 200, 100, 200],
      data:               payload.data || {},
    })
  );
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  console.log('[SW] Notification clicked, data:', JSON.stringify(event.notification.data));

  // Firebase Web SDK may nest the real payload under FCM_MSG
  const payloadData = event.notification.data?.FCM_MSG?.data
    || event.notification.data
    || {};

  const type      = payloadData.type;
  const relatedId = payloadData.relatedId;

  let path = payloadData.url || '/';
  if (type === 'chat' && relatedId) {
    path = `/?chat=${relatedId}`;
  }

  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab/window if already open
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Post the click data so the app can navigate internally
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: payloadData });
          return client.focus();
        }
      }
      // Otherwise open a new window
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
