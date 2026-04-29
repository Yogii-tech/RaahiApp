/**
 * Socket.io singleton client
 * Handles driver location emission and passenger subscription
 */
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = (typeof process !== 'undefined' && process.env && process.env.VITE_BACKEND_URL) ? process.env.VITE_BACKEND_URL : 'http://10.165.74.1:4000';

export interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  speed?: number;
  timestamp?: number;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket!.id);
    });
    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });
    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

// ── Driver: register + start sending GPS ──
export function startDriverTracking(orderId: string, driverId: string) {
  const s = getSocket();
  s.emit('driver:register', { orderId, driverId });

  const watchId = navigator.geolocation.watchPosition(
    (pos: any) => {
      const { latitude, longitude, heading, accuracy, speed } = pos.coords;
      const payload: DriverLocation & { orderId: string } = {
        orderId,
        lat: latitude,
        lng: longitude,
        heading: heading ?? 0,
        accuracy: accuracy ?? 0,
        speed: speed ?? 0,
      };
      s.emit('driver:location', payload);
    },
    (err: any) => console.error('[GPS] Error:', err.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    s.emit('trip:status', { orderId, status: 'driver_offline' });
  };
}

// ── Passenger: subscribe to a driver's live location ──
export function trackOrder(
  orderId: string,
  onMove: (loc: DriverLocation) => void,
  onStatus?: (status: string) => void
) {
  const s = getSocket();
  s.emit('passenger:track', { orderId });
  s.on('driver:moved', onMove);
  if (onStatus) s.on('trip:status', ({ status }) => onStatus(status));

  return () => {
    s.off('driver:moved', onMove);
    if (onStatus) s.off('trip:status');
  };
}
