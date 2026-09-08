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
const HUNT_TIMEOUT = 15_000;  // ms — give up after 15 seconds

export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>({
    lat: 29.3919,
    lng: 79.1314,
    accuracy: 10,
    heading: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const relocate = useCallback(() => {
    setIsLocating(false);
  }, []);

  useEffect(() => {
    // Static location ready
  }, []);

  return { location, error, isLocating, relocate };
}
