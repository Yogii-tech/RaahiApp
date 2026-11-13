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
import * as maplibregl from 'maplibre-gl';
import { Map, Marker, LngLatLike, GeoJSONSource } from 'maplibre-gl';
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
        // Correct Carto Dark Matter URL with subdomains (a/b/c/d)
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap contributors',
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
    const mapRef = useRef<Map | null>(null);
    const isMapLoadedRef = useRef(false);
    const isFirstThemeRenderRef = useRef(true);
    const routeCoordsRef = useRef<[number, number][] | null | undefined>(routeCoords);
    const userMarkerRef = useRef<Marker | null>(null);
    const driverMarkerRef = useRef<Marker | null>(null);
    const driverIconRef = useRef<HTMLDivElement | null>(null);
    const pickupMarkerRef = useRef<Marker | null>(null);
    const dropMarkerRef = useRef<Marker | null>(null);
    const animFrameRef = useRef<number>(0);
    const driverPosRef = useRef<DriverLocation | null>(null);
    const driverCurrentPosRef = useRef<DriverLocation | null>(null);

    const ensureRouteSourceAndLayers = useCallback((map: Map) => {
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
      }
      if (!map.getLayer('route-line')) {
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
      }
      if (!map.getLayer('route-line-glow')) {
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
      }
    }, []);

    const applyRouteToMap = useCallback((map: Map, coords: [number, number][] | null | undefined, shouldFitBounds: boolean) => {
      if (!isMapLoadedRef.current || !map.getSource('route')) return;
      const validCoords = coords && coords.length > 0 ? coords : [];
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: validCoords.map(([lat, lng]) => [lng, lat]),
        },
      };
      (map.getSource('route') as GeoJSONSource).setData(geojson);

      if (shouldFitBounds && validCoords.length > 1) {
        const lngs = validCoords.map(c => c[1]);
        const lats = validCoords.map(c => c[0]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 80, duration: 1000 }
        );
      }
    }, []);

    // ── Expose imperative methods ──
    useImperativeHandle(ref, () => ({
      flyTo(lat: number, lng: number, zoom = 15) {
        if (!isValidLngLat(lng, lat)) return;
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200 });
      },
      drawRoute(coords: [number, number][]) {
        routeCoordsRef.current = coords;
        const map = mapRef.current;
        if (!map) return;
        applyRouteToMap(map, coords, false);
      },
      clearRoute() {
        routeCoordsRef.current = null;
        const map = mapRef.current;
        if (!map) return;
        applyRouteToMap(map, null, false);
      },
    }), [applyRouteToMap]);

    // ── Initialize map ──
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      isMapLoadedRef.current = false;

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
        if (mapRef.current !== map) return;
        isMapLoadedRef.current = true;
        ensureRouteSourceAndLayers(map);
        if (routeCoordsRef.current && routeCoordsRef.current.length > 0) {
          applyRouteToMap(map, routeCoordsRef.current, true);
        }
      });

      mapRef.current = map;

      // ── Handle resizing to fix "bottom land" issues ──
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        cancelAnimationFrame(animFrameRef.current);
        resizeObserver.disconnect();
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        driverMarkerRef.current?.remove();
        driverMarkerRef.current = null;
        driverIconRef.current = null;
        pickupMarkerRef.current?.remove();
        pickupMarkerRef.current = null;
        dropMarkerRef.current?.remove();
        dropMarkerRef.current = null;
        isMapLoadedRef.current = false;
        map.remove();
        mapRef.current = null;
      };
    }, [applyRouteToMap, ensureRouteSourceAndLayers]);

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
      return () => {
        map.off('click', handler);
        if (mapRef.current === map) {
          map.getCanvas().style.cursor = '';
        }
      };
    }, [pinModeActive, onMapClick]);

    // ── Update tile style when theme changes ──
    // After setStyle(), all custom sources/layers are wiped by MapLibre.
    // We re-add the route source & layers once the new style has fully loaded.
    useEffect(() => {
      if (isFirstThemeRenderRef.current) {
        isFirstThemeRenderRef.current = false;
        return;
      }

      const map = mapRef.current;
      if (!map) return;

      isMapLoadedRef.current = false;
      map.setStyle(TILE_STYLES[theme]);

      let restored = false;
      const restoreRouteLayer = () => {
        if (restored || mapRef.current !== map) return;
        if (!map.isStyleLoaded()) return;
        restored = true;
        isMapLoadedRef.current = true;
        ensureRouteSourceAndLayers(map);
        if (routeCoordsRef.current && routeCoordsRef.current.length > 0) {
          applyRouteToMap(map, routeCoordsRef.current, false);
        }
        map.off('styledata', restoreRouteLayer);
        map.off('style.load', restoreRouteLayer);
      };

      map.on('styledata', restoreRouteLayer);
      map.on('style.load', restoreRouteLayer);
      return () => {
        map.off('styledata', restoreRouteLayer);
        map.off('style.load', restoreRouteLayer);
      };
    }, [theme, applyRouteToMap, ensureRouteSourceAndLayers]);

    // ── User location pulsing marker ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      if (!userLocation || !isValidLngLat(userLocation.lng, userLocation.lat)) {
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        return;
      }

      const { lat, lng } = userLocation;

      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = styles.userDot;
        // Inline fallbacks to ensure visibility
        el.style.width = '18px';
        el.style.height = '18px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#007AFF';
        el.style.border = '2px solid white';

        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([lng, lat]);
      }
    }, [userLocation]);

    // ── Driver marker with smooth interpolation ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      if (!driverLocation || !isValidLngLat(driverLocation.lng, driverLocation.lat)) {
        cancelAnimationFrame(animFrameRef.current);
        driverMarkerRef.current?.remove();
        driverMarkerRef.current = null;
        driverIconRef.current = null;
        driverPosRef.current = null;
        driverCurrentPosRef.current = null;
        return;
      }

      if (!driverMarkerRef.current) {
        const rootEl = document.createElement('div');
        const iconEl = document.createElement('div');
        iconEl.className = styles.driverMarker;
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>`;
        if (driverLocation.heading !== undefined) {
          iconEl.style.transform = `rotate(${driverLocation.heading}deg)`;
        }
        rootEl.appendChild(iconEl);
        driverIconRef.current = iconEl;
        driverMarkerRef.current = new maplibregl.Marker({ element: rootEl, anchor: 'center' })
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map);
        driverPosRef.current = driverLocation;
        driverCurrentPosRef.current = driverLocation;
      } else {
        // ── 70-80% Animation Logic ──
        // Smoothly interpolate over 5000ms from current on-screen position
        const from = driverCurrentPosRef.current ?? driverPosRef.current ?? driverLocation;
        const to = driverLocation;
        const start = performance.now();
        const DURATION = 5000; // Increased to 5s for smoother, continuous animation

        cancelAnimationFrame(animFrameRef.current);

        function animate(now: number) {
          const t = Math.min((now - start) / DURATION, 1);
          // Ease-out so it slows down near the end if no new data arrives
          const easedT = 1 - Math.pow(1 - t, 3);

          const lat = lerp(from.lat, to.lat, easedT);
          const lng = lerp(from.lng, to.lng, easedT);

          // Apply heading rotation on inner element so MapLibre's translate(...) on root is preserved
          if (to.heading !== undefined && driverIconRef.current) {
            driverIconRef.current.style.transform = `rotate(${to.heading}deg)`;
          }

          if (isValidLngLat(lng, lat)) {
            driverCurrentPosRef.current = { ...to, lat, lng };
            driverMarkerRef.current?.setLngLat([lng, lat]);
          }

          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          } else {
            driverPosRef.current = to;
            driverCurrentPosRef.current = to;
          }
        }

        animFrameRef.current = requestAnimationFrame(animate);
      }

      return () => {
        cancelAnimationFrame(animFrameRef.current);
      };
    }, [driverLocation]);

    // ── Pickup marker ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      pickupMarkerRef.current?.remove();
      pickupMarkerRef.current = null;
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
      dropMarkerRef.current = null;
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
      routeCoordsRef.current = routeCoords;
      const map = mapRef.current;
      if (!map || !isMapLoadedRef.current || !map.getSource('route')) return;
      applyRouteToMap(map, routeCoords ?? null, true);
    }, [routeCoords, applyRouteToMap]);

    return <div ref={containerRef} className={`${styles.map} ${pinModeActive ? styles.pinMode : ''}`} />;
  }
);

MapView.displayName = 'MapView';
export default MapView;
