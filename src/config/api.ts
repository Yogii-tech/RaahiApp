// Central configuration for API endpoints
// Change this URL when deploying to a new environment

export const API_BASE = 'http://192.168.0.107:8080';

// Helper for building API URLs
export const getApiUrl = (endpoint: string) => `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
