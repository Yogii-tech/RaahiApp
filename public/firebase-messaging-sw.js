// public/firebase-messaging-sw.js

// Import and configure the Firebase SDK
// These scripts are made available when the app is served or bundled
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

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

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Note: Since the backend sends a "notification" payload, Firebase's built-in SDK
  // will automatically display the notification. We do not need to call 
  // self.registration.showNotification here, as it would cause duplicate notifications.
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
