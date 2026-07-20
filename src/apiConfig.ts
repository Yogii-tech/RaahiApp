import { Platform } from 'react-native';

// Production Cloud Run URL — used for all non-local environments
const PROD_URL = 'https://api.goraahi.in';

// Only used during local development on native (Android/iOS emulator or physical device)
// Set this to your local machine's LAN IP when running the backend locally
const LOCAL_DEV_URL = 'http://localhost:8080';

export const API_BASE = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? LOCAL_DEV_URL : PROD_URL)
  : (typeof __DEV__ !== 'undefined' && __DEV__ ? LOCAL_DEV_URL : PROD_URL);
