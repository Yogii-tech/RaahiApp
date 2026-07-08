import { Platform } from 'react-native';

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
