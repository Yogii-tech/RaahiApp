import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import ModernMapApp from '../modern_map/ModernMapApp';
import { useTheme } from '../context/ThemeContext';
import { useRoute } from '@react-navigation/native';

/**
 * Web MapScreen using MapLibre GL JS
 * Replaces the old iframe-based map with the high-precision tracking UI.
 */
const MapScreen: React.FC = () => {
    const { colors } = useTheme();
    const route = useRoute<any>();
    const params = route.params;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.mapContainer}>
                {/* Embed the React DOM component directly since this is the .web entry or we are running on web */}
                <ModernMapApp initialParams={params} />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapContainer: { flex: 1, overflow: 'hidden' },
});

export default MapScreen;
