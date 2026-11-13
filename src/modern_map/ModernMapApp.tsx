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
import LocationSearch from './components/LocationSearch';
import LiveTrackingPanel from './components/LiveTrackingPanel';
import './index.css';
import { useUserLocation } from './hooks/useUserLocation';
import { fetchRoute, reverseGeocode, GeoResult } from './services/geocoding';
import type { DriverLocation } from './services/socket';
import styles from './ModernMapApp.module.css';
import { useTheme } from '../context/ThemeContext';
import { notify } from '../utils/notify';

const DEMO_ORDER_ID = 'raahi_order_demo_001';

export default function ModernMapApp({ initialParams }: { initialParams?: any }) {
  const { isDark } = useTheme();
  const [theme, setTheme] = useState<'dark' | 'light'>(isDark ? 'dark' : 'light');

  // Sync theme with global theme
  useEffect(() => {
    setTheme(isDark ? 'dark' : 'light');
  }, [isDark]);
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [pickupLabel, setPickupLabel] = useState(initialParams?.pickupLabel || '');
  const [dropLabel, setDropLabel] = useState(initialParams?.dropLabel || '');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(initialParams?.pickupCoords || null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(initialParams?.dropCoords || null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pinMode, setPinMode] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<MapViewHandle>(null);
  const lastRouteUpdateRef = useRef<number>(0);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeReqIdRef = useRef(0);
  const reverseGeoAbortRef = useRef<AbortController | null>(null);
  const reverseGeoReqIdRef = useRef(0);
  const dropCoordsRef = useRef(dropCoords);
  const pickupCoordsRef = useRef(pickupCoords);
  const { location: gpsLocation, error: gpsError, isLocating, relocate } = useUserLocation();
  const initialGpsRef = useRef(gpsLocation);

  useEffect(() => {
    dropCoordsRef.current = dropCoords;
  }, [dropCoords]);

  useEffect(() => {
    pickupCoordsRef.current = pickupCoords;
  }, [pickupCoords]);

  useEffect(() => {
    return () => {
      routeAbortRef.current?.abort();
      reverseGeoAbortRef.current?.abort();
    };
  }, []);

  // ── Fetch + draw route (with AbortController + sequence guard) ──
  const buildRoute = useCallback(async (
    from: [number, number] | null,
    to: [number, number] | null,
    externalSignal?: AbortSignal
  ) => {
    if (!from || !to) return;

    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    const reqId = ++routeReqIdRef.current;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
        return;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    setIsRouting(true);
    try {
      const result = await fetchRoute(from, to, controller.signal);
      if (controller.signal.aborted || reqId !== routeReqIdRef.current) return;
      if (result) {
        setRouteCoords(result.coordinates);
        setRouteDist(result.distance);
        setRouteEta(result.duration);
        mapRef.current?.drawRoute(result.coordinates);
      }
    } finally {
      externalSignal?.removeEventListener('abort', onExternalAbort);
      if (reqId === routeReqIdRef.current) {
        setIsRouting(false);
      }
    }
  }, []);

  // ── Auto-initialize route if params provided ──
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const initFromParams = async () => {
      // Helper for cleaning stringified "null" from URL params
      const cleanParam = (val: any) => (val === 'null' || val === null || val === undefined) ? null : val;

      let pCoords = cleanParam(initialParams?.pickupCoords);
      let dCoords = cleanParam(initialParams?.dropCoords);

      // Ensure they are arrays if they exist
      if (typeof pCoords === 'string' && pCoords.startsWith('[')) {
        try { pCoords = JSON.parse(pCoords); } catch (e) { pCoords = null; }
      }
      if (typeof dCoords === 'string' && dCoords.startsWith('[')) {
        try { dCoords = JSON.parse(dCoords); } catch (e) { dCoords = null; }
      }

      // If coordinates are missing but labels exist, try to geocode
      if (!pCoords && cleanParam(initialParams?.pickupLabel)) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(initialParams.pickupLabel)}&format=json&limit=1`,
            { signal: controller.signal }
          );
          const data = await res.json();
          if (data && data[0]) pCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error("Geocoding pickup failed", e);
        }
      }

      if (cancelled || controller.signal.aborted) return;

      if (!dCoords && cleanParam(initialParams?.dropLabel)) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(initialParams.dropLabel)}&format=json&limit=1`,
            { signal: controller.signal }
          );
          const data = await res.json();
          if (data && data[0]) dCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error("Geocoding dropoff failed", e);
        }
      }

      if (cancelled || controller.signal.aborted) return;

      // Final validation: only use if they are actually arrays [lat, lng]
      const isValid = (c: any) => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1]);

      if (isValid(pCoords) && isValid(dCoords)) {
        setPickupCoords(pCoords);
        setDropCoords(dCoords);
        await buildRoute(pCoords, dCoords, controller.signal);
      } else if (isValid(pCoords)) {
        setPickupCoords(pCoords);
        mapRef.current?.flyTo(pCoords[0], pCoords[1]);
      } else if (isValid(dCoords)) {
        setDropCoords(dCoords);
        mapRef.current?.flyTo(dCoords[0], dCoords[1]);
      }
    };

    void initFromParams();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialParams, buildRoute]);

  // Use pinned location if user overrode GPS, else use GPS
  const location = useMemo(
    () => (pinnedLocation ? { ...pinnedLocation, accuracy: 0, heading: 0 } : gpsLocation),
    [pinnedLocation, gpsLocation]
  );

  // Is GPS accuracy poor? (>200m = IP-based or weak signal, not reliable for tracking)
  const isGpsPoor = gpsLocation ? gpsLocation.accuracy > 200 : false;

  // ── Fly to real GPS updates without hijacking startup camera from static mock coords ──
  useEffect(() => {
    if (!gpsLocation || pinnedLocation) return;
    const initial = initialGpsRef.current;
    const isSameStaticInitial =
      initial !== null &&
      gpsLocation.lat === initial.lat &&
      gpsLocation.lng === initial.lng;
    if (isSameStaticInitial) return;
    if (pickupCoordsRef.current || dropCoordsRef.current) return;
    mapRef.current?.flyTo(gpsLocation.lat, gpsLocation.lng, 15);
  }, [gpsLocation, pinnedLocation]);

  // Alert on GPS Error
  useEffect(() => {
    if (gpsError) {
      notify('GPS Error', gpsError);
    }
  }, [gpsError]);

  const handleClearPinnedLocation = useCallback(() => {
    reverseGeoAbortRef.current?.abort();
    setPinnedLocation(null);
    if (gpsLocation && !pickupCoordsRef.current && !dropCoordsRef.current) {
      mapRef.current?.flyTo(gpsLocation.lat, gpsLocation.lng, 15);
    }
  }, [gpsLocation]);

  // Handle map click to manually pin location
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPinnedLocation({ lat, lng });
    setPinMode(false);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 16);

    reverseGeoAbortRef.current?.abort();
    const controller = new AbortController();
    reverseGeoAbortRef.current = controller;
    const reqId = ++reverseGeoReqIdRef.current;

    const routePromise = buildRoute([lat, lng], dropCoordsRef.current);
    const label = await reverseGeocode(lat, lng, controller.signal);
    if (!controller.signal.aborted && reqId === reverseGeoReqIdRef.current) {
      setPickupLabel(label);
    }
    await routePromise;
  }, [buildRoute]);

  // ── Handle pickup selection ──
  const handlePickupSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setPickupLabel(r.display_name);
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 15);
    await buildRoute([lat, lng], dropCoordsRef.current);
  }, [buildRoute]);

  // ── Handle drop selection ──
  const handleDropSelect = useCallback(async (r: GeoResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setDropLabel(r.display_name);
    setDropCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 13);
    await buildRoute(pickupCoordsRef.current, [lat, lng]);
  }, [buildRoute]);

  // ── Use current location as pickup ──
  const handleUseCurrentLocation = useCallback(async () => {
    if (!location) { relocate(); return; }
    const { lat, lng } = location;
    setPickupCoords([lat, lng]);
    mapRef.current?.flyTo(lat, lng, 16);

    reverseGeoAbortRef.current?.abort();
    const controller = new AbortController();
    reverseGeoAbortRef.current = controller;
    const reqId = ++reverseGeoReqIdRef.current;

    const routePromise = buildRoute([lat, lng], dropCoordsRef.current);
    const label = await reverseGeocode(lat, lng, controller.signal);
    if (!controller.signal.aborted && reqId === reverseGeoReqIdRef.current) {
      setPickupLabel(label);
    }
    await routePromise;
  }, [location, relocate, buildRoute]);

  // ── Driver location callback (from socket) ──
  const handleDriverMoved = useCallback((loc: DriverLocation) => {
    setDriverLoc(loc);
  }, []);

  // ── Live dynamic routing for tracking ──
  // Automatically recalculate route from driver's current position to the destination.
  useEffect(() => {
    if (!driverLoc || !dropCoords) return;

    const now = Date.now();
    // Throttle: Only update every 15 seconds to focus on animation and reduce API load
    if (now - lastRouteUpdateRef.current > 15000) {
      lastRouteUpdateRef.current = now;
      buildRoute([driverLoc.lat, driverLoc.lng], dropCoords);
    }
  }, [driverLoc, dropCoords, buildRoute]);

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

      {/* ── Sidebar ── */}
      {/* 
      <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed}`}>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Plan your journey</p>
          <LocationSearch
            icon="pickup"
            placeholder="From: Pickup location"
            value={pickupLabel}
            onSelect={handlePickupSelect}
            onUseCurrentLocation={handleUseCurrentLocation}
          />
          <div className={styles.dividerDot}><span></span><span></span><span></span></div>
          <LocationSearch
            icon="drop"
            placeholder="To: Destination"
            value={dropLabel}
            onSelect={handleDropSelect}
          />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Live Tracking Status</p>
          <LiveTrackingPanel
            orderId={initialParams?.orderId || DEMO_ORDER_ID}
            role={role}
            distance={routeDist}
            duration={routeEta}
            onDriverMoved={handleDriverMoved}
          />
        </div>
      </div>
      */}

      {/* Pinned override banner — lets user return to GPS */}
      {pinnedLocation && (
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 150, maxWidth: 320 }}>
          <div className={styles.pinnedBanner}>
            <span>📍 Manual pin active</span>
            <button className={styles.clearPinBtn} onClick={handleClearPinnedLocation}>
              Use GPS
            </button>
          </div>
        </div>
      )}

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


    </div>
  );
}
