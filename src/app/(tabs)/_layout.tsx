/**
 * Tab Layout — navegación principal de la app (protegida).
 *
 * 4 tabs: Inicio | Labores | Pesaje | Notificaciones
 * Con SyncStatusBar en el header global.
 */

import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSyncStore } from '../../stores/sync.store';
import { SyncStatusBar } from '../../components/sync/SyncStatusBar';

export default function TabLayout() {
  const theme = useTheme();
  const pendingCount = useSyncStore((s) => s.pendingCount);

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
          headerStyle: {
            backgroundColor: theme.colors.primary,
          },
          headerTintColor: theme.colors.onPrimary,
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
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
            headerTitle: 'Labores',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="clipboard-text-outline" size={size} color={color} />
            ),
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
        <Tabs.Screen
          name="pesaje"
          options={{
            title: 'Pesaje',
            headerTitle: 'Pesaje de vendimia',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="scale" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notificaciones"
          options={{
            title: 'Avisos',
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
