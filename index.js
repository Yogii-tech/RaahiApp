/**
 * @format
 */

import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// ─── Native Android: Background / killed-app FCM handler ──────────────────────
// This MUST be registered before AppRegistry.registerComponent so that the
// @react-native-firebase/messaging headless task can wake the app and show a
// system (lock-screen) notification even when the app is fully terminated.
//
// Rules:
//   • Only run on native (Android). The web/iOS paths have their own mechanisms.
//   • The handler must be synchronous or return a Promise.
//   • Do NOT import React or any component — this runs in a headless JS context.
//   • FCM will automatically show the OS notification from the `notification`
//     block in the message. For data-only messages, call
//     `displayLocalNotification` via a native module, or rely on the
//     notification block being present in the server payload.
if (Platform.OS === 'android') {
  try {
    // Dynamic require to prevent the web webpack bundle from trying to
    // resolve @react-native-firebase/messaging (which is native-only).
    const messaging = require('@react-native-firebase/messaging').default;

    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      // FCM automatically displays the OS notification from the `notification`
      // block — no manual showNotification call is needed here.
      // Log for debugging; remove or guard with __DEV__ in production.
      console.log('[FCM BG] Background message received:', remoteMessage?.messageId);
    });
  } catch (e) {
    // Silently ignore — this can happen in web/test environments where the
    // native module is not available.
    console.warn('[FCM BG] Could not register background handler:', e);
  }
}

AppRegistry.registerComponent(appName, () => App);
