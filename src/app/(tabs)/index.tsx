/**
 * Pantalla Home — resumen del día y estado de sincronización.
 *
 * Muestra al Capataz:
 * - Estado de conectividad y sincronización.
 * - Resumen de labores y pesajes registrados hoy.
 * - Accesos rápidos a las acciones principales.
 */

import { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Chip, useTheme } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../stores/auth.store';
import { useSyncStore } from '../../stores/sync.store';
import { syncEngine } from '../../sync/sync-engine';
import { haptics } from '../../utils/haptics';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { pendingCount, isConnected, status } = useSyncStore();

  useFocusEffect(
    useCallback(() => {
      syncEngine.updatePendingCount();
    }, []),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Estado de sincronización */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content style={styles.syncCard}>
          <View style={styles.syncRow}>
            <MaterialCommunityIcons
              name={isConnected ? 'wifi' : 'wifi-off'}
              size={24}
              color={isConnected ? theme.colors.primary : theme.colors.error}
            />
            <Text variant="bodyLarge" style={{ marginLeft: 12 }}>
              {isConnected ? 'Conectado' : 'Sin conexión — Modo offline'}
            </Text>
          </View>
          {pendingCount > 0 && (
            <Chip icon="sync" style={{ marginTop: 12 }}>
              {pendingCount} registro{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </Chip>
          )}
          {status === 'syncing' && (
            <Chip icon="loading" style={{ marginTop: 8 }}>
              Sincronizando...
            </Chip>
          )}
        </Card.Content>
      </Card>

      {/* Saludo */}
      <Text variant="headlineSmall" style={[styles.greeting, { color: theme.colors.onSurface }]}>
        Hola, {user?.email?.split('@')[0] ?? 'Capataz'}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}>
        Rol: {user?.rol}
      </Text>

      {/* Acciones rápidas */}
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Acciones rápidas
      </Text>

      <Card
        style={styles.actionCard}
        onPress={() => {
          haptics.selection();
          router.push('/(tabs)/labores/nueva');
        }}
      >
        <Card.Content style={styles.actionContent}>
          <MaterialCommunityIcons name="clipboard-plus-outline" size={32} color={theme.colors.primary} />
          <View style={styles.actionText}>
            <Text variant="titleMedium">Registrar labor</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Cargar labores del día en el cuartel
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
        </Card.Content>
      </Card>

      <Card
        style={styles.actionCard}
        onPress={() => {
          haptics.selection();
          router.push('/(tabs)/pesaje/nuevo');
        }}
      >
        <Card.Content style={styles.actionContent}>
          <MaterialCommunityIcons name="scale" size={32} color={theme.colors.secondary} />
          <View style={styles.actionText}>
            <Text variant="titleMedium">Registrar pesaje</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Cargar kilos cosechados por cuadrilla
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
        </Card.Content>
      </Card>

      {/* Cerrar sesión */}
      <Button
        mode="outlined"
        icon="logout"
        onPress={async () => {
          await haptics.selection();
          await logout();
        }}
        style={styles.logoutButton}
        textColor={theme.colors.error}
      >
        Cerrar sesión
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 24,
    borderRadius: 16,
  },
  syncCard: {
    paddingVertical: 16,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontWeight: '700',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  actionCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionText: {
    flex: 1,
    marginLeft: 16,
  },
  logoutButton: {
    marginTop: 32,
    borderRadius: 12,
  },
});
