import { Platform } from 'react-native';

export const API_BASE = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' ? `http://${window.location.hostname}:8080` : 'http://192.168.43.41:8080')
  : 'http://192.168.43.41:8080';
