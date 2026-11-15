import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface RaahiLogoProps {
    size?: number;
}

const LOGO_SOURCE = require('../assets/logo_brand.png');

const RaahiLogo: React.FC<RaahiLogoProps> = ({ size = 42 }) => {
    return (
        <View style={[styles.container, { width: size, height: size }]} testID="raahi-logo">
            <Image
                source={LOGO_SOURCE}
                style={{ width: size, height: size }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                testID="raahi-logo-image"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
});

export default RaahiLogo;
