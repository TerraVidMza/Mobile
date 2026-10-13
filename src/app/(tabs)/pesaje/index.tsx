/**
 * Lista de Pesajes de Vendimia y Desglose por Cuadrilla (HU-24, HU-27).
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Chip,
  FAB,
  Divider,
  useTheme,
  SegmentedButtons,
} from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { pesajesRepo } from '../../../db/repositories/pesajes.repo';
import { syncEngine } from '../../../sync/sync-engine';
import { EstadoSyncChip } from '../../../components/sync/EstadoSyncChip';
import { catalogosSyncService } from '../../../services/catalogos-sync.service';
import { hoyLocal } from '../../../utils/fecha-local';
import { haptics } from '../../../utils/haptics';
import { EstadoSync } from '../../../types/api.types';
import type { PesajeVendimiaLocal } from '../../../types/api.types';
import type { ResumenCuadrilla } from '../../../db/repositories/pesajes.repo';

type PesajeListItem = PesajeVendimiaLocal & {
  cuadrillaNombre: string;
  cuartelNombre: string;
};

export default function PesajesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [pesajes, setPesajes] = useState<PesajeListItem[]>([]);
  const [resumenCuadrillas, setResumenCuadrillas] = useState<ResumenCuadrilla[]>([]);
  const [filtro, setFiltro] = useState<'hoy' | 'pendientes' | 'cuadrillas'>('hoy');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [items, resumen] = await Promise.all([
        pesajesRepo.getPesajesByFecha(hoyLocal()),
        pesajesRepo.getResumenPorCuadrilla(hoyLocal()),
      ]);
      setPesajes(items);
      setResumenCuadrillas(resumen);
    } catch {
      // Ignorar
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await haptics.selection();
    try {
      await syncEngine.runSync();
      await catalogosSyncService.syncAll();
      await loadData();
      await haptics.success();
    } catch {
      await haptics.error();
    } finally {
      setRefreshing(false);
    }
  }

  const filteredPesajes = pesajes.filter((p) => {
    if (filtro === 'pendientes') {
      return p.estadoSync === EstadoSync.PENDIENTE;
    }
    return true;
  });

  const totalKg = filteredPesajes.reduce((acc, curr) => acc + curr.pesoKg, 0);


  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Selector de filtro */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filtro}
          onValueChange={(val) => {
            setFiltro(val as 'hoy' | 'pendientes' | 'cuadrillas');
            haptics.selection();
          }}
          buttons={[
            { value: 'hoy', label: 'Hoy' },
            { value: 'pendientes', label: 'Pendientes' },
            { value: 'cuadrillas', label: 'Por Cuadrilla' },
          ]}
        />
      </View>

      {/* Resumen Total del Día */}
      <Card style={[styles.summaryCard, { backgroundColor: theme.colors.secondaryContainer }]}>
        <Card.Content style={styles.summaryContent}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
            Total Cosechado Hoy
          </Text>
          <Text variant="headlineMedium" style={{ fontWeight: '700', color: theme.colors.onSecondaryContainer }}>
            {totalKg.toLocaleString('es-AR')} kg
          </Text>
        </Card.Content>
      </Card>

      {/* Vista: Desglose por Cuadrilla (HU-27) */}
      {filtro === 'cuadrillas' ? (
        <FlatList
          data={resumenCuadrillas}
          keyExtractor={(item) => item.cuadrillaId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                No hay pesajes registrados hoy para totalizar
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                    {item.cuadrillaNombre}
                  </Text>
                  <Chip compact>{item.pesajesCount} pesajes</Chip>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.cardFooter}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Total Cosechado:
                  </Text>
                  <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.primary }}>
                    {item.totalKg.toLocaleString('es-AR')} kg
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        /* Vista: Lista individual de pesajes */
        <FlatList
          data={filteredPesajes}
          keyExtractor={(item) => item.localUuid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="scale-bathroom"
                size={48}
                color={theme.colors.outline}
              />
              <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
                {filtro === 'hoy'
                  ? 'No hay pesajes registrados hoy'
                  : 'No hay pesajes pendientes de sincronización'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                    {item.cuadrillaNombre}
                  </Text>
                  <EstadoSyncChip estado={item.estadoSync} errorMessage={item.errorMessage} intentos={item.intentosSync} />
                </View>

                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Cuartel: {item.cuartelNombre}
                </Text>

                <View style={styles.cardFooter}>
                  <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                    {item.pesoKg.toLocaleString('es-AR')} kg
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {item.fecha}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}

      {/* FAB para nuevo pesaje */}
      <FAB
        icon="plus"
        testID="fab-nuevo-pesaje"
        label="Nuevo Pesaje"
        onPress={() => {
          haptics.selection();
          router.push('/(tabs)/pesaje/nuevo');
        }}
        style={[styles.fab, { backgroundColor: theme.colors.secondary }]}
        color={theme.colors.onSecondary}
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
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 10,
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
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
