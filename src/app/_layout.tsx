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
import { StatusBar } from 'expo-status-bar';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/auth.store';
import { initConnectivityMonitor } from '../sync/connectivity-monitor';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { OfflineBanner } from '../components/sync/OfflineBanner';
import { PantallaBloqueo } from '../components/auth/PantallaBloqueo';
import { solarTheme, useThemeStore } from '../stores/theme.store';

// Mantiene el splash visible mientras cargamos la sesión (solo en nativo)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// ─── TerraVid Theme ──────────────────────────────────────────────────────────
//
// Misma paleta de marca que `Web/src/index.css` (tierra/oliva del viñedo),
// mapeada a los roles de color de Material Design 3. Antes esto era un verde
// bosque genérico sin relación con el resto del sistema.

const terravidColorsLight = {
  primary: '#5C6B2E',
  onPrimary: '#FFFFFF',
  primaryContainer: '#A4B560',
  onPrimaryContainer: '#1F1810',
  secondary: '#7A6A5A',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F5EFE0',
  onSecondaryContainer: '#1F1810',
  tertiary: '#D35400',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFE0B2',
  error: '#C0392B',
  onError: '#FFFFFF',
  errorContainer: '#F5D6D1',
  surface: '#FFFFFF',
  surfaceVariant: '#F5EFE0',
  onSurface: '#1F1810',
  onSurfaceVariant: '#7A6A5A',
  outline: '#D1CECC',
  background: '#FAF6EE',
  onBackground: '#1F1810',
};

const terravidColorsDark = {
  primary: '#A4B560',
  onPrimary: '#1F1810',
  primaryContainer: '#5C6B2E',
  onPrimaryContainer: '#F5EFE0',
  secondary: '#C4A882',
  onSecondary: '#1F1810',
  secondaryContainer: '#443428',
  onSecondaryContainer: '#F5EFE0',
  tertiary: '#E67E22',
  onTertiary: '#1F1810',
  tertiaryContainer: '#443428',
  error: '#E0574A',
  onError: '#1F1810',
  errorContainer: '#5A4636',
  surface: '#362A20',
  surfaceVariant: '#443428',
  onSurface: '#F5EFE0',
  onSurfaceVariant: '#C4A882',
  outline: '#5A4636',
  background: '#1A130D',
  onBackground: '#F5EFE0',
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...terravidColorsLight,
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...terravidColorsDark,
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
    const enCambioPassword = segments[0] === 'cambiar-password';

    const timer = setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (isAuthenticated && debeCambiarPassword && !enCambioPassword) {
        // Desde cualquier pantalla, no solo al salir del login: una sesión
        // restaurada con la contraseña temporal entraba directo a las pestañas
        // (M-006).
        router.replace('/cambiar-password');
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
  const modo = useThemeStore((s) => s.mode);
  // El modo solar (alto contraste para leer bajo el sol) gana sobre el del
  // sistema; si no, se sigue al sistema (M-008).
  const theme =
    modo === 'solar'
      ? solarTheme
      : modo === 'dark' || colorScheme === 'dark'
        ? darkTheme
        : lightTheme;
  const { restore, isLoading, bloqueada } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  useProtectedRoute(isMounted);
  useNotificaciones();

  useEffect(() => {
    const cleanupNet = initConnectivityMonitor();

    async function init() {
      try {
        await Promise.all([restore(), useThemeStore.getState().restaurar()]);
      } finally {
        // Si falla la restauración, la app arranca igual (sin sesión) en vez
        // de quedar trabada en el splash.
        setIsMounted(true);
        if (Platform.OS !== 'web') {
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }
    void init();

    return () => {
      cleanupNet();
    };
  }, [restore]);

  // Desde SDK 54 la app se dibuja detrás de la barra de estado también en
  // Android 14 (edge-to-edge). El margen de arriba se reserva acá, una sola
  // vez, y las pantallas reciben top 0: así los avisos (sin conexión,
  // pendientes) no quedan debajo de la hora y el header no lo suma dos veces
  // (M-018).
  const insets = useSafeAreaInsets();

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: theme.colors.background },
        ]}
      >
        <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
          <OfflineBanner />
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : bloqueada ? (
            <PantallaBloqueo />
          ) : (
            <Slot />
          )}
        </SafeAreaInsetsContext.Provider>
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
