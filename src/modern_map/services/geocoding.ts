/**
 * Geocoding & routing service
 * Place search is routed through our authenticated backend (/api/location/search)
 * to avoid CORS + attach User-Agent header.
 */
import { apiRequest } from '../../utils/api';

export interface GeoResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

// Search by text query via authenticated backend proxy
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  if (!query.trim() || query.length < 3) return [];

  try {
    const res = await apiRequest(
      `/api/location/search?q=${encodeURIComponent(query.trim())}`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('Geocoding search error:', error);
    }
    return [];
  }
}

// Reverse geocode: lat/lng → address string (fails gracefully to coordinates)
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
      { signal }
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return data?.display_name ?? fallback;
  } catch {
    return fallback;
  }
}

// Fetch route geometry between two points via OSRM public API
export async function fetchRoute(
  from: [number, number], // [lat, lng]
  to: [number, number],
  signal?: AbortSignal
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;
    
    const route = data.routes[0];
    // OSRM GeoJSON coords are [lng, lat], convert to [lat, lng] for our components
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return { 
      distance: route.distance, 
      duration: route.duration, 
      coordinates: coords 
    };
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('OSRM Fetch Error:', error);
    }
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
