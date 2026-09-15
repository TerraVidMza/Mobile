/**
 * Historial y Lista de Labores (HU-12, HU-14, HU-15, HU-17).
 *
 * Filtros por:
 * - Pestaña: "Hoy" vs "Pendientes / Errores" vs "Todos".
 * - Selector de Finca y Cuartel.
 * - Pull-to-refresh: ejecuta sync completo y actualiza catálogos.
 */

import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Chip,
  FAB,
  Button,
  Menu,
  useTheme,
  SegmentedButtons,
} from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { laboresRepo } from '../../../db/repositories/labores.repo';
import { useCatalogosStore } from '../../../stores/catalogos.store';
import { syncEngine } from '../../../sync/sync-engine';
import { catalogosSyncService } from '../../../services/catalogos-sync.service';
import { hoyLocal } from '../../../utils/fecha-local';
import { haptics } from '../../../utils/haptics';
import { EstadoSync } from '../../../types/api.types';
import type { Cuartel } from '../../../types/api.types';

type LaborListItem = {
  localUuid: string;
  cuartelId: string;
  tipoLaborId: string;
  fecha: string;
  cantidad: number;
  estadoSync: EstadoSync;
  errorMessage: string | null;
  createdAtLocal: string;
  createdAt: string;
  serverId: string | null;
  cuartelNombre: string;
  fincaNombre: string;
  tipoLaborNombre: string;
  insumosCount: number;
};

