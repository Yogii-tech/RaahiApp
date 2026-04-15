import { Platform } from 'react-native';

export const API_BASE = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' ? `http://${window.location.hostname}:8080` : 'http://10.94.55.156:8080')
  : 'http://10.94.55.156:8080';
