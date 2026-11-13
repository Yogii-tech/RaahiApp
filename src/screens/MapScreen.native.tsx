import React from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    Dimensions, 
    TouchableOpacity, 
    SafeAreaView,
    Platform,
    Alert
} from 'react-native';
import MapView, { Marker, AnimatedRegion } from 'react-native-maps';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../apiConfig';

const { width, height } = Dimensions.get('window');

type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

const isValidCoordinate = (val: unknown): val is number =>
    typeof val === 'number' && Number.isFinite(val);

const MapScreen: React.FC = () => {
    const { colors, isDark } = useTheme();
    const { t } = useLanguage();
    
    // 1. Live Marker Animation (The Illusion: 5000ms interpolation)
    const [riderLocation] = React.useState(new AnimatedRegion({
        latitude: 30.3165,
        longitude: 78.0322,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    }));

    const [isLive, setIsLive] = React.useState(false);
    const [wsStatus, setWsStatus] = React.useState<WsStatus>('idle');
    const isLiveRef = React.useRef(isLive);
    const locateTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        isLiveRef.current = isLive;
        if (!isLive && locateTimerRef.current) {
            clearTimeout(locateTimerRef.current);
            locateTimerRef.current = null;
        }
    }, [isLive]);

    React.useEffect(() => {
        return () => {
            if (locateTimerRef.current) {
                clearTimeout(locateTimerRef.current);
                locateTimerRef.current = null;
            }
        };
    }, []);

    React.useEffect(() => {
        if (!isLive) {
            setWsStatus('idle');
            return;
        }

        let cancelled = false;
        setWsStatus('connecting');

        const wsUrl = API_BASE.replace('http', 'ws') + '/api/tracking/ws/live_order_123';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            if (!cancelled) setWsStatus('connected');
        };

        ws.onmessage = (e) => {
            if (cancelled) return;
            try {
                const data = JSON.parse(e.data);
                if (!isValidCoordinate(data?.latitude) || !isValidCoordinate(data?.longitude)) {
                    return;
                }
                (riderLocation as any).timing({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    duration: 5000,
                    useNativeDriver: false
                }).start();
            } catch (err) {
                console.error('WS Data error:', err);
            }
        };

        ws.onerror = () => {
            if (!cancelled) setWsStatus('error');
        };

        ws.onclose = () => {
            if (!cancelled) {
                setWsStatus(prev => (prev === 'error' ? 'error' : 'disconnected'));
            }
        };

        return () => {
            cancelled = true;
            ws.close();
        };
    }, [isLive, riderLocation]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.mapContainer}>
                {isLive ? (
                    <MapView 
                        style={styles.placeholderMap}
                        initialRegion={{
                            latitude: 30.3165,
                            longitude: 78.0322,
                            latitudeDelta: 0.1,
                            longitudeDelta: 0.1,
                        }}
                    >
                        <Marker.Animated
                            coordinate={riderLocation as any}
                            title="Rider Location"
                            description="Real-time interpolated movement"
                        >
                            <View style={[styles.activeRiderMarker, { backgroundColor: colors.primary }]}>
                                <Icon name="bicycle" size={24} color="#FFF" />
                            </View>
                        </Marker.Animated>
                    </MapView>
                ) : (
                    <View style={[styles.placeholderMap, { backgroundColor: isDark ? '#1a1c24' : '#e0e4eb' }]}>
                        {/* Abstract Grid Lines */}
                        <View style={styles.gridLineH} />
                        <View style={[styles.gridLineH, { top: '40%' }]} />
                        <View style={[styles.gridLineH, { top: '60%' }]} />
                        <View style={[styles.gridLineH, { top: '80%' }]} />
                        <View style={styles.gridLineV} />
                        <View style={[styles.gridLineV, { left: '30%' }]} />
                        <View style={[styles.gridLineV, { left: '60%' }]} />
                        <View style={[styles.gridLineV, { left: '90%' }]} />

                        {/* Fake Markers */}
                        <View style={[styles.marker, { top: '30%', left: '40%' }]}>
                            <Icon name="location" size={30} color={colors.primary} />
                            <View style={[styles.markerLabel, { backgroundColor: colors.cardColor }]}>
                                <Text style={[styles.markerText, { color: colors.textColor }]}>Rishikesh</Text>
                            </View>
                        </View>

                        <View style={[styles.marker, { top: '55%', left: '70%' }]}>
                            <Icon name="location" size={30} color="#FF4081" />
                            <View style={[styles.markerLabel, { backgroundColor: colors.cardColor }]}>
                                <Text style={[styles.markerText, { color: colors.textColor }]}>Dehradun</Text>
                            </View>
                        </View>

                        <View style={[styles.marker, { top: '20%', left: '75%' }]}>
                            <Icon name="location" size={30} color="#00BFA5" />
                            <View style={[styles.markerLabel, { backgroundColor: colors.cardColor }]}>
                                <Text style={[styles.markerText, { color: colors.textColor }]}>Mussoorie</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <TouchableOpacity 
                        style={[styles.floatingSearch, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                        activeOpacity={0.9}>
                        <Icon name="search-outline" size={20} color={colors.subtextColor} />
                        <Text style={[styles.placeholderText, { color: colors.subtextColor }]}>
                            Search for hills routes...
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => {
                            if (!isLive) {
                                Alert.alert("Live Map Inactive", "Tap OPEN LIVE MAP to start live tracking before locating.");
                                return;
                            }
                            if (locateTimerRef.current) {
                                clearTimeout(locateTimerRef.current);
                            }
                            // In a real native app, we would use react-native-geolocation-service
                            // For this demo, we'll simulate finding the location
                            Alert.alert("Locating...", "Fetching high-accuracy GPS coordinates...");
                            locateTimerRef.current = setTimeout(() => {
                                locateTimerRef.current = null;
                                if (!isLiveRef.current) return;
                                // Simulate moving to a precise location in Uttarakhand
                                (riderLocation as any).timing({
                                    latitude: 30.3165,
                                    longitude: 78.0322,
                                    duration: 2000,
                                    useNativeDriver: false
                                }).start();
                            }, 1500);
                        }}

                        style={[styles.locationBtn, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
                        activeOpacity={0.8}>
                        <Icon name="locate" size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoIconBox}>
                            <Icon name={isLive ? "pulse" : "navigate-circle-outline"} size={32} color={isLive ? "#FF4081" : colors.primary} />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={[styles.infoTitle, { color: colors.textColor }]}>
                                {isLive
                                    ? wsStatus === 'error'
                                        ? "Tracking Connection Error"
                                        : wsStatus === 'disconnected'
                                            ? "Tracking Disconnected"
                                            : "Tracking Delivery..."
                                    : "Explore Uttarakhand"}
                            </Text>
                            <Text style={[styles.infoSubtitle, { color: colors.subtextColor }]}>
                                {!isLive
                                    ? "Live traffic & hill routes monitoring"
                                    : wsStatus === 'connecting'
                                        ? "Connecting to live tracking stream..."
                                        : wsStatus === 'connected'
                                            ? "Interpolated 60fps movement (5s polling)"
                                            : wsStatus === 'error'
                                                ? "Unable to reach tracking server"
                                                : "Live stream closed — toggle to reconnect"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={[styles.btn, { backgroundColor: isLive ? '#C62828' : colors.primary }]}
                        onPress={() => setIsLive(!isLive)}>
                        <Text style={styles.btnText}>{isLive ? "STOP TRACKING" : "OPEN LIVE MAP"}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapContainer: { flex: 1, overflow: 'hidden' },
    placeholderMap: { flex: 1, position: 'relative' },
    activeRiderMarker: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: '#FFF', elevation: 10,
    },
    gridLineH: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
    gridLineV: { position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.05)' },
    marker: { position: 'absolute', alignItems: 'center' },
    markerLabel: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 4, borderWidth: 1 },
    markerText: { fontSize: 10, fontWeight: 'bold' },
    floatingSearch: {
        position: 'absolute', top: 20, left: 20, right: 20,
        height: 54, borderRadius: 27, flexDirection: 'row',
        alignItems: 'center', paddingHorizontal: 20, borderWidth: 1,
    },
    placeholderText: { fontSize: 15, marginLeft: 12, fontWeight: '500' },
    locationBtn: {
        position: 'absolute', right: 20, bottom: 180,
        width: 54, height: 54, borderRadius: 27,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    infoCard: {
        position: 'absolute', bottom: 20, left: 20, right: 20,
        borderRadius: 24, padding: 20, borderWidth: 1,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    infoIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(91, 79, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    infoContent: { flex: 1 },
    infoTitle: { fontSize: 18, fontWeight: 'bold' },
    infoSubtitle: { fontSize: 13, opacity: 0.7 },
    btn: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
});

export default MapScreen;
