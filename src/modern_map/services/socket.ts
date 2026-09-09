/**
 * Socket service — Disabled (Real-time live GPS tracking disabled by design)
 */

export interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  speed?: number;
  timestamp?: number;
}

export function getSocket(): null {
  return null;
}

// ── Driver: register (Disabled) ──
export function startDriverTracking(_orderId: string, _driverId: string) {
  return () => {};
}

// ── Passenger: subscribe (Disabled) ──
export function trackOrder(
  _orderId: string,
  _onMove: (loc: DriverLocation) => void,
  _onStatus?: (status: string) => void
) {
  return () => {};
}

