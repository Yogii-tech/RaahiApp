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

const DEMO_ORDER_ID = 'raahi_order_demo_001';

export default function ModernMapApp({ initialParams }: { initialParams?: any }) {
  const [theme, setTheme]               = useState<'dark' | 'light'>('dark');
  const [role, setRole]                 = useState<'passenger' | 'driver'>('passenger');
  const [pickupLabel, setPickupLabel]   = useState(initialParams?.pickupLabel || '');
  const [dropLabel, setDropLabel]       = useState(initialParams?.dropLabel || '');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(initialParams?.pickupCoords || null);
  const [dropCoords, setDropCoords]     = useState<[number, number] | null>(initialParams?.dropCoords || null);
  const [routeCoords, setRouteCoords]   = useState<[number, number][] | null>(null);
  const [routeDist, setRouteDist]       = useState<number | null>(null);
  const [routeEta, setRouteEta]         = useState<number | null>(null);
  const [driverLoc, setDriverLoc]       = useState<DriverLocation | null>(null);
  const [isRouting, setIsRouting]       = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(!initialParams);
  const [pinMode, setPinMode]           = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const { location: gpsLocation, error: gpsError, isLocating, relocate } = useUserLocation();

  // ── Auto-initialize route if params provided ──
  useEffect(() => {
    const initFromParams = async () => {
      let pCoords = initialParams?.pickupCoords;
      let dCoords = initialParams?.dropCoords;

      // If coordinates are missing but labels exist, try to geocode
      if (!pCoords && initialParams?.pickupLabel) {
        try {
          // Use public Nominatim if backend geocode not ready
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(initialParams.pickupLabel)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) pCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch (e) { console.error("Geocoding pickup failed", e); }
      }

      if (!dCoords && initialParams?.dropLabel) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(initialParams.dropLabel)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) dCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch (e) { console.error("Geocoding dropoff failed", e); }
      }

      if (pCoords && dCoords) {
        setPickupCoords(pCoords);
        setDropCoords(dCoords);
        buildRoute(pCoords, dCoords);
      } else if (pCoords) {
        setPickupCoords(pCoords);
        mapRef.current?.flyTo(pCoords[0], pCoords[1]);
      } else if (dCoords) {
        setDropCoords(dCoords);
        mapRef.current?.flyTo(dCoords[0], dCoords[1]);
      }
    };

    initFromParams();
  }, [initialParams]);

  // Use pinned location if user overrode GPS, else use GPS
  const location = pinnedLocation
    ? { ...pinnedLocation, accuracy: 0, heading: 0 }
    : gpsLocation;

  // Is GPS accuracy poor? (>200m = IP-based or weak signal, not reliable for tracking)
  const isGpsPoor = gpsLocation ? gpsLocation.accuracy > 200 : false;

  // ── Fly to GPS location when found ──
  useEffect(() => {
    if (gpsLocation && !pinnedLocation) {
      mapRef.current?.flyTo(gpsLocation.lat, gpsLocation.lng, 15);
    }
  }, [gpsLocation]);

  // Alert on GPS Error
  useEffect(() => {
    if (gpsError) {
      alert(`GPS Error: ${gpsError}`);
    }
  }, [gpsError]);

  // Handle map click to manually pin location
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPinnedLocation({ lat, lng });
    setPinMode(false);
    mapRef.current?.flyTo(lat, lng, 16);
    const label = await reverseGeocode(lat, lng);
    setPickupLabel(label);
    setPickupCoords([lat, lng]);
    await buildRoute([lat, lng], dropCoords);
  }, [dropCoords]);

  // ── Handle pickup selection ──
  const handlePickupSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setPickupLabel(r.display_name);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 15);
    await buildRoute([lat, lng], dropCoords);
  }, [dropCoords]);

  // ── Handle drop selection ──
  const handleDropSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setDropLabel(r.display_name);
    setDropCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 13);
    await buildRoute(pickupCoords, [lat, lng]);
  }, [pickupCoords]);

  // ── Use current location as pickup ──
  const handleUseCurrentLocation = useCallback(async () => {
    if (!location) { relocate(); return; }
    const { lat, lng } = location;
    const label = await reverseGeocode(lat, lng);
    setPickupLabel(label);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 16);
    await buildRoute([lat, lng], dropCoords);
  }, [location, dropCoords, relocate]);

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

  // ── Driver location callback (from socket) ──
  const handleDriverMoved = useCallback((loc: DriverLocation) => {
    setDriverLoc(loc);
  }, []);

  return (
    <div className={`${styles.app} ${styles[theme]}`}>
      {/* ── Full-screen map ── */}
      <div className={styles.mapLayer}>
        <MapView
          ref={mapRef}
          userLocation={location}
          driverLocation={driverLoc}
          theme={theme}
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          routeCoords={routeCoords}
          pinModeActive={pinMode}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Pin mode overlay */}
      {pinMode && (
        <div className={styles.pinOverlay}>
          <div className={styles.pinOverlayCard}>
            <span className={styles.pinOverlayIcon}>📍</span>
            <p>Click anywhere on the map<br />to set your exact location</p>
            <button className={styles.pinCancelBtn} onClick={() => setPinMode(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Floating Map Controls */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 1000
      }}>
        {/* Locate Me Button */}
        <button
          onClick={() => {
            if (gpsLocation) {
              mapRef.current?.flyTo(gpsLocation.lat, gpsLocation.lng, 15);
            }
            relocate();
          }}
          style={{
            width: 50,
            height: 50,
            borderRadius: '25px',
            backgroundColor: '#007AFF',
            color: '#fff',
            border: 'none',
            fontSize: 24,
            boxShadow: '0 4px 12px rgba(0,122,255,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          className={isLocating ? styles.spinning : ''}
          title="Locate Me"
        >
          {isLocating ? '⟳' : '◎'}
        </button>

        {/* Manual Pin Button */}
        <button
          onClick={() => setPinMode(!pinMode)}
          style={{
            width: 50,
            height: 50,
            borderRadius: '25px',
            backgroundColor: pinMode ? '#ef4444' : '#fff',
            color: pinMode ? '#fff' : '#333',
            border: 'none',
            fontSize: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Manual Pin"
        >
          📍
        </button>
      </div>

      {/* Accuracy indicator (Floating small) */}
      {location && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          padding: '6px 12px',
          borderRadius: '20px',
          zIndex: 1000,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: 10, color: '#aaa', fontWeight: 'bold', letterSpacing: 0.5 }}>GPS ACCURACY</span>
          <span style={{ 
            fontSize: 11, 
            fontWeight: 'bold',
            color: location.accuracy <= 50 ? '#22c55e' : location.accuracy <= 200 ? '#f59e0b' : '#ef4444' 
          }}>
            ±{Math.round(location.accuracy)}m
          </span>
        </div>
      )}
    </div>
  );
}
