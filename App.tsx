/**
 * Raahi App - React Native
 * Converted from Flutter/Dart codebase
 */

import React, { useState, useEffect } from 'react';
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
import SosScreen from './src/screens/SosScreen';
import ChatScreen from './src/screens/ChatScreen';

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
      <Image
        source={require('./src/assets/raahi_logo.png')}
        style={headerStyles.logo}
        resizeMode="contain"
      />
      <Text style={[headerStyles.title, { color: colors.primary }]}>
        Raahi
      </Text>

      <View style={headerStyles.spacer} />

      {/* Theme Toggle */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={[
          headerStyles.themeButton,
          {
            borderColor: isDark ? '#222260' : '#5B4FFF',
          },
        ]}
        activeOpacity={0.7}>
        <Text style={headerStyles.themeIcon}>
          {isDark ? '☀️' : '🌙'}
        </Text>
      </TouchableOpacity>

      {/* Notification Bell */}
      <View style={headerStyles.gap} />
      <TouchableOpacity
        onPress={onToggleNotifications}
        style={[
          headerStyles.themeButton,
          {
            borderColor: isDark ? '#222260' : '#5B4FFF',
          },
        ]}
        activeOpacity={0.7}>
        <View>
          <Text style={headerStyles.themeIcon}>🔔</Text>
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
    paddingBottom: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  spacer: {
    flex: 1,
  },
  themeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
  Home: { default: '🏠', focused: '🏠' },
  Trips: { default: '🚗', focused: '🚗' },
  SOS: { default: '⚠️', focused: '⚠️' },
  Account: { default: '👤', focused: '👤' },
};

// ─── Main Tab Navigator ──────────────────────────────────────────────
function MainTabs() {
  const { colors, isDark } = useTheme();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const [sosVisible, setSosVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [activeChat, setActiveChat] = useState<any>(null);
  const insets = useSafeAreaInsets();

  const isDriver = user?.role === 'driver';

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 5000);
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
      <AppHeader
        notificationCount={notificationCount}
        onToggleNotifications={() => {
          const newState = !notificationsVisible;
          setNotificationsVisible(newState);
          if (newState) handleMarkViewed();
        }}
      />

      <SosScreen visible={sosVisible} onClose={() => setSosVisible(false)} />

      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => {
            const icon = tabIcons[route.name];
            return (
              <View style={route.name === 'SOS' ? tabStyles.sosIconContainer : null}>
                <Text style={[
                  route.name === 'SOS' ? tabStyles.sosIcon : tabStyles.tabIcon,
                  focused && route.name !== 'SOS' ? tabStyles.tabIconFocused : null
                ]}>
                  {focused ? icon.focused : icon.default}
                </Text>
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
            display: sosVisible || notificationsVisible || activeChat ? 'none' : 'flex'
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tab.home') }} />
        <Tab.Screen name="Trips" component={TripsScreen} options={{ title: t('tab.trips') }} />
        <Tab.Screen
          name="SOS"
          component={SosScreenTab}
          options={{ title: t('tab.sos') }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setSosVisible(true);
            },
          }}
        />
        <Tab.Screen name="Account" component={AccountScreen} options={{ title: t('tab.account') }} />
      </Tab.Navigator>

      {sosVisible && (
        <SosScreen visible={sosVisible} onClose={() => setSosVisible(false)} />
      )}

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
            pickup={activeChat.ride?.pickup}
            dropoff={activeChat.ride?.dropoff}
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
  sosIconContainer: {
    backgroundColor: '#C62828',
    borderRadius: 17,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosIcon: { fontSize: 18, color: '#FFFFFF' },
  sosPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

function RootApp() {
  const { isAuthenticated, user, isInitialLoading } = useAuth();
  const { isDark } = useTheme();

  if (isInitialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff' }}>Loading Raahi...</Text>
      </View>
    );
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
    <NavigationContainer>
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

export default App;
