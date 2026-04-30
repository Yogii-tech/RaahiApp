/**
 * MapView Component
 * ─────────────────────────────────────────────────────────────
 * • MapLibre GL JS on OSM free tiles
 * • User location pulsing dot
 * • Driver live marker with smooth interpolation
 * • Route polyline (pickup → drop)
 * • Dark/Light theme toggle
 * • Zoom controls + "Locate Me" button
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import maplibregl, { Map, Marker, LngLatLike, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { UserLocation } from '../hooks/useUserLocation';
import type { DriverLocation } from '../services/socket';
import styles from './MapView.module.css';

// ── Free tile providers ──────────────────────────────────────
const TILE_STYLES = {
  light: {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
  },
  dark: {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: [
          'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© Stadia Maps © OpenStreetMap contributors',
        maxzoom: 20,
      },
    },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
  },
};

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  drawRoute: (coords: [number, number][]) => void;
  clearRoute: () => void;
}

interface MapViewProps {
  userLocation: UserLocation | null;
  driverLocation: DriverLocation | null;
  theme: 'dark' | 'light';
  pickupCoords?: [number, number] | null;
  dropCoords?: [number, number] | null;
  routeCoords?: [number, number][] | null;
  /** When true, clicking the map fires onMapClick with {lat, lng} */
  pinModeActive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

function lerp(a: number, b: number, t: number) {
  if (isNaN(a) || isNaN(b) || isNaN(t)) return a;
  return a + (b - a) * t;
}

const isValidLngLat = (lng: any, lat: any) => 
  typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat);

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ userLocation, driverLocation, theme, pickupCoords, dropCoords, routeCoords, pinModeActive, onMapClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<Map | null>(null);
    const userMarkerRef   = useRef<Marker | null>(null);
    const driverMarkerRef = useRef<Marker | null>(null);
    const pickupMarkerRef = useRef<Marker | null>(null);
    const dropMarkerRef   = useRef<Marker | null>(null);
    const animFrameRef    = useRef<number>(0);
    const driverPosRef    = useRef<DriverLocation | null>(null);

    // ── Expose imperative methods ──
    useImperativeHandle(ref, () => ({
      flyTo(lat: number, lng: number, zoom = 15) {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200 });
      },
      drawRoute(coords: [number, number][]) {
        const map = mapRef.current;
        if (!map) return;
        const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords.map(([lat, lng]) => [lng, lat]) },
        };
        if (map.getSource('route')) {
          (map.getSource('route') as GeoJSONSource).setData(geojson);
        }
      },
      clearRoute() {
        const map = mapRef.current;
        if (!map?.getSource('route')) return;
        (map.getSource('route') as GeoJSONSource).setData({
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
      },
    }));

    // ── Initialize map ──
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: TILE_STYLES[theme],
        center: [78.0322, 30.3165], // Default: Dehradun
        zoom: 12,
        maxZoom: 19,
        minZoom: 4,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: false, // We use our own userMarker for consistency
        }),
        'top-right'
      );
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        // ── Route layer ──
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#007AFF', // Vibrant iOS-style blue
            'line-width': 6,
            'line-opacity': 0.9,
          },
        });
        // Glow effect
        map.addLayer({
          id: 'route-line-glow',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#007AFF',
            'line-width': 14,
            'line-opacity': 0.15,
          },
        }, 'route-line');
      });

      mapRef.current = map;
      return () => { map.remove(); mapRef.current = null; };
    }, []);

    // ── Click-to-pin: override location when GPS is inaccurate ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const handler = (e: maplibregl.MapMouseEvent) => {
        if (pinModeActive && onMapClick) {
          onMapClick(e.lngLat.lat, e.lngLat.lng);
        }
      };
      map.on('click', handler);
      // Change cursor to crosshair in pin mode
      map.getCanvas().style.cursor = pinModeActive ? 'crosshair' : '';
      return () => { map.off('click', handler); };
    }, [pinModeActive, onMapClick]);

    // ── Update tile style when theme changes ──
    useEffect(() => {
      mapRef.current?.setStyle(TILE_STYLES[theme]);
    }, [theme]);

    // ── User location pulsing marker ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !userLocation) return;

      const { lat, lng } = userLocation;
      if (!isValidLngLat(lng, lat)) return;

      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = styles.userDot;
        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        map.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
      } else {
        userMarkerRef.current.setLngLat([lng, lat]);
      }
    }, [userLocation]);

    // ── Driver marker with smooth interpolation ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !driverLocation) return;

      if (!driverMarkerRef.current) {
        if (!isValidLngLat(driverLocation.lng, driverLocation.lat)) return;
        const el = document.createElement('div');
        el.className = styles.driverMarker;
        el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>`;
        driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map);
        driverPosRef.current = driverLocation;
      } else {
        // ── 70-80% Animation Logic ──
        // Smoothly interpolate over 5000ms (to create illusion of constant movement)
        const from = driverPosRef.current ?? driverLocation;
        const to   = driverLocation;
        const start = performance.now();
        const DURATION = 5000; // Increased to 5s for smoother, continuous animation

        cancelAnimationFrame(animFrameRef.current);

        function animate(now: number) {
          const t = Math.min((now - start) / DURATION, 1);
          // Ease-out so it slows down near the end if no new data arrives
          const easedT = 1 - Math.pow(1 - t, 3); 
          
          const lat = lerp(from.lat, to.lat, easedT);
          const lng = lerp(from.lng, to.lng, easedT);
          
          // Apply heading rotation if provided
          if (to.heading !== undefined) {
             const markerEl = driverMarkerRef.current?.getElement();
             if (markerEl) markerEl.style.transform = `rotate(${to.heading}deg)`;
          }

          if (isValidLngLat(lng, lat)) {
            driverMarkerRef.current?.setLngLat([lng, lat]);
          }
          
          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          } else {
            driverPosRef.current = to;
          }
        }

        animFrameRef.current = requestAnimationFrame(animate);
      }
    }, [driverLocation]);

    // ── Pickup marker ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      pickupMarkerRef.current?.remove();
      if (!pickupCoords || !isValidLngLat(pickupCoords[1], pickupCoords[0])) return;
      const el = document.createElement('div');
      el.className = styles.pickupMarker;
      el.title = 'Pickup';
      pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pickupCoords[1], pickupCoords[0]])
        .addTo(map);
    }, [pickupCoords]);

    // ── Drop marker ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      dropMarkerRef.current?.remove();
      if (!dropCoords || !isValidLngLat(dropCoords[1], dropCoords[0])) return;
      const el = document.createElement('div');
      el.className = styles.dropMarker;
      el.title = 'Drop';
      dropMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([dropCoords[1], dropCoords[0]])
        .addTo(map);
    }, [dropCoords]);

    // ── Route drawing ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !routeCoords || !map.getSource('route')) return;
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
        },
      };
      (map.getSource('route') as GeoJSONSource).setData(geojson);

      // Fit map to route bounds
      if (routeCoords.length > 1) {
        const lngs = routeCoords.map(c => c[1]);
        const lats = routeCoords.map(c => c[0]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 80, duration: 1000 }
        );
      }
    }, [routeCoords]);

    return <div ref={containerRef} className={`${styles.map} ${pinModeActive ? styles.pinMode : ''}`} />;
  }
);

MapView.displayName = 'MapView';
export default MapView;
