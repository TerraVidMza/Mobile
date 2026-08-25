/**
 * Pantalla de Notificaciones y Avisos — HU-35.
 *
 * Criterios:
 * - Historial paginado ordenado por fecha descendente.
 * - Muestra título, descripción, timestamp y estado (leída/no leída).
 * - Marcar individualmente o todas como leídas.
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { notificacionesService } from '../../../services/notificaciones.service';
import type { Notificacion } from '../../../types/api.types';

export default function NotificacionesScreen() {
  const theme = useTheme();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidasCount, setNoLeidasCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    setRefreshing(true);
    try {
      const response = await notificacionesService.getMine(targetPage, 20);
      if (resetPage) {
        setNotificaciones(response.data);
        setPage(1);
      } else {
        setNotificaciones((prev) => [...prev, ...response.data]);
      }
      setNoLeidasCount(response.noLeidas);
    } catch {
      // Manejo offline o error
    } finally {
      setRefreshing(false);
    }
  }, [page]);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData]),
  );

  async function handleMarcarLeida(id: string) {
    try {
      await notificacionesService.marcarLeida(id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
      );
      setNoLeidasCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignorar error
    }
  }

  async function handleMarcarTodasLeidas() {
    try {
      await notificacionesService.marcarTodasLeidas();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidasCount(0);
    } catch {
      // Ignorar error
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header con botón para marcar todas como leídas */}
      {noLeidasCount > 0 && (
        <View style={styles.headerBar}>
          <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: '600' }}>
            {noLeidasCount} no leída{noLeidasCount > 1 ? 's' : ''}
          </Text>
          <Button mode="text" onPress={handleMarcarTodasLeidas} compact>
            Marcar todas como leídas
          </Button>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="bell-check-outline"
              size={48}
              color={theme.colors.outline}
            />
            <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              No tenés notificaciones pendientes
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={[
              styles.card,
              !item.leida && {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.primary,
                borderWidth: 1,
              },
            ]}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" style={{ fontWeight: item.leida ? '600' : '700', flex: 1 }}>
                  {item.titulo}
                </Text>
                {!item.leida && (
                  <Chip compact style={{ backgroundColor: theme.colors.primaryContainer }}>
                    Nueva
                  </Chip>
                )}
              </View>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {item.descripcion}
              </Text>

              <View style={styles.cardFooter}>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('es-AR') : ''}
                </Text>
                {!item.leida && (
                  <Button
                    mode="text"
                    compact
                    onPress={() => handleMarcarLeida(item.id)}
                  >
                    Marcar leída
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 10,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
