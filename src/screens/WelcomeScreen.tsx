import React from 'react';
import {
     View,
     Text,
     StyleSheet,
     ImageBackground,
     TouchableOpacity,
     StatusBar,
     Platform,
} from 'react-native';

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
                         <View style={styles.header}>
                              <Text style={styles.title}>GoRaahi</Text>
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
          marginTop: 180,
     },
     title: {
          fontSize: 48,
          fontWeight: '800',
          color: '#0056D2',
          letterSpacing: -1,
     },
     subtitle: {
          fontSize: 18,
          color: '#222260',
          marginTop: 8,
          fontWeight: '500',
          opacity: 0.8,
     },
     button: {
          backgroundColor: '#4A90E2',
          paddingVertical: 18,
          paddingHorizontal: 80,
          borderRadius: 30,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 5,
          marginBottom: 40,
     },
     buttonText: {
          color: '#FFFFFF',
          fontSize: 20,
          fontWeight: '700',
     },
});

export default WelcomeScreen;
