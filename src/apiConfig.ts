import { Platform } from 'react-native';

// Production Cloud Run URL — used for all non-local environments
const PROD_URL = 'https://raahi-api-137804375265.asia-south2.run.app';

// Only used during local development on native (Android/iOS emulator or physical device)
const LOCAL_DEV_URL = Platform.OS === 'web' ? '' : 'http://192.168.1.9:8080';

const isLocalWeb = Platform.OS === 'web' && typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.endsWith('.loca.lt'));

export const API_BASE = isLocalWeb ? LOCAL_DEV_URL : (typeof __DEV__ !== 'undefined' && __DEV__ ? LOCAL_DEV_URL : PROD_URL);
