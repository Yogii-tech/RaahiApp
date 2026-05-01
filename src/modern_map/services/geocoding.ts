/**
 * Nominatim geocoding service
 * Routed through our backend to avoid CORS + to add User-Agent header
 */

export interface GeoResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

// Search by text query
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!query.trim() || query.length < 3) return [];

  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

// Reverse geocode: lat/lng → address string
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Client-side in-memory cache to avoid redundant OSRM calls
interface RouteResponse {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}
const routeCache = new Map<string, { data: RouteResponse; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes cache

// Fetch route geometry between two points via OSRM public API
export async function fetchRoute(
  from: [number, number], // [lat, lng]
  to: [number, number]
): Promise<RouteResponse | null> {
  const precision = 4; // Approx 10m precision for caching
  const cacheKey = `${from[0].toFixed(precision)},${from[1].toFixed(precision)}-${to[0].toFixed(precision)},${to[1].toFixed(precision)}`;
  
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;
    
    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    
    const result = { 
      distance: route.distance, 
      duration: route.duration, 
      coordinates: coords 
    };

    // Save to cache
    routeCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    // Clear old cache entries if too many (simple LRU-ish cleanup)
    if (routeCache.size > 50) {
      const oldestKey = routeCache.keys().next().value;
      if (oldestKey) routeCache.delete(oldestKey);
    }

    return result;
  } catch (error) {
    console.error('OSRM Fetch Error:', error);
    return null;
  }
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
