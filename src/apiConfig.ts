import { Platform } from 'react-native';

<<<<<<< HEAD
const getWebApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://10.216.69.1:8080';
  const { hostname } = window.location;
  // Local development — always use local backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8080';
  }
  // Production domain — use the real production API
  if (hostname === 'goraahi.in' || hostname === 'www.goraahi.in' || hostname.endsWith('.web.app')) {
    return 'https://api.goraahi.in';
  }
  // Any other host (e.g. LAN IP during testing) — mirror the host on port 8080
  return `http://${hostname}:8080`;
};

export const API_BASE = Platform.OS === 'web'
  ? getWebApiBase()
  : 'http://10.216.69.1:8080';
=======
// In native non-dev, point to production. Web uses hostname for dev, otherwise prod.
const PROD_URL = 'https://api.goraahi.in';
const DEV_IP = 'http://192.168.0.107:8080';

export const API_BASE = Platform.OS === 'web'
  ? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8080' : PROD_URL)
  : (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_IP : PROD_URL);
>>>>>>> de71b24af7736aa7ca66f509eac939de70e0a0dc
