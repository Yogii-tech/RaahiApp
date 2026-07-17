// Re-export from the canonical apiConfig to avoid duplication.
// Do not add a separate hardcoded URL here — update src/apiConfig.ts instead.
export { API_BASE } from '../apiConfig';

// Helper for building API URLs
export const getApiUrl = (endpoint: string) => `${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
