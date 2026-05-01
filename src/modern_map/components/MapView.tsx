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
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
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
  pinModeActive?: boolean;
  activeBookingId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
}

function lerp(a: number, b: number, t: number) {
  if (isNaN(a) || isNaN(b) || isNaN(t)) return a;
  return a + (b - a) * t;
}

const isValidLngLat = (lng: any, lat: any) => 
  typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat);

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  ({ userLocation, driverLocation, theme, pickupCoords, dropCoords, routeCoords, pinModeActive, 
      activeBookingId,
      onMapClick 
    }, 
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<Map | null>(null);
    const userMarkerRef   = useRef<Marker | null>(null);
    const driverMarkerRef = useRef<Marker | null>(null);
    const pickupMarkerRef = useRef<Marker | null>(null);
    const dropMarkerRef   = useRef<Marker | null>(null);
    const animFrameRef    = useRef<number>(0);
    const driverPosRef    = useRef<DriverLocation | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // ── Expose imperative methods ──
    useImperativeHandle(ref, () => ({
      flyTo(lat: number, lng: number, zoom = 15) {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200 });
      },
      drawRoute(_coords: [number, number][]) {
        // Now handled reactively by useEffect[routeCoords]
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
        setIsMapLoaded(true);
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
      const map = mapRef.current;
      if (!map) return;
      
      const handleStyleLoad = () => {
        try {
          if (!map.getSource('route')) {
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
                'line-color': '#007AFF',
                'line-width': 6,
                'line-opacity': 0.9,
              },
            });
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
          
          // Re-draw current route if we have coordinates
          if (routeCoords && routeCoords.length > 1) {
            const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
              },
            };
            const source = map.getSource('route') as GeoJSONSource;
            if (source) source.setData(geojson);
          }
        } catch (err) {
          console.warn("Map style transition: route layer handled safely", err);
        }
      };

      map.once('idle', handleStyleLoad);
      map.setStyle(TILE_STYLES[theme], { diff: false });
    }, [theme]);

    // ── Update route line when coords change ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !map.getSource('route')) return;
      
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: (routeCoords && routeCoords.length > 1) 
            ? routeCoords.map(([lat, lng]) => [lng, lat]) 
            : [],
        },
      };
      
      try {
        (map.getSource('route') as maplibregl.GeoJSONSource).setData(geojson);
      } catch (err) {
        console.warn("Route update handled safely", err);
      }
    }, [routeCoords]);

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
        el.style.zIndex = '9999'; // FORCE ABOVE ALL
        el.innerHTML = `
          <div class="${styles.carBase}" style="transform: scale(1.4);"></div>
          <svg viewBox="0 0 40 65" class="${styles.carSvg}" style="width: 45px; height: 70px;">
            <path d="M10,10 Q20,0 30,10 L35,48 Q20,58 5,48 Z" fill="#ffffff" stroke="#111" stroke-width="2" />
            <path d="M13,15 Q20,10 27,15 L26,22 Q20,24 14,22 Z" fill="#111" />
            <path d="M14,24 Q20,20 26,24 L25,38 Q20,42 15,38 Z" fill="#111" />
            <path d="M8,18 L5,20 L6,22 Z" fill="#eee" stroke="#111" stroke-width="0.5" />
            <path d="M32,18 L35,20 L34,22 Z" fill="#eee" stroke="#111" stroke-width="0.5" />
            <rect x="7" y="46" width="6" height="3" fill="#ff2222" rx="1.5" />
            <rect x="27" y="46" width="6" height="3" fill="#ff2222" rx="1.5" />
          </svg>
        `;
        // Ensure car is ALWAYS on top of everything else
        el.style.zIndex = '9999';
        driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map);
        driverPosRef.current = driverLocation;
      } else {
        // ── 70-80% Animation Logic ──
        // Smoothly interpolate over 5000ms (to create illusion of constant movement)
        const from = driverPosRef.current ?? driverLocation;
        const to = driverLocation;
        const start = performance.now();
        const DURATION = 5000; // Increased to 5s for smoother, continuous animation

        cancelAnimationFrame(animFrameRef.current);

        // If no movement, just jump there
        if (from.lat === to.lat && from.lng === to.lng) {
          driverMarkerRef.current?.setLngLat([to.lng + 0.00005, to.lat + 0.00005]);
          return;
        }

        function animate(now: number) {
          const t = Math.min((now - start) / DURATION, 1);
          const easedT = 1 - Math.pow(1 - t, 3); 
          
          const lat = lerp(from.lat, to.lat, easedT);
          const lng = lerp(from.lng, to.lng, easedT);
          
          if (isValidLngLat(lng, lat)) {
            driverMarkerRef.current?.setLngLat([lng + 0.00005, lat + 0.00005]);
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
      el.innerHTML = '<div style="width: 12px; height: 12px; background: #22c55e; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>';
      el.title = 'Pickup Location';
      pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
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
      if (!map || !isMapLoaded || !map.getSource('route')) return;
      
      if (!routeCoords || routeCoords.length < 2) {
        (map.getSource('route') as GeoJSONSource).setData({
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
        return;
      }

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
