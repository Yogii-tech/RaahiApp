// Central configuration for API endpoints
// Auto-detects environment: local dev uses localhost:8080, production uses Cloud Run URL

<<<<<<< HEAD
import { Platform } from 'react-native';

const PROD_API = 'https://raahi-api-137804375265.asia-south2.run.app';
const LOCAL_API = 'http://localhost:8080';

const getWebApiBase = (): string => {
     if (typeof window === 'undefined') return LOCAL_API;
     const { hostname } = window.location;
     // Local development
     if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return LOCAL_API;
     }
     // Production domain (Firebase Hosting / custom domain)
     if (hostname === 'goraahi.in' || hostname === 'www.goraahi.in' || hostname.endsWith('.web.app')) {
          return PROD_API;
     }
     // LAN / network IP during device testing
     return `http://${hostname}:8080`;
};

export const API_BASE = Platform.OS === 'web'
     ? getWebApiBase()
     : PROD_API;
=======
export const API_BASE = 'http://192.168.0.107:8080';
>>>>>>> de71b24af7736aa7ca66f509eac939de70e0a0dc

// Helper for building API URLs
export const getApiUrl = (endpoint: string) => `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

