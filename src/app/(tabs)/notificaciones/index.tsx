/**
 * Pantalla de Notificaciones y Avisos — HU-35.
 *
 * Criterios:
 * - Historial paginado ordenado por fecha descendente: carga 20 y trae la
 *   página siguiente al llegar al final de la lista (M-006).
 * - Tocar una notificación con `urlAccion` lleva a la pantalla que indica.
 * - Muestra título, descripción, timestamp y estado (leída/no leída).
 * - Marcar individualmente o todas como leídas.
 */

import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { notificacionesService } from '../../../services/notificaciones.service';
import type { Notificacion } from '../../../types/api.types';
import { rutaDeAccion } from '../../../utils/notificaciones';

const POR_PAGINA = 20;

export default function NotificacionesScreen() {
  const theme = useTheme();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidasCount, setNoLeidasCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // Ref y no estado: `onEndReached` puede dispararse varias veces seguidas y
  // tiene que ver la página y el "cargando" actuales, no los de su render.
  const paginacion = useRef({ pagina: 0, totalPaginas: 1, cargando: false });

  const cargar = useCallback(async (desdeCero: boolean) => {
    const p = paginacion.current;
    if (p.cargando || (!desdeCero && p.pagina >= p.totalPaginas)) return;
    p.cargando = true;
    if (desdeCero) setRefreshing(true);
    const pagina = desdeCero ? 1 : p.pagina + 1;
    try {
      const response = await notificacionesService.getMine(pagina, POR_PAGINA);
      p.pagina = pagina;
      p.totalPaginas = response.totalPages;
      setNotificaciones((prev) => (desdeCero ? response.data : [...prev, ...response.data]));
      setNoLeidasCount(response.noLeidas);
      setError(null);
    } catch {
      setError('No se pudieron cargar las notificaciones. Deslizá hacia abajo para reintentar.');
    } finally {
      p.cargando = false;
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar(true);
    }, [cargar]),
  );

  async function abrir(item: Notificacion) {
    if (!item.leida) await handleMarcarLeida(item.id);
    const ruta = rutaDeAccion(item.urlAccion);
    if (ruta) router.push(ruta);
  }

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
          <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} />
        }
        onEndReached={() => void cargar(false)}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          error ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.error, marginBottom: 12 }}>
              {error}
            </Text>
          ) : null
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
            onPress={() => void abrir(item)}
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
