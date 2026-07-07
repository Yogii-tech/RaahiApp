import { Platform } from 'react-native';

// In native non-dev, point to production. Web uses hostname for dev, otherwise prod.
const PROD_URL = 'https://api.goraahi.in';
const DEV_IP = 'http://192.168.0.107:8080';

export const API_BASE = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8080' : PROD_URL)
  : (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_IP : PROD_URL);
