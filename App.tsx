import React, { useState, useEffect } from 'react';
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://08643806a6b5a3818e9508d0b2849b38@o4508492061245440.ingest.us.sentry.io/4508492067799040",
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,
  _experiments: {
    // profilesSampleRate is relative to tracesSampleRate.
    // Setting this to 1.0 will profile 100% of transactions.
    profilesSampleRate: 1.0,
  },
});

import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { API_BASE } from './src/apiConfig';
import { apiRequest } from './src/utils/api';
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import HomeScreen from './src/screens/HomeScreen';
import TripsScreen from './src/screens/TripsScreen';
import RequestsOverlay from './src/screens/RequestsOverlay';
import AccountScreen from './src/screens/AccountScreen';
import MapScreen from './src/screens/MapScreen';
import ChatScreen from './src/screens/ChatScreen';
import Icon from 'react-native-vector-icons/Ionicons';
import WelcomeScreen from './src/screens/WelcomeScreen';

const linking = {
  prefixes: ['http://localhost:3000', 'raahi://'],
  config: {
    screens: {
      Home: 'Home',
      Trips: 'Trips',
      Map: 'Map',
      Account: 'Account',
    },
  },
};

const Tab = createBottomTabNavigator();

// ─── Custom Header ───────────────────────────────────────────────────
function AppHeader({ onToggleNotifications, notificationCount = 0 }: { onToggleNotifications?: () => void, notificationCount?: number }) {
  const { isDark, toggleTheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View
      style={[
        headerStyles.container,
        {
          paddingTop: insets.top + 12,
          backgroundColor: colors.background,
        },
      ]}>
      {/* Logo */}
      <View style={headerStyles.logoContainer}>
        <Image
          source={require('./src/assets/logo_brand.png')}
          style={headerStyles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={[headerStyles.title, { color: colors.primary }]}>
        GoRaahi
      </Text>

      <View style={headerStyles.spacer} />

      {/* Theme Toggle */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={[
          headerStyles.themeButton,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(91, 79, 255, 0.05)',
            borderColor: 'transparent',
          },
        ]}
        activeOpacity={0.7}>
        <Icon name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={isDark ? '#FBC02D' : '#5B4FFF'} />
      </TouchableOpacity>

      {/* Notification Bell */}
      <View style={{ width: 10 }} />
      <TouchableOpacity
        onPress={onToggleNotifications}
        style={[
          headerStyles.themeButton,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(91, 79, 255, 0.05)',
            borderColor: 'transparent',
          },
        ]}
        activeOpacity={0.7}>
        <View>
          <Icon name="notifications-outline" size={22} color={isDark ? '#FBC02D' : '#5B4FFF'} />
          {notificationCount > 0 && (
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>{notificationCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 50,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: -0.5,
  },
  spacer: {
    flex: 1,
  },
  themeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  themeIcon: {
    fontSize: 18,
  },
  gap: {
    width: 12,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00695C',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  onlineIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  onlineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#FF4081',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

// ─── Tab Icons ───────────────────────────────────────────────────────
const tabIcons: Record<string, { default: string; focused: string }> = {
  Home: { default: 'home-outline', focused: 'home' },
  Trips: { default: 'car-sport-outline', focused: 'car-sport' },
  ParcelTrips: { default: 'cube-outline', focused: 'cube' },
  Map: { default: 'map-outline', focused: 'map' },
  History: { default: 'time-outline', focused: 'time' },
  Account: { default: 'person-outline', focused: 'person' },
};

// ─── Main Tab Navigator ──────────────────────────────────────────────
function MainTabs() {
  const { colors, isDark } = useTheme();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [parcelMode, setParcelMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');
  const insets = useSafeAreaInsets();

  const isDriver = user?.role === 'driver';

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 10000);
    return () => clearInterval(interval);
  }, [user, token]);

  const fetchNotificationCount = async () => {
    try {
      if (!token) return;
      const endpoint = isDriver ? '/api/rides/requests' : '/api/rides/bookings';
      const response = await apiRequest(endpoint, {}, logout);
      if (response.ok) {
        const data = await response.json() || [];
        // Filter: Driver sees UNVIEWED 'pending' reqs, Passenger sees UNVIEWED 'accepted' or 'rejected'
        const reqCount = data.filter((b: any) =>
          isDriver
            ? (b.status === 'pending' && !b.viewedByDriver)
            : ((b.status === 'accepted' || b.status === 'rejected') && !b.viewedByPassenger)
        ).length;

        // Add unread chat counts
        const unreadChatTotal = data.reduce((sum: number, b: any) => sum + (b.unreadChatCount || 0), 0);
        setNotificationCount(reqCount + unreadChatTotal);
      }
    } catch (err) {
      console.error('Badge poll fail:', err);
    }
  };

  const handleMarkViewed = async () => {
    try {
      if (!token) return;
      await apiRequest(`/api/rides/viewed?role=${isDriver ? 'driver' : 'passenger'}`, {
        method: 'POST'
      }, logout);
      setNotificationCount(0);
    } catch (err) {
      console.error('Mark viewed fail:', err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {currentRoute !== 'Map' && (
        <AppHeader
          notificationCount={notificationCount}
          onToggleNotifications={() => {
            const newState = !notificationsVisible;
            setNotificationsVisible(newState);
            if (newState) handleMarkViewed();
          }}
        />
      )}

      <Tab.Navigator
        screenListeners={{
          state: (e) => {
            const route = e.data.state.routes[e.data.state.index];
            setCurrentRoute(route.name);
          },
        }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => {
            const isParcelMode = user?.role === 'parceller' || parcelMode;
            const isParcelTrips = route.name === 'Trips' && isParcelMode;

            let icon;
            if (isParcelTrips) {
              icon = tabIcons.ParcelTrips;
            } else if (route.name === 'Map' && isParcelMode) {
              icon = tabIcons.History;
            } else {
              icon = tabIcons[route.name];
            }

            return (
              <View>
                <Icon
                  name={focused ? icon.focused : icon.default}
                  size={24}
                  color={focused ? colors.primary : colors.subtextColor}
                />
              </View>
            );
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subtextColor,
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            backgroundColor: colors.background,
            borderTopColor: colors.borderColor,
            display: notificationsVisible || activeChat ? 'none' : 'flex'
          },
        })}
      >
        <Tab.Screen name="Home">
          {props => <HomeScreen {...props} setParcelMode={setParcelMode} />}
        </Tab.Screen>
        <Tab.Screen
          name="Trips"
          children={(props) => <TripsScreen {...props} isParcelMode={user?.role === 'parceller' || parcelMode} />}
          options={{ title: (user?.role === 'parceller' || parcelMode) ? t('tab.trackPackage') : t('tab.trips') }}
        />
        <Tab.Screen
          name="Map"
          children={(props) => {
            const isParcel = user?.role === 'parceller' || parcelMode;
            if (isParcel) {
              return <TripsScreen {...props} isParcelMode={false} isParcelHistory={true} title={t('tab.history')} />;
            }
            return <MapScreen />;
          }}
          options={{ title: (user?.role === 'parceller' || parcelMode) ? t('tab.history') : t('tab.map') }}
        />
        <Tab.Screen
          name="Account"
          children={(props) => <AccountScreen {...props} isParcelMode={user?.role === 'parceller' || parcelMode} />}
          options={{ title: t('tab.account') }}
        />
      </Tab.Navigator>

      {notificationsVisible && (
        <View style={[StyleSheet.absoluteFill, { top: insets.top + 64, bottom: 0, backgroundColor: colors.background, zIndex: 100, elevation: 10 }]}>
          <RequestsOverlay
            onClose={() => setNotificationsVisible(false)}
            onOpenChat={(booking) => {
              setActiveChat(booking);
              setNotificationsVisible(false);
            }}
          />
        </View>
      )}

      {activeChat && (
        <View style={StyleSheet.absoluteFill}>
          <ChatScreen
            bookingId={activeChat.id}
            recipientName={isDriver ? activeChat.passengerName || "Passenger" : activeChat.ride?.driverName || "Driver"}
            recipientPhone={activeChat.type === 'parcel' ? activeChat.contactNumber : (isDriver ? activeChat.passengerPhone : activeChat.driverPhone)}
            pickup={activeChat.ride?.pickup}
            dropoff={activeChat.ride?.dropoff}
            pickupLat={activeChat.ride?.pickupLat}
            pickupLng={activeChat.ride?.pickupLng}
            dropoffLat={activeChat.ride?.dropoffLat}
            dropoffLng={activeChat.ride?.dropoffLng}
            departureTime={activeChat.ride?.departureTime}
            onBack={() => setActiveChat(null)}
          />
        </View>
      )}
    </View>
  );
}

function SosScreenTab() {
  const { colors } = useTheme();
  return (
    <View style={[tabStyles.sosPlaceholder, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.textColor, fontSize: 16 }}>
        Tap the SOS tab for emergency options
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
  tabIconFocused: { fontSize: 24 },
  sosPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  }
});

function RootApp() {
  const { isAuthenticated, user, isInitialLoading } = useAuth();
  const { isDark } = useTheme();
  const [welcomeDone, setWelcomeDone] = useState(false);

  if (isInitialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <WelcomeScreen onGetStarted={() => { }} />
      </View>
    );
  }

  if (!isAuthenticated && !welcomeDone) {
    return <WelcomeScreen onGetStarted={() => setWelcomeDone(true)} />;
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <LoginScreen onAuthenticated={() => { }} />
      </View>
    );
  }

  // Admin users get the dedicated admin dashboard
  if (user?.role === 'admin') {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <AdminDashboardScreen />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <MainTabs />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider
      style={{ flex: 1, ...(Platform.OS === 'web' ? ({ height: '100dvh' } as any) : {}) }}
      initialMetrics={Platform.OS === 'web' ? { frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } } : initialWindowMetrics || undefined}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <View style={{ flex: 1, backgroundColor: '#181F2A', ...(Platform.OS === 'web' ? ({ height: '100dvh' } as any) : {}) }}>
              <RootApp />
            </View>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
