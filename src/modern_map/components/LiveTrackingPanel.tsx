/**
 * LiveTrackingPanel Component
 * Shows the tracking status card — driver ETA, route info,
 * trip status, and driver simulation controls (for demo/testing).
 */
import { useState, useEffect } from 'react';
import { trackOrder, startDriverTracking, DriverLocation } from '../services/socket';
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

  // ── Passenger mode: subscribe to driver updates ──
  useEffect(() => {
    if (role !== 'passenger') return;
    setConnected(true);
    const unsub = trackOrder(orderId, onDriverMoved, setTripStatus);
    return unsub;
  }, [orderId, role, onDriverMoved]);

  // ── Driver mode: start sending GPS location ──
  const handleStartDriver = () => {
    setIsTracking(true);
    const stop = startDriverTracking(orderId, driverId);
    setConnected(true);
    setTripStatus('en_route');
    return () => { stop(); setIsTracking(false); };
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
      {(distance || duration) && (
        <div className={styles.routeRow}>
          {distance && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Distance</span>
              <span className={styles.statValue}>{formatDistance(distance)}</span>
            </div>
          )}
          {duration && (
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
          onClick={handleStartDriver}
          disabled={isTracking}
        >
          {isTracking ? '📡 Transmitting Location...' : '🚗 Start Driver Tracking'}
        </button>
      )}

      {role === 'passenger' && !connected && (
        <p className={styles.hint}>Connecting to live tracking...</p>
      )}
    </div>
  );
}