export default function LaboresScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { fincas, loadFromLocalDb, getCuartelesByFinca } = useCatalogosStore();

  const [labores, setLabores] = useState<LaborListItem[]>([]);
  const [filtroTab, setFiltroTab] = useState<'hoy' | 'pendientes' | 'todos'>('hoy');
  const [selectedFincaId, setSelectedFincaId] = useState<string>('');
  const [selectedCuartelId, setSelectedCuartelId] = useState<string>('');
  const [cuartelesDisponibles, setCuartelesDisponibles] = useState<Cuartel[]>([]);

  const [fincaMenuVisible, setFincaMenuVisible] = useState(false);
  const [cuartelMenuVisible, setCuartelMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFromLocalDb();
  }, [loadFromLocalDb]);

  useEffect(() => {
    if (selectedFincaId) {
      getCuartelesByFinca(selectedFincaId).then(setCuartelesDisponibles);
      setSelectedCuartelId('');
    } else {
      setCuartelesDisponibles([]);
      setSelectedCuartelId('');
    }
  }, [selectedFincaId, getCuartelesByFinca]);

  const loadData = useCallback(async () => {
    try {
      const filters: { fecha?: string; fincaId?: string; cuartelId?: string } = {};
      if (filtroTab === 'hoy') {
        filters.fecha = hoyLocal();
      }
      if (selectedFincaId) {
        filters.fincaId = selectedFincaId;
      }
      if (selectedCuartelId) {
        filters.cuartelId = selectedCuartelId;
      }

      const items = await laboresRepo.getLaboresFiltered(filters);
      setLabores(items);
    } catch {
      // Ignorar
    }
  }, [filtroTab, selectedFincaId, selectedCuartelId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await haptics.selection();
    try {
      // 1. Sincroniza pendientes con backend si hay conexión
      await syncEngine.runSync();
      // 2. Descarga catálogos actualizados
      await catalogosSyncService.syncAll();
      // 3. Recarga vista local
      await loadData();
      await haptics.success();
    } catch {
      await haptics.error();
    } finally {
      setRefreshing(false);
    }
  }

  const filteredLabores = labores.filter((l) => {
    if (filtroTab === 'pendientes') {
      return l.estadoSync === EstadoSync.PENDIENTE || l.estadoSync === EstadoSync.ERROR;
    }
    return true;
  });

  function getStatusChip(estado: EstadoSync, errorMessage: string | null) {
    switch (estado) {
      case EstadoSync.SINCRONIZADO:
        return (
          <Chip
            icon="check-circle"
            textStyle={{ color: '#27AE60' }}
            style={{ backgroundColor: '#E8F5E9' }}
            compact
          >
            Sincronizado
          </Chip>
        );
      case EstadoSync.PENDIENTE:
        return (
          <Chip
            icon="clock-outline"
            textStyle={{ color: '#E65100' }}
            style={{ backgroundColor: '#FFF3E0' }}
            compact
          >
            Pendiente
          </Chip>
        );
      case EstadoSync.ERROR:
        return (
          <Chip
            icon="alert-circle"
            textStyle={{ color: theme.colors.error }}
            style={{ backgroundColor: '#FFEBEE' }}
            compact
          >
            {errorMessage ? 'Conflicto' : 'Error'}
          </Chip>
        );
    }
  }

  const selectedFinca = fincas.find((f) => f.id === selectedFincaId);
  const selectedCuartel = cuartelesDisponibles.find((c) => c.id === selectedCuartelId);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Selector de pestañas */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filtroTab}
          onValueChange={(val) => {
            setFiltroTab(val as 'hoy' | 'pendientes' | 'todos');
            haptics.selection();
          }}
          buttons={[
            { value: 'hoy', label: 'Hoy' },
            { value: 'pendientes', label: 'Pendientes' },
            { value: 'todos', label: 'Historial' },
          ]}
        />

        {/* Filtros avanzados de Finca y Cuartel (HU-15) */}
        {filtroTab === 'todos' && (
          <View style={styles.advancedFilters}>
            <Menu
              visible={fincaMenuVisible}
              onDismiss={() => setFincaMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setFincaMenuVisible(true)}
                  style={styles.filterButton}
                >
                  {selectedFinca ? selectedFinca.nombre : 'Todas las fincas'}
                </Button>
              }
            >
              <Menu.Item
                onPress={() => {
                  setSelectedFincaId('');
                  setFincaMenuVisible(false);
                }}
                title="Todas las fincas"
              />
              {fincas.map((f) => (
                <Menu.Item
                  key={f.id}
                  onPress={() => {
                    setSelectedFincaId(f.id);
                    setFincaMenuVisible(false);
                  }}
                  title={f.nombre}
                />
              ))}
            </Menu>

            {selectedFincaId && (
              <Menu
                visible={cuartelMenuVisible}
                onDismiss={() => setCuartelMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => setCuartelMenuVisible(true)}
                    style={styles.filterButton}
                  >
                    {selectedCuartel ? selectedCuartel.nombre : 'Todos los cuarteles'}
                  </Button>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setSelectedCuartelId('');
                    setCuartelMenuVisible(false);
                  }}
                  title="Todos los cuarteles"
                />
                {cuartelesDisponibles.map((c) => (
                  <Menu.Item
                    key={c.id}
                    onPress={() => {
                      setSelectedCuartelId(c.id);
                      setCuartelMenuVisible(false);
                    }}
                    title={c.nombre}
                  />
                ))}
              </Menu>
            )}
          </View>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={filteredLabores}
        keyExtractor={(item) => item.localUuid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="clipboard-text-off-outline"
              size={48}
              color={theme.colors.outline}
            />
            <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
              {filtroTab === 'hoy'
                ? 'No hay labores registradas hoy'
                : filtroTab === 'pendientes'
                  ? 'No hay labores pendientes de sincronización'
                  : 'No se encontraron registros'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => router.push(`/(tabs)/labores/${item.localUuid}`)}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" style={{ fontWeight: '700', flex: 1 }}>
                  {item.tipoLaborNombre}
                </Text>
                {getStatusChip(item.estadoSync, item.errorMessage)}
              </View>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {item.fincaNombre ? `${item.fincaNombre} • ` : ''}{item.cuartelNombre}
              </Text>

              <View style={styles.cardFooter}>
                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  Cantidad: {item.cantidad}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {item.insumosCount > 0 && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.insumosCount} insumo{item.insumosCount > 1 ? 's' : ''}
                    </Text>
                  )}
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {item.fecha}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {/* FAB para nueva labor */}
      <FAB
        icon="plus"
        label="Nueva Labor"
        onPress={() => {
          haptics.selection();
          router.push('/(tabs)/labores/nueva');
        }}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  advancedFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  filterButton: {
    flex: 1,
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
});
