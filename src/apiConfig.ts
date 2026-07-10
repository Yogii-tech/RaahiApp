import { Platform } from 'react-native';

// In native non-dev, point to production. Web uses hostname for dev, otherwise prod.
const PROD_URL = 'https://raahi-api-137804375265.asia-south2.run.app';
// Fallback to localhost for local development (supports Android via `adb reverse tcp:8080 tcp:8080` and iOS out of box)
const DEV_IP = 'http://localhost:8080';

export const API_BASE = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:8080' : PROD_URL)
  : (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_IP : PROD_URL);

