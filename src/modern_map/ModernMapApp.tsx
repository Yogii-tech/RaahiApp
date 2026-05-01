/**
 * App.tsx — Root application component
 * ──────────────────────────────────────────────────────────
 * Layout:
 *   • Full-screen MapLibre map (background)
 *   • Glass sidebar (left) with:
 *       - Pickup / Drop search
 *       - Route info
 *       - Live tracking panel
 *       - Role toggle (driver / passenger) for demo
 *   • Top-right controls (theme, locate-me)
 * ──────────────────────────────────────────────────────────
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import MapView, { MapViewHandle } from './components/MapView';
import './index.css';
import { useUserLocation } from './hooks/useUserLocation';
import { fetchRoute, reverseGeocode, GeoResult } from './services/geocoding';
import type { DriverLocation } from './services/socket';
import styles from './ModernMapApp.module.css';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../apiConfig';

const DEMO_ORDER_ID = 'raahi_order_demo_001';

export default function ModernMapApp({ initialParams }: { initialParams?: any }) {
  const { isDark } = useTheme();
  const { token } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light');

  useEffect(() => {
    setTheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  const [pickupLabel, setPickupLabel] = useState(initialParams?.pickupLabel || '');
  const [dropLabel, setDropLabel] = useState(initialParams?.dropLabel || '');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(initialParams?.dropCoords || null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const lastRouteRequestId = useRef<number>(0);
  const lastUpdateTimestamp = useRef<number>(0);
  const lastGeocodeRef = useRef<{ p: string; d: string }>({ p: '', d: '' });
  
  const { location: gpsLocation, error: gpsError, relocate } = useUserLocation();
  const activeLocation = useMemo(() => 
    pinnedLocation ? { ...pinnedLocation, accuracy: 0, heading: 0 } : gpsLocation,
    [pinnedLocation, gpsLocation]
  );

  // ── Fetch + draw route ──
  const buildRoute = useCallback(async (
    from: [number, number] | null,
    to: [number, number] | null
  ) => {
    if (!from || !to) return;
    const requestId = ++lastRouteRequestId.current;
    setIsRouting(true);
    try {
      const result = await fetchRoute(from, to);
      if (result && requestId === lastRouteRequestId.current) {
        setRouteCoords(result.coordinates);
        setRouteDist(result.distance);
        setRouteEta(result.duration);
      }
    } finally {
      if (requestId === lastRouteRequestId.current) {
        setIsRouting(false);
      }
    }
  }, []);

  // ── Universal Geocoder ──
  const geocodeLabel = useCallback(async (label: string) => {
    if (!label) return null;
    try {
      const query = `${label}, Uttarakhand, India`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'GoRaahiApp/1.0' }
      });
      const data = await res.json();
      return data?.[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number] : null;
    } catch { return null; }
  }, []);

  // ── Sync Active Ride State ──
  useEffect(() => {
    const syncActiveRide = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE}/api/rides/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const bookings = await response.json();
          if (Array.isArray(bookings)) {
            bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const active = bookings.find((b: any) => b.status === 'accepted' || b.status === 'picked_up');
            
            if (active && active.ride) {
              const newId = active.ride.id.toString();
              if (activeBookingId !== newId) {
                // RIDE CHANGED: Reset coordinates to prevent showing stale location
                setActiveBookingId(newId);
                setDropLabel(active.ride.dropoff);
                setDropCoords(null);
                setRouteCoords(null);
                lastUpdateTimestamp.current = 0;
              }
            }
          }
        }
      } catch (e) {
        console.error("Booking sync failed", e);
      }
    };
    syncActiveRide();
    const interval = setInterval(syncActiveRide, 120000);
    return () => clearInterval(interval);
  }, [token, activeBookingId]);

  // ── Aggressive Geocoding Watcher ──
  useEffect(() => {
    const repairCoords = async () => {
      // Pickup repair
      if (pickupLabel && (!pickupCoords || lastGeocodeRef.current.p !== pickupLabel)) {
        lastGeocodeRef.current.p = pickupLabel;
        const coords = await geocodeLabel(pickupLabel);
        if (coords) setPickupCoords(coords);
      }
      // Drop repair: Force geocode if label has changed, even if coords exist
      if (dropLabel && (!dropCoords || lastGeocodeRef.current.d !== dropLabel)) {
        lastGeocodeRef.current.d = dropLabel;
        const coords = await geocodeLabel(dropLabel);
        if (coords) {
          setDropCoords(coords);
          // Small jump to new destination context
          if (!activeBookingId) mapRef.current?.flyTo(coords[0], coords[1], 12);
        }
      }
    };
    repairCoords();
  }, [pickupLabel, dropLabel, pickupCoords, dropCoords, geocodeLabel, activeBookingId]);

  // ── GPS-Authoritative Live Tracking Logic ──
  useEffect(() => {
    if (!activeBookingId || !activeLocation) return;
    
    const now = Date.now();
    const currentPos: [number, number] = [activeLocation.lat, activeLocation.lng];
    
    // Always keep pickupCoords synced with GPS in active mode
    if (!pickupCoords || Math.abs(currentPos[0] - pickupCoords[0]) > 0.0001) {
      setPickupCoords(currentPos);
    }

    // Force route update
    if (dropCoords && (now - lastUpdateTimestamp.current > 10000 || lastUpdateTimestamp.current === 0)) {
      lastUpdateTimestamp.current = now;
      buildRoute(currentPos, dropCoords);
    }
  }, [activeBookingId, activeLocation, dropCoords, pickupCoords, buildRoute]);

  // ── Standard Mode Route Initializer ──
  useEffect(() => {
    if (!activeBookingId && pickupCoords && dropCoords && !routeCoords) {
      buildRoute(pickupCoords, dropCoords);
    }
  }, [activeBookingId, pickupCoords, dropCoords, routeCoords, buildRoute]);

  // ── WebSocket Integration ──
  useEffect(() => {
    if (!activeBookingId) return;
    const wsUrl = `ws://localhost:8080/api/tracking/ws/${activeBookingId}`;
    let socket = new WebSocket(wsUrl);
    let reconnectTimeout: NodeJS.Timeout;

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.latitude && data.longitude) {
          setDriverLocation({ lat: data.latitude, lng: data.longitude });
        }
      } catch {}
    };
    socket.onclose = () => { reconnectTimeout = setTimeout(() => { socket = new WebSocket(wsUrl); }, 5000); };
    return () => { socket.close(); clearTimeout(reconnectTimeout); };
  }, [activeBookingId]);

  // ── Driver Visibility Fallback ──
  useEffect(() => {
    if (activeBookingId && !driverLocation && pickupCoords) {
      const timer = setTimeout(() => {
        if (!driverLocation) {
          setDriverLocation({ lat: pickupCoords[0] + 0.0005, lng: pickupCoords[1] + 0.0005 });
        }
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [activeBookingId, driverLocation, pickupCoords]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (activeBookingId) return;
    setPinnedLocation({ lat, lng });
    setPinMode(false);
    mapRef.current?.flyTo(lat, lng, 16);
    const label = await reverseGeocode(lat, lng);
    setPickupLabel(label);
    setPickupCoords([lat, lng]);
    buildRoute([lat, lng], dropCoords);
  }, [activeBookingId, dropCoords, buildRoute]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!activeLocation) { relocate(); return; }
    const { lat, lng } = activeLocation;
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 16);
    buildRoute([lat, lng], dropCoords);
  }, [activeLocation, dropCoords, relocate, buildRoute]);

  return (
    <div className={`${styles.app} ${styles[theme]}`}>
      <div className={styles.mapLayer}>
        <MapView
          ref={mapRef}
          userLocation={activeLocation}
          driverLocation={driverLocation}
          theme={theme}
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          routeCoords={routeCoords}
          pinModeActive={pinMode}
          activeBookingId={activeBookingId}
          onMapClick={handleMapClick}
        />
      </div>

      {pinMode && (
        <div className={styles.pinOverlay}>
          <div className={styles.pinOverlayCard}>
            <span className={styles.pinOverlayIcon}>📍</span>
            <p>Click anywhere on the map<br />to set your exact location</p>
            <button className={styles.pinCancelBtn} onClick={() => setPinMode(false)}>Cancel</button>
          </div>
        </div>
      )}

      {activeLocation && (
        <div className={styles.accuracyPill}>
          <span className={styles.accuracyLabel}>GPS ACCURACY</span>
          <span className={styles.accuracyValue} style={{
            color: activeLocation.accuracy <= 50 ? '#22c55e' : activeLocation.accuracy <= 200 ? '#f59e0b' : '#ef4444'
          }}>
            ±{Math.round(activeLocation.accuracy)}m
          </span>
        </div>
      )}
    </div>
  );
}
