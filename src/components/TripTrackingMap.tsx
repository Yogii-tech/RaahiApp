import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';

interface TripTrackingMapProps {
    bookingId: string;
    pickup: string;
    dropoff: string;
    onClose: () => void;
}

const TripTrackingMap: React.FC<TripTrackingMapProps> = ({ bookingId, pickup, dropoff, onClose }) => {
    const { colors, isDark } = useTheme();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [loading, setLoading] = useState(true);
    const [driverLoc, setDriverLoc] = useState<{ lat: number, lng: number } | null>(null);
    const [passengerLoc, setPassengerLoc] = useState<{ lat: number, lng: number } | null>(null);

    // Mock coordinates for demo (Dehradun area)
    const pickupCoords: [number, number] = [30.3165, 78.0322];
    const dropoffCoords: [number, number] = [30.4599, 78.0664]; // Mussoorie

    useEffect(() => {
        if (Platform.OS !== 'web' || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: isDark ? 
                'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png' : 
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            center: [pickupCoords[1], pickupCoords[0]],
            zoom: 12,
        });

        map.on('load', () => {
            setLoading(false);
            
            // Add Route Layer
            map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [pickupCoords[1], pickupCoords[0]],
                            [dropoffCoords[1], dropoffCoords[0]]
                        ]
                    }
                }
            });

            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#ff0000', // RED as requested
                    'line-width': 5,
                    'line-opacity': 0.8
                }
            });

            // Markers
            // Destination (Dropoff)
            new maplibregl.Marker({ color: '#ff0000' })
                .setLngLat([dropoffCoords[1], dropoffCoords[0]])
                .addTo(map);

            // Pickup
            new maplibregl.Marker({ color: '#2ecc71' })
                .setLngLat([pickupCoords[1], pickupCoords[0]])
                .addTo(map);

            // Fit bounds
            map.fitBounds([
                [Math.min(pickupCoords[1], dropoffCoords[1]), Math.min(pickupCoords[0], dropoffCoords[0])],
                [Math.max(pickupCoords[1], dropoffCoords[1]), Math.max(pickupCoords[0], dropoffCoords[0])]
            ], { padding: 50 });
        });

        mapRef.current = map;

        // Simulate live tracking
        const interval = setInterval(() => {
            // Mock driver moving from pickup to dropoff
            const progress = (Date.now() % 30000) / 30000;
            const currentLat = pickupCoords[0] + (dropoffCoords[0] - pickupCoords[0]) * progress;
            const currentLng = pickupCoords[1] + (dropoffCoords[1] - pickupCoords[1]) * progress;
            
            setDriverLoc({ lat: currentLat, lng: currentLng });
        }, 1000);

        // Get passenger location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos: any) => {
                setPassengerLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            });
        }

        return () => {
            clearInterval(interval);
            map.remove();
        };
    }, []);

    // Update markers
    const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
    const passengerMarkerRef = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!mapRef.current || !driverLoc) return;

        if (!driverMarkerRef.current) {
            const el = document.createElement('div');
            el.innerHTML = `<div style="font-size: 24px;">🚖</div>`; // Cab animation
            driverMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([driverLoc.lng, driverLoc.lat])
                .addTo(mapRef.current);
        } else {
            driverMarkerRef.current.setLngLat([driverLoc.lng, driverLoc.lat]);
        }
    }, [driverLoc]);

    useEffect(() => {
        if (!mapRef.current || !passengerLoc) return;

        if (!passengerMarkerRef.current) {
            const el = document.createElement('div');
            el.innerHTML = `<div style="width: 15px; height: 15px; background: #3498db; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`;
            passengerMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([passengerLoc.lng, passengerLoc.lat])
                .addTo(mapRef.current);
        } else {
            passengerMarkerRef.current.setLngLat([passengerLoc.lng, passengerLoc.lat]);
        }
    }, [passengerLoc]);

    if (Platform.OS !== 'web') {
        return <View style={styles.container}><Text>Map tracking only available on Web</Text></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View ref={mapContainerRef as any} style={styles.map} />
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <View style={[styles.infoPanel, { backgroundColor: colors.cardColor }]}>
                <Text style={[styles.infoTitle, { color: colors.textColor }]}>Live Tracking: RA-{bookingId.slice(-4).toUpperCase()}</Text>
                <Text style={[styles.infoSub, { color: colors.subtextColor }]}>🚖 Driver is on the way to {dropoff.split(',')[0]}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    map: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
    },
    closeText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    infoPanel: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        padding: 16,
        borderRadius: 12,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    infoSub: {
        fontSize: 14,
        marginTop: 4,
    },
});

export default TripTrackingMap;
