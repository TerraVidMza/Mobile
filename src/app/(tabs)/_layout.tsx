/**
 * Tab Layout — navegación principal de la app (protegida).
 *
 * 5 tabs: Inicio | Labores | Pesaje | Notificaciones | Ayuda
 * Con SyncStatusBar en el header global.
 */

import { View, StyleSheet, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSyncStore } from '../../stores/sync.store';
import { SyncStatusBar } from '../../components/sync/SyncStatusBar';
import { useAuthStore } from '../../stores/auth.store';
import { puede } from '../../utils/permisos';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Ícono de pestaña. La pestaña activa se resalta con una "píldora" de fondo
 * (violeta suave en claro, el tono de marca en oscuro) y el ícono relleno,
 * para que el capataz vea de un vistazo dónde está parado.
 */
function IconoPestania({
  nombre,
  nombreActivo,
  focused,
  color,
  size,
}: {
  nombre: IconName;
  nombreActivo: IconName;
  focused: boolean;
  color: ColorValue;
  size: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pildora,
        focused && { backgroundColor: theme.colors.primaryContainer },
      ]}
    >
      <MaterialCommunityIcons name={focused ? nombreActivo : nombre} size={size} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const theme = useTheme();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const user = useAuthStore((s) => s.user);
  // Edge-to-edge (M-018): la barra de navegación del teléfono se dibuja encima
  // de la app. Con altura fija, la de pestañas quedaba tapada por los botones
  // de Android; se suma el margen inferior real (M-020).
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <SyncStatusBar />
      <Tabs
        screenOptions={{
          // Claro: violeta profundo sobre la píldora lila. Oscuro: el tono de
          // marca (oliva) sobre su contenedor.
          tabBarActiveTintColor: theme.dark
            ? theme.colors.primary
            : theme.colors.onPrimaryContainer,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: '#E0E0E0',
            height: 60 + bottom,
            paddingBottom: 8 + bottom,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          // Mismo tono que el sidebar del Web (`--sidebar` en
          // index.css): un olivo saturado a todo el ancho quedaba muy
          // chillón como barra superior.
          headerStyle: {
            backgroundColor: theme.dark ? '#17110C' : '#4A3566',
          },
          headerTintColor: theme.dark ? '#F5EFE0' : '#F8F9FA',
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
            tabBarIcon: ({ color, size, focused }) => (
              <IconoPestania nombre="home-outline" nombreActivo="home" focused={focused} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="labores"
          options={{
            title: 'Labores',
            tabBarButtonTestID: 'tab-labores',
            headerTitle: 'Labores',
            tabBarIcon: ({ color, size, focused }) => (
              <IconoPestania nombre="clipboard-text-outline" nombreActivo="clipboard-text" focused={focused} color={color} size={size} />
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
            tabBarIcon: ({ color, size, focused }) => (
              <IconoPestania nombre="scale" nombreActivo="scale" focused={focused} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="notificaciones"
          options={{
            title: 'Avisos',
            tabBarButtonTestID: 'tab-avisos',
            headerTitle: 'Notificaciones',
            tabBarIcon: ({ color, size, focused }) => (
              <IconoPestania nombre="bell-outline" nombreActivo="bell" focused={focused} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="ayuda"
          options={{
            title: 'Ayuda',
            tabBarButtonTestID: 'tab-ayuda',
            headerTitle: 'Ayuda',
            tabBarIcon: ({ color, size, focused }) => (
              <IconoPestania nombre="help-circle-outline" nombreActivo="help-circle" focused={focused} color={color} size={size} />
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
  pildora: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
