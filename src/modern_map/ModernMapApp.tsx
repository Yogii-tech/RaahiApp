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
import { useState, useRef, useCallback, useEffect } from 'react';
import MapView, { MapViewHandle } from './components/MapView';
import LocationSearch from './components/LocationSearch';
import LiveTrackingPanel from './components/LiveTrackingPanel';
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

  // Sync theme with global theme
  useEffect(() => {
    setTheme(isDark ? 'dark' : 'light');
  }, [isDark]);
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [pickupLabel, setPickupLabel] = useState(initialParams?.pickupLabel || '');
  const [dropLabel, setDropLabel] = useState(initialParams?.dropLabel || '');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(initialParams?.dropCoords || null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pinMode, setPinMode] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const lastRouteUpdateRef = useRef<number>(0);
  const { location: gpsLocation, error: gpsError, relocate } = useUserLocation();

  // ── Fetch + draw route ──
  const buildRoute = useCallback(async (
    from: [number, number] | null,
    to: [number, number] | null
  ) => {
    if (!from || !to) return;
    setIsRouting(true);
    try {
      const result = await fetchRoute(from, to);
      if (result) {
        setRouteCoords(result.coordinates);
        setRouteDist(result.distance);
        setRouteEta(result.duration);
        mapRef.current?.drawRoute(result.coordinates);
      }
    } finally {
      setIsRouting(false);
    }
  }, []);

  // ── Auto-initialize route if params provided ──
  useEffect(() => {
    const initFromParams = async () => {
      const cleanParam = (val: any) => (val === 'null' || val === null || val === undefined) ? null : val;

      let pLabel = cleanParam(initialParams?.pickupLabel) || '';
      let dLabel = cleanParam(initialParams?.dropLabel) || '';
      let pCoords = cleanParam(initialParams?.pickupCoords);
      let dCoords = cleanParam(initialParams?.dropCoords);
      const rideId = cleanParam(initialParams?.rideId);

      // Proactive Sync: Fetch bookings to see if we should override stale params
      try {
        const response = await fetch(`${API_BASE}/api/rides/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          let bookings = await response.json();
          if (Array.isArray(bookings)) {
            // Sort by createdAt descending to get the LATEST active booking
            bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const active = bookings.find((b: any) => b.status === 'accepted' || b.status === 'picked_up');
            
            // Respect historical rides: Only auto-switch to active ride if user didn't specify one
            if (!rideId && active && active.ride) {
              setActiveBookingId(active.ride.id);
              pLabel = active.ride.pickup;
              dLabel = active.ride.dropoff;
              pCoords = (active.ride.pickupLat && active.ride.pickupLng) ? [active.ride.pickupLat, active.ride.pickupLng] : null;
              dCoords = (active.ride.dropoffLat && active.ride.dropoffLng) ? [active.ride.dropoffLat, active.ride.dropoffLng] : null;
            } else if (active && active.ride?.id === rideId) {
              // Current view matches active ride -> enable live tracking
              setActiveBookingId(active.ride.id);
            }
          }
        }
      } catch (e) {
        console.error("Proactive booking sync failed", e);
      }

      // Determine if a full reset is needed (ride changed)
      // We use a functional update comparison internally where possible, 
      // but here we check against our calculated pLabel/dLabel from params/sync.
      const isInitialLoad = !pickupLabel && !dropLabel;
      const rideChanged = pLabel !== pickupLabel || dLabel !== dropLabel;

      if (rideChanged || isInitialLoad) {
        setPickupLabel(pLabel);
        setDropLabel(dLabel);
        setPickupCoords(null);
        setDropCoords(null);
        setRouteCoords(null);
        setRouteDist(null);
        setRouteEta(null);
        mapRef.current?.clearRoute();
      }

      if (typeof pCoords === 'string' && pCoords.startsWith('[')) {
        try { pCoords = JSON.parse(pCoords); } catch (e) { pCoords = null; }
      }
      if (typeof dCoords === 'string' && dCoords.startsWith('[')) {
        try { dCoords = JSON.parse(dCoords); } catch (e) { dCoords = null; }
      }

      const fetchWithUA = (url: string) => fetch(url, { headers: { 'User-Agent': 'GoRaahiApp/1.0' } });

      // ── Geocode if coordinates are missing ──
      if (!pCoords && pLabel) {
        try {
          const query = pLabel.toLowerCase() === 'nanital' ? 'Nainital, Uttarakhand, India' : `${pLabel}, Uttarakhand, India`;
          const res = await fetchWithUA(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`);
          if (res.ok) {
            const data = await res.json();
            if (data && data[0]) pCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          }
        } catch (e) {
          console.error("Geocoding pickup failed", e);
        }
      }

      if (!dCoords && dLabel) {
        try {
          const query = dLabel.toLowerCase() === 'nanital' ? 'Nainital, Uttarakhand, India' : `${dLabel}, Uttarakhand, India`;
          const res = await fetchWithUA(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`);
          if (res.ok) {
            const data = await res.json();
            if (data && data[0]) dCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          }
        } catch (e) {
          console.error("Geocoding dropoff failed", e);
        }
      }

      const isValid = (c: any) => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1]);

      if (isValid(pCoords) && isValid(dCoords)) {
        // If we found an active booking, the Live Tracking effect will handle the pickup marker.
        // We only set it here if we are NOT in active live tracking mode.
        if (!activeBookingId) {
          setPickupCoords(pCoords);
          buildRoute(pCoords, dCoords);
        }
        setDropCoords(dCoords);
      } else if (isValid(pCoords)) {
        if (!activeBookingId) {
          setPickupCoords(pCoords);
          mapRef.current?.flyTo(pCoords[0], pCoords[1]);
        }
      } else if (isValid(dCoords)) {
        setDropCoords(dCoords);
        mapRef.current?.flyTo(dCoords[0], dCoords[1]);
      }
    };
    initFromParams();

    // Re-check for active rides periodically (e.g. every 30s) to auto-sync if ride state changes
    const syncInterval = setInterval(initFromParams, 30000);
    return () => clearInterval(syncInterval);
  }, [initialParams, buildRoute, token]);

  const activeLocation = pinnedLocation ? { ...pinnedLocation, accuracy: 0, heading: 0 } : gpsLocation;

  useEffect(() => {
    if (activeLocation && !pinnedLocation) {
      mapRef.current?.flyTo(activeLocation.lat, activeLocation.lng, 15);
    }

    // LIVE TRACKING: Authoritative mode for active journeys
    if (activeBookingId && activeLocation && dropCoords) {
      const now = Date.now();
      // Update route immediately on first detect, then every 10s
      if (now - lastRouteUpdateRef.current > 10000 || lastRouteUpdateRef.current === 0) {
        lastRouteUpdateRef.current = now;
        const currentPos: [number, number] = [activeLocation.lat, activeLocation.lng];
        // Forcing state update to match GPS exactly
        setPickupCoords(currentPos);
        buildRoute(currentPos, dropCoords);
      }
    }
  }, [activeLocation, pinnedLocation, activeBookingId, dropCoords, buildRoute]);

  // WebSocket Live Driver Tracking
  useEffect(() => {
    if (!activeBookingId) return;

    const wsUrl = `ws://localhost:8080/api/tracking/ws/${activeBookingId}`;
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.latitude && data.longitude) {
            setDriverLocation({ lat: data.latitude, lng: data.longitude });
          }
        } catch (e) {
          console.error("WS data error", e);
        }
      };

      socket.onclose = () => {
        console.log("WS connection closed, reconnecting...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WS Error:", err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [activeBookingId]);

  useEffect(() => {
    if (gpsError) alert(`GPS Error: ${gpsError}`);
  }, [gpsError]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPinnedLocation({ lat, lng });
    setPinMode(false);
    mapRef.current?.flyTo(lat, lng, 16);
    const label = await reverseGeocode(lat, lng);
    setPickupLabel(label);
    setPickupCoords([lat, lng]);
    await buildRoute([lat, lng], dropCoords);
  }, [dropCoords, buildRoute]);

  const handlePickupSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setPickupLabel(r.display_name);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 15);
    await buildRoute([lat, lng], dropCoords);
  }, [dropCoords, buildRoute]);

  const handleDropSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setDropLabel(r.display_name);
    setDropCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 13);
    await buildRoute(pickupCoords, [lat, lng]);
  }, [pickupCoords, buildRoute]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (!activeLocation) { relocate(); return; }
    const { lat, lng } = activeLocation;
    const label = await reverseGeocode(lat, lng);
    setPickupLabel(label);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 16);
    await buildRoute([lat, lng], dropCoords);
  }, [activeLocation, dropCoords, relocate, buildRoute]);

  const handleDriverMoved = useCallback((loc: DriverLocation) => {
    setDriverLoc(loc);
  }, []);

  useEffect(() => {
    if (!driverLoc || !dropCoords) return;
    const now = Date.now();
    if (now - lastRouteUpdateRef.current > 15000) {
      lastRouteUpdateRef.current = now;
      buildRoute([driverLoc.lat, driverLoc.lng], dropCoords);
    }
  }, [driverLoc, dropCoords, buildRoute]);

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
        <div style={{
          position: 'absolute', bottom: 20, left: 20,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
          padding: '6px 12px', borderRadius: '20px', zIndex: 1000,
          pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: 10, color: '#aaa', fontWeight: 'bold', letterSpacing: 0.5 }}>GPS ACCURACY</span>
          <span style={{
            fontSize: 11, fontWeight: 'bold',
            color: activeLocation.accuracy <= 50 ? '#22c55e' : activeLocation.accuracy <= 200 ? '#f59e0b' : '#ef4444'
          }}>
            ±{Math.round(activeLocation.accuracy)}m
          </span>
        </div>
      )}
    </div>
  );
}
