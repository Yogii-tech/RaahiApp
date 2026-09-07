// public/firebase-messaging-sw.js

// Import and configure the Firebase SDK
// These scripts are made available when the app is served or bundled
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// IMPORTANT: You must replace this with your actual config from Firebase Console
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

// Track whether onBackgroundMessage handled the push so the fallback doesn't double-fire.
let bgHandled = false;

// Background message handler — Firebase delegates display responsibility to this callback.
// When onBackgroundMessage is registered, Firebase does NOT auto-show the notification;
// we MUST call showNotification ourselves.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  bgHandled = true;

  const title = payload.notification?.title || payload.data?.title || 'GoRaahi';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.type || 'general',          // collapse duplicates of same type
    renotify: true,                                 // vibrate even if tag matches
    requireInteraction: true,                       // keep on lock screen until dismissed
    data: payload.data || {},
    vibrate: [200, 100, 200],                       // vibrate pattern for Android
    actions: []
  };

  self.registration.showNotification(title, options);
});

// Ultimate fallback: raw push event listener.
// If Firebase's onBackgroundMessage somehow doesn't fire (e.g. data-only message,
// or FCM compat SDK glitch), this catches it and shows the notification anyway.
self.addEventListener('push', (event) => {
  // Give onBackgroundMessage a tick to run first
  const showFallback = () => {
    if (bgHandled) {
      bgHandled = false; // reset for next push
      return;
    }

    let payload = {};
    try {
      payload = event.data?.json() || {};
    } catch (e) {
      payload = { data: { body: event.data?.text() || '' } };
    }

    // Only show if Firebase didn't already handle it
    const title = payload.notification?.title || payload.data?.title || 'GoRaahi';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'You have a new update.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'fallback',
      renotify: true,
      requireInteraction: true,
      data: payload.data || {},
      vibrate: [200, 100, 200]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  };

  // Small delay so onBackgroundMessage gets a chance to mark bgHandled = true
  event.waitUntil(
    new Promise(resolve => setTimeout(resolve, 100)).then(showFallback)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  console.log('[SW] Notification click data:', event.notification.data);

  // Firebase Web SDK often nests the payload under FCM_MSG when it auto-displays notifications
  const payloadData = event.notification.data?.FCM_MSG?.data || event.notification.data || {};
  
  // Construct the deep link URL if it's a chat notification
  const type = payloadData.type;
  const relatedId = payloadData.relatedId;
  
  let path = payloadData.url || '/';
  if (type === 'chat' && relatedId) {
    path = `/?chat=${relatedId}`;
  }

  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the same origin
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          // Send the payload to the open app so it can navigate internally
          return client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: payloadData
          });
        }
      }
      // If no window is open, open a new one with the deep link query parameter
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
