import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Sentry from "@sentry/react-native";
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { registerFCM, unregisterFCM } from './src/services/fcmService';

import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  AppState,
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
// API_BASE is imported per-screen from './src/config/api' — not needed here
import { apiRequest } from './src/utils/api';
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import HomeScreen from './src/screens/HomeScreen';
import TripsScreen from './src/screens/TripsScreen';
import RequestsOverlay from './src/screens/RequestsOverlay';
import AccountScreen from './src/screens/AccountScreen';
import MapScreen from './src/screens/MapScreen';
import ChatScreen from './src/screens/ChatScreen';
import ResubmitDocsView from './src/screens/ResubmitDocsView';
import Icon from 'react-native-vector-icons/Ionicons';
import WelcomeScreen from './src/screens/WelcomeScreen';
import {
  pushSubViewHistory,
  replaceSubViewHistory,
  popSubViewHistory,
  useBrowserBack,
} from './src/utils/browserHistory';

// DSN is injected via __DEV__ webpack DefinePlugin / Metro env — never hardcoded
const sentryDsn = (typeof process !== 'undefined' && process.env?.SENTRY_DSN) || '';
if (Platform.OS !== 'web') {
  Sentry.init({
    dsn: sentryDsn,
    enabled: sentryDsn !== '',
    tracesSampleRate: typeof __DEV__ !== 'undefined' && __DEV__ ? 1.0 : 0.1,
    _experiments: {
      profilesSampleRate: typeof __DEV__ !== 'undefined' && __DEV__ ? 1.0 : 0.1,
    },
  });
}

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
function AppHeader({ onToggleNotifications, notificationCount = 0, onPressLogo }: { onToggleNotifications?: () => void, notificationCount?: number, onPressLogo?: () => void }) {
  const { isDark, toggleTheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();

  const handlePressLogo = () => {
    if (onPressLogo) {
      onPressLogo();
    } else {
      navigation.navigate('Home' as never);
    }
  };

  return (
    <View
      style={[
        headerStyles.container,
        {
          paddingTop: insets.top + 12,
          backgroundColor: colors.background,
        },
      ]}>
      {/* Clickable Logo and Title */}
      <TouchableOpacity
        onPress={handlePressLogo}
        style={headerStyles.brandContainer}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go to Home page">
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
      </TouchableOpacity>

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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
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
  const [rekycVisible, setRekycVisible] = useState(false);
  const [parcelMode, setParcelMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('Home');
  const insets = useSafeAreaInsets();
  const tabNavRef = useRef<any>(null);
  const navigation = useNavigation();

  const isDriver = user?.role === 'driver';
  const notificationsVisibleRef = useRef(notificationsVisible);
  notificationsVisibleRef.current = notificationsVisible;
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const rekycVisibleRef = useRef(rekycVisible);
  rekycVisibleRef.current = rekycVisible;
  const isMountedRef = useRef(true);
  const notifEpochRef = useRef(0);
  const latestPollIdRef = useRef(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const isDriverRef = useRef(isDriver);
  isDriverRef.current = isDriver;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const openOverlay = useCallback((target: 'notifications' | 'chat' | 'rekyc', chatBooking?: any) => {
    const hadOverlay = Boolean(
      notificationsVisibleRef.current || activeChatRef.current || rekycVisibleRef.current
    );
    const nextChat = target === 'chat' ? (chatBooking ?? null) : null;
    notificationsVisibleRef.current = target === 'notifications';
    activeChatRef.current = nextChat;
    rekycVisibleRef.current = target === 'rekyc';

    setNotificationsVisible(target === 'notifications');
    setActiveChat(nextChat);
    setRekycVisible(target === 'rekyc');

    if (hadOverlay) {
      replaceSubViewHistory(target);
    } else {
      pushSubViewHistory(target);
    }
  }, []);

  const closeAllOverlays = useCallback((popHistory = true) => {
    const hadOverlay = Boolean(
      notificationsVisibleRef.current || activeChatRef.current || rekycVisibleRef.current
    );
    notificationsVisibleRef.current = false;
    activeChatRef.current = null;
    rekycVisibleRef.current = false;
    setNotificationsVisible(false);
    setActiveChat(null);
    setRekycVisible(false);
    if (popHistory && hadOverlay) {
      popSubViewHistory();
    }
  }, []);

  const [isAppActive, setIsAppActive] = useState<boolean>(() => {
    if (Platform.OS === 'web') {
      return typeof document === 'undefined' || document.visibilityState === 'visible';
    }
    return AppState.currentState === 'active';
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const handleVisibilityChange = () => {
        setIsAppActive(document.visibilityState === 'visible');
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    const sub = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => sub?.remove?.();
  }, []);

  // ─── FCM: register when authenticated, unregister on logout ─────────────
  const handleFCMNavigate = useCallback((type: string, data: any) => {
    if (data?.action === 'rekyc') {
      openOverlay('rekyc');
      return;
    }
    switch (type) {
      case 'booking_request':
      case 'booking_status':
      case 'ride_started':
      case 'ride_completed':
      case 'document_verification':
      case 'admin_alert':
        openOverlay('notifications');
        break;
      case 'chat':
        if (data?.relatedId) {
          openOverlay('chat', { id: data.relatedId });
        } else {
          openOverlay('notifications');
        }
        break;
      default:
        openOverlay('notifications');
    }
  }, [openOverlay]);

  // Handle Cold-Start Web Deep Links (notification taps that open a new window)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
      const urlParams = new URLSearchParams(window.location.search);
      const chatId = urlParams.get('chat');
      const openRequests = urlParams.get('openRequests');
      const openTrips = urlParams.get('openTrips');
      const rekyc = urlParams.get('rekyc');

      // Clean up the URL first so replaceState doesn't clobber the pushed subView state
      if (chatId || openRequests || openTrips || rekyc) {
        window.history.replaceState({}, document.title, '/');
      }

      if (rekyc === 'true') {
        openOverlay('rekyc');
      } else if (chatId) {
        openOverlay('chat', { id: chatId });
      } else if (openRequests === 'true' || openTrips === 'true') {
        openOverlay('notifications');
      }
    }
  }, [user, openOverlay]);

  const fcmRegisteredTokenRef = useRef<string | null>(null);
  const activeTokenRef = useRef<string | null>(token);
  activeTokenRef.current = token;

  useEffect(() => {
    if (token && !fcmRegisteredTokenRef.current) {
      fcmRegisteredTokenRef.current = token;
      registerFCM(token, handleFCMNavigate);
    } else if (!token && fcmRegisteredTokenRef.current) {
      const lastToken = fcmRegisteredTokenRef.current;
      fcmRegisteredTokenRef.current = null;
      unregisterFCM(lastToken);
    }
  }, [token, handleFCMNavigate]);

  useEffect(() => {
    return () => {
      if (fcmRegisteredTokenRef.current) {
        const lastToken = activeTokenRef.current || fcmRegisteredTokenRef.current;
        fcmRegisteredTokenRef.current = null;
        unregisterFCM(lastToken);
      }
    };
  }, []);
  // ────────────────────────────────────────────────────────────────────────


  useBrowserBack(Boolean(notificationsVisible || activeChat || rekycVisible), () => {
    closeAllOverlays(false);
  });

  const fetchNotificationCount = useCallback(async () => {
    try {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      const pollId = ++latestPollIdRef.current;
      const startEpoch = notifEpochRef.current;
      const driver = isDriverRef.current;
      const endpoint = driver ? '/api/rides/requests' : '/api/rides/bookings';
      const response = await apiRequest(endpoint, {}, logoutRef.current);

      let reqCount = 0;
      let unreadChatTotal = 0;

      if (response.ok) {
        const data = await response.json() || [];
        // Filter: Driver sees UNVIEWED 'pending' reqs, Passenger sees UNVIEWED 'accepted' or 'rejected'
        reqCount = data.filter((b: any) =>
          driver
            ? (b.status === 'pending' && !b.viewedByDriver)
            : ((b.status === 'accepted' || b.status === 'rejected') && !b.viewedByPassenger)
        ).length;

        // Add unread chat counts
        unreadChatTotal = data.reduce((sum: number, b: any) => sum + (b.unreadChatCount || 0), 0);
      }

      // Also count unread system notifications (e.g. document approved/rejected)
      let systemNotifCount = 0;
      try {
        const notifResponse = await apiRequest('/api/notifications/', {}, logoutRef.current);
        if (notifResponse.ok) {
          const notifs = await notifResponse.json() || [];
          systemNotifCount = notifs.filter((n: any) => !n.read).length;
        }
      } catch (_) { /* ignore */ }

      if (!isMountedRef.current || notifEpochRef.current !== startEpoch || latestPollIdRef.current !== pollId) {
        return;
      }
      setNotificationCount(reqCount + unreadChatTotal + systemNotifCount);
    } catch (err) {
      console.error('Badge poll fail:', err);
    }
  }, []);

  useEffect(() => {
    if (!token || !isAppActive) return;
    fetchNotificationCount();
    const interval = setInterval(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Platform.OS !== 'web' && AppState.currentState !== 'active') return;
      fetchNotificationCount();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, token, isAppActive, fetchNotificationCount]);

  const handleMarkViewed = async () => {
    try {
      if (!tokenRef.current) return;
      notifEpochRef.current += 1;
      setNotificationCount(0);
      await apiRequest(`/api/rides/viewed?role=${isDriverRef.current ? 'driver' : 'passenger'}`, {
        method: 'POST'
      }, logoutRef.current);
    } catch (err) {
      console.error('Mark viewed fail:', err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {(
        <AppHeader
          notificationCount={notificationCount}
          onPressLogo={() => {
            closeAllOverlays(true);
            setParcelMode(false);
            navigation.navigate('Home' as never);
          }}
          onToggleNotifications={() => {
            if (!notificationsVisibleRef.current) {
              openOverlay('notifications');
              handleMarkViewed();
            } else {
              closeAllOverlays(true);
            }
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
            } else if (route.name === 'History') {
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
            display: notificationsVisible || activeChat || rekycVisible ? 'none' : 'flex'
          },
        })}
      >
        <Tab.Screen name="Home">
          {props => <HomeScreen {...props} setParcelMode={setParcelMode} />}
        </Tab.Screen>
        <Tab.Screen
          name="Trips"
          children={(props) => <TripsScreen 
            {...props} 
            isParcelMode={user?.role === 'parceller' || parcelMode} 
            onOpenChat={(booking) => openOverlay('chat', booking)}
          />}
          options={{ title: (user?.role === 'parceller' || parcelMode) ? t('tab.trackPackage') : t('tab.trips') }}
        />
        <Tab.Screen
          name="History"
          children={(props) => {
            const isParcel = user?.role === 'parceller' || parcelMode;
            return <TripsScreen 
              {...props} 
              isParcelMode={false} 
              isParcelHistory={isParcel} 
              isRideHistory={!isParcel} 
              title={t('tab.history')} 
              onOpenChat={(booking) => openOverlay('chat', booking)}
            />;
          }}
          options={{ title: t('tab.history') }}
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
            onClose={() => closeAllOverlays(true)}
            onOpenChat={(booking) => openOverlay('chat', booking)}
          />
        </View>
      )}

      {activeChat && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}>
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
            onBack={() => closeAllOverlays(true)}
          />
        </View>
      )}

      {rekycVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1100, elevation: 1100, backgroundColor: colors.background }]}>
          <ResubmitDocsView
            disableBrowserBack
            onClose={() => closeAllOverlays(true)}
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
  const wasAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      setWelcomeDone(false);
    }
    wasAuthenticatedRef.current = isAuthenticated;

    if (isAuthenticated && Platform.OS === 'web' && typeof window !== 'undefined') {
      const subView = window.history.state?.subView;
      if (typeof subView === 'string' && subView.startsWith('login')) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    }
  }, [isAuthenticated]);

  useBrowserBack(welcomeDone && !isAuthenticated, () => {
    setWelcomeDone(false);
  });

  if (isInitialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <WelcomeScreen onGetStarted={() => { }} />
      </View>
    );
  }

  if (!isAuthenticated && !welcomeDone) {
    return <WelcomeScreen onGetStarted={() => {
      pushSubViewHistory('login');
      setWelcomeDone(true);
    }} />;
  }

  if (!isAuthenticated || (!user?.name || !user?.role)) {
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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default Platform.OS === 'web' ? App : Sentry.wrap(App);
