/**
 * Tab Layout — navegación principal de la app (protegida).
 *
 * 4 tabs: Inicio | Labores | Pesaje | Notificaciones
 * Con SyncStatusBar en el header global.
 */

import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSyncStore } from '../../stores/sync.store';
import { SyncStatusBar } from '../../components/sync/SyncStatusBar';
import { useAuthStore } from '../../stores/auth.store';
import { puede } from '../../utils/permisos';

export default function TabLayout() {
  const theme = useTheme();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.container}>
      <SyncStatusBar />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: '#E0E0E0',
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          // Mismo marrón oscuro que el sidebar del Web (`--sidebar` en
          // index.css): un olivo saturado a todo el ancho quedaba muy
          // chillón como barra superior.
          headerStyle: {
            backgroundColor: theme.dark ? '#17110C' : '#3E2B1F',
          },
          headerTintColor: '#F5EFE0',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarButtonTestID: 'tab-inicio',
            headerTitle: 'TerraVid',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="labores"
          options={{
            title: 'Labores',
            tabBarButtonTestID: 'tab-labores',
            headerTitle: 'Labores',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="clipboard-text-outline" size={size} color={color} />
            ),
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            // Sin el permiso la pestaña no se muestra (M-005).
            href: puede(user, 'laboresRegistro') ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="pesaje"
          options={{
            title: 'Pesaje',
            tabBarButtonTestID: 'tab-pesaje',
            headerTitle: 'Pesaje de vendimia',
            href: puede(user, 'pesajesRegistro') ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="scale" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notificaciones"
          options={{
            title: 'Avisos',
            tabBarButtonTestID: 'tab-avisos',
            headerTitle: 'Notificaciones',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
