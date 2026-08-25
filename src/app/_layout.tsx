/**
 * Root Layout — punto de entrada de Expo Router.
 *
 * Responsabilidades:
 * 1. Restaura la sesión desde SecureStore al arrancar.
 * 2. Inicializa el monitor de conectividad (NetInfo → auto sync en ≤5s).
 * 3. Registra notificaciones push (FCM / expo-notifications).
 * 4. Controla el Auth Gate de redirección.
 * 5. Provee el theme de React Native Paper.
 */

import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, ActivityIndicator } from 'react-native-paper';
import { useColorScheme, View, StyleSheet, Platform } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { initConnectivityMonitor } from '../sync/connectivity-monitor';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { OfflineBanner } from '../components/sync/OfflineBanner';

// Mantiene el splash visible mientras cargamos la sesión (solo en nativo)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// ─── TerraVid Theme ──────────────────────────────────────────────────────────

const terravidColors = {
  primary: '#1B5E20',
  primaryContainer: '#C8E6C9',
  secondary: '#33691E',
  secondaryContainer: '#DCEDC8',
  tertiary: '#E65100',
  tertiaryContainer: '#FFE0B2',
  error: '#B71C1C',
  errorContainer: '#FFCDD2',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F8E9',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#1B5E20',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#33691E',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...terravidColors,
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#81C784',
    primaryContainer: '#1B5E20',
    secondary: '#AED581',
    secondaryContainer: '#33691E',
    surface: '#121212',
    surfaceVariant: '#1E1E1E',
    onSurface: '#E0E0E0',
    onSurfaceVariant: '#BDBDBD',
  },
};

// ─── Auth Gate ────────────────────────────────────────────────────────────────

function useProtectedRoute(isMounted: boolean) {
  const { isAuthenticated, isLoading, debeCambiarPassword } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isMounted || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    const timer = setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (isAuthenticated && inAuthGroup) {
        if (debeCambiarPassword) {
          router.replace('/cambiar-password');
        } else {
          router.replace('/(tabs)');
        }
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [isMounted, isAuthenticated, isLoading, debeCambiarPassword, segments, router]);
}

// ─── Root Layout Component ──────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const { restore, isLoading } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useProtectedRoute(isMounted);
  useNotificaciones();

  useEffect(() => {
    const cleanupNet = initConnectivityMonitor();

    async function init() {
      await restore();
      setIsMounted(true);
      if (Platform.OS !== 'web') {
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    init();

    return () => {
      cleanupNet();
    };
  }, [restore]);

  return (
    <PaperProvider theme={theme}>
      <View style={styles.container}>
        <OfflineBanner />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <Slot />
        )}
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
