// Central configuration for API endpoints
// Change this URL when deploying to a new environment

export const API_BASE = 'https://raahi-api-137804375265.asia-south2.run.app';

// Helper for building API URLs
export const getApiUrl = (endpoint: string) => `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
