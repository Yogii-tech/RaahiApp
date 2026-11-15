import React from 'react';
import {
     View,
     Text,
     StyleSheet,
     ImageBackground,
     TouchableOpacity,
     StatusBar,
} from 'react-native';
import BrandLogo from '../components/BrandLogo';
import { getGlassSurfaceStyle } from '../styles/glassmorphism';

interface WelcomeScreenProps {
     onGetStarted: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
     return (
          <View style={styles.container}>
               <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
               <ImageBackground
                    source={require('../assets/welcome_bg.png')}
                    style={styles.background}
                    resizeMode="cover"
               >
                    <View style={styles.content}>
                         <View style={[getGlassSurfaceStyle(false, 'card'), styles.header]}>
                              <BrandLogo
                                   size="lg"
                                   wordmarkColor="#0056D2"
                                   wordmarkStyle={styles.titleWeight}
                                   testID="welcome-brand-logo"
                              />
                              <Text style={styles.subtitle}>Local trusted rides</Text>
                         </View>

                         <TouchableOpacity
                              style={styles.button}
                              onPress={onGetStarted}
                              activeOpacity={0.8}
                         >
                              <Text style={styles.buttonText}>Get Started</Text>
                         </TouchableOpacity>
                    </View>
               </ImageBackground>
          </View>
     );
};

const styles = StyleSheet.create({
     container: {
          flex: 1,
     },
     background: {
          flex: 1,
          width: '100%',
          height: '100%',
     },
     content: {
          flex: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 60,
          backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle overlay
     },
     header: {
          alignItems: 'center',
          marginTop: 156,
          paddingVertical: 28,
          paddingHorizontal: 36,
          borderRadius: 28,
     },
     titleWeight: {
          fontWeight: '800',
     },
     subtitle: {
          fontSize: 18,
          color: '#222260',
          marginTop: 8,
          fontWeight: '500',
          opacity: 0.8,
     },
     button: {
          backgroundColor: 'rgba(74, 144, 226, 0.9)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.55)',
          paddingVertical: 18,
          paddingHorizontal: 80,
          borderRadius: 30,
          shadowColor: '#222260',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 6,
          marginBottom: 40,
     },
     buttonText: {
          color: '#FFFFFF',
          fontSize: 20,
          fontWeight: '700',
     },
});

export default WelcomeScreen;
