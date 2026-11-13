/**
 * LiveTrackingPanel Component
 * Shows the tracking status card — driver ETA, route info,
 * trip status, and driver simulation controls (for demo/testing).
 */
import { useState, useEffect, useRef } from 'react';
import { getSocket, trackOrder, startDriverTracking, DriverLocation } from '../services/socket';
import { formatDistance, formatDuration } from '../services/geocoding';
import styles from './LiveTrackingPanel.module.css';

interface LiveTrackingPanelProps {
  orderId: string;
  role: 'driver' | 'passenger';
  driverId?: string;
  distance?: number | null;
  duration?: number | null;
  onDriverMoved: (loc: DriverLocation) => void;
}

export default function LiveTrackingPanel({
  orderId, role, driverId = 'driver_001',
  distance, duration, onDriverMoved,
}: LiveTrackingPanelProps) {
  const [tripStatus, setTripStatus] = useState<string>('waiting');
  const [connected, setConnected]   = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const driverStopRef = useRef<(() => void) | null>(null);

  // ── Reset & manage subscription / cleanup on role or orderId change ──
  useEffect(() => {
    driverStopRef.current?.();
    driverStopRef.current = null;
    setIsTracking(false);
    setTripStatus('waiting');

    if (role !== 'passenger') {
      setConnected(false);
      return () => {
        driverStopRef.current?.();
        driverStopRef.current = null;
      };
    }

    const socket = getSocket() as { connected?: boolean } | null;
    setConnected(Boolean(socket && socket.connected !== false));
    const unsub = trackOrder(orderId, onDriverMoved, setTripStatus);
    return () => {
      unsub();
      setConnected(false);
    };
  }, [orderId, role, onDriverMoved]);

  // ── Driver mode: start or stop sending GPS location ──
  const handleStartDriver = () => {
    if (isTracking) return;
    driverStopRef.current?.();
    driverStopRef.current = null;

    const socket = getSocket() as { connected?: boolean } | null;
    if (!socket) {
      setConnected(false);
      setIsTracking(false);
      setTripStatus('driver_offline');
      return;
    }

    driverStopRef.current = startDriverTracking(orderId, driverId);
    setIsTracking(true);
    setConnected(socket.connected !== false);
    setTripStatus('en_route');
  };

  const handleStopDriver = () => {
    driverStopRef.current?.();
    driverStopRef.current = null;
    setIsTracking(false);
    setConnected(false);
    setTripStatus('waiting');
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    waiting:   { text: 'Waiting for driver', color: '#f59e0b' },
    en_route:  { text: 'Driver en route',    color: '#3b82f6' },
    arrived:   { text: 'Driver arrived',     color: '#22c55e' },
    completed: { text: 'Trip complete',      color: '#8b5cf6' },
    driver_offline: { text: 'Driver offline', color: '#ef4444' },
  };

  const status = statusLabel[tripStatus] ?? statusLabel.waiting;

  return (
    <div className={styles.panel}>
      {/* Status indicator */}
      <div className={styles.statusRow}>
        <span className={styles.statusDot} style={{ background: status.color }} />
        <span className={styles.statusText} style={{ color: status.color }}>
          {status.text}
        </span>
        <span className={`${styles.liveChip} ${connected ? styles.connected : ''}`}>
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
      </div>

      {/* Route summary */}
      {(distance != null || duration != null) && (
        <div className={styles.routeRow}>
          {distance != null && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Distance</span>
              <span className={styles.statValue}>{formatDistance(distance)}</span>
            </div>
          )}
          {duration != null && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>ETA</span>
              <span className={styles.statValue}>{formatDuration(duration)}</span>
            </div>
          )}
          <div className={styles.stat}>
            <span className={styles.statLabel}>Order</span>
            <span className={styles.statValue}>{orderId.slice(-6).toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Driver controls (demo mode) */}
      {role === 'driver' && (
        <button
          className={`${styles.btn} ${isTracking ? styles.btnDanger : styles.btnPrimary}`}
          onClick={isTracking ? handleStopDriver : handleStartDriver}
        >
          {isTracking ? '🛑 Stop Driver Tracking' : '🚗 Start Driver Tracking'}
        </button>
      )}

      {!connected && (
        <p className={styles.hint}>
          {role === 'passenger'
            ? 'Live tracking is currently offline.'
            : 'Live socket transport is disabled.'}
        </p>
      )}
    </div>
  );
}
