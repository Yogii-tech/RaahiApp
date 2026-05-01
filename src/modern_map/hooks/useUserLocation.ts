/**
 * useUserLocation hook
 * Hunts for the best GPS fix within a timeout window.
 * Prevents the "stuck in Delhi" problem by tracking the most
 * accurate reading and only locking in once 100m threshold is hit.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number;
}

interface UseUserLocationReturn {
  location: UserLocation | null;
  error: string | null;
  isLocating: boolean;
  relocate: () => void;
}

const ACCURACY_TARGET = 100;     // meters — lock in at this level
const HUNT_TIMEOUT    = 15_000;  // ms — give up after 15 seconds

export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const watchRef = useRef<number | null>(null);

  const relocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    // Clear any existing watch
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    setIsLocating(true);
    setError(null);

    let bestResult: GeolocationPosition | null = null;

    const done = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading } = pos.coords;
      setLocation({ lat: latitude, lng: longitude, accuracy, heading: heading ?? 0 });
      setIsLocating(false);
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };

    const timeoutId = setTimeout(() => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      setIsLocating(false);
      // Use best-so-far if we didn't hit the target
      if (bestResult) done(bestResult);
      else setError('Could not get precise location. Check GPS permissions.');
    }, HUNT_TIMEOUT);

    const startWatch = (isHighAccuracy: boolean) => {
      const watchId = navigator.geolocation.watchPosition(
        (pos: any) => {
          // Ignore extremely poor accuracy (e.g. 50km) if we want real GPS
          if (isHighAccuracy && pos.coords.accuracy > 5000) return;

          // Track the best reading
          if (!bestResult || pos.coords.accuracy < bestResult.coords.accuracy) {
            bestResult = pos;
            // STREAMING MODE: Even if we haven't hit the "perfect" 100m target yet, 
            // send the best available location immediately so the map shows PROGRESS.
            const { latitude, longitude, accuracy, heading } = pos.coords;
            setLocation({ lat: latitude, lng: longitude, accuracy, heading: heading ?? 0 });
          }
          // If we hit our target (50m-200m), we can stop hunting
          if (pos.coords.accuracy <= ACCURACY_TARGET) {
            clearTimeout(timeoutId);
            setIsLocating(false);
            if (watchRef.current !== null) {
              navigator.geolocation.clearWatch(watchRef.current);
              watchRef.current = null;
            }
          }
        },
        (err: any) => {
          if (isHighAccuracy) {
            console.warn("High accuracy failed, falling back to low accuracy...");
            navigator.geolocation.clearWatch(watchId);
            startWatch(false);
            return;
          }
          
          clearTimeout(timeoutId);
          setIsLocating(false);
          if (watchRef.current !== null) {
            navigator.geolocation.clearWatch(watchRef.current);
            watchRef.current = null;
          }
          switch (err.code) {
            case err.PERMISSION_DENIED:
              setError('Location access denied. Please allow GPS in browser settings.');
              break;
            case err.POSITION_UNAVAILABLE:
              setError('GPS signal unavailable. Try moving to an open area.');
              break;
            case err.TIMEOUT:
              if (bestResult) done(bestResult);
              else setError('Location request timed out.');
              break;
          }
        },
        { enableHighAccuracy: isHighAccuracy, maximumAge: 0, timeout: HUNT_TIMEOUT }
      );
      watchRef.current = watchId;
    };

    startWatch(true);
  }, []);

  // Auto-locate on mount
  useEffect(() => { 
    relocate(); 
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [relocate]);

  return { location, error, isLocating, relocate };
}
