/**
 * Detalle de Labor y motivo de los intentos de sincronización fallidos (HU-12, HU-14, HU-17).
 */

import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  Divider,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { laboresRepo } from '../../../db/repositories/labores.repo';
import { syncEngine } from '../../../sync/sync-engine';
import { haptics } from '../../../utils/haptics';
import { EstadoSyncChip } from '../../../components/sync/EstadoSyncChip';
import { EstadoSync } from '../../../types/api.types';
import type { DetalleInsumoLocal, RegistroLaborLocal } from '../../../types/api.types';

type LaborDetail = RegistroLaborLocal & {
  cuartelNombre: string;
  fincaNombre?: string;
  tipoLaborNombre: string;
};

export default function DetalleLaborScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [labor, setLabor] = useState<LaborDetail | null>(null);
  const [insumos, setInsumos] = useState<
    (DetalleInsumoLocal & { insumoNombre: string; unidadMedida: string | null })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [item, itemsInsumos] = await Promise.all([
        laboresRepo.getLaborByUuid(id),
        laboresRepo.getInsumosDeLabor(id),
      ]);
      setLabor(item);
      setInsumos(itemsInsumos);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleReintentarSync() {
    if (!id) return;
    setSyncing(true);
    try {
      await syncEngine.runSync();
      await haptics.success();
      await loadData();
    } catch {
      await haptics.error();
    } finally {
      setSyncing(false);
    }
  }

  async function handleEliminar() {
    if (!id) return;
    Alert.alert(
      'Eliminar Registro',
      '¿Estás seguro de que deseás eliminar este registro local?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await laboresRepo.deleteLabor(id);
            await syncEngine.updatePendingCount();
            await haptics.selection();
            router.back();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!labor) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          Registro no encontrado
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.content}
    >
      {/* Motivo del último intento fallido (HU-14 Criterio 4, M-003) */}
      {labor.estadoSync === EstadoSync.PENDIENTE && labor.errorMessage && (
        <Card style={[styles.errorCard, { backgroundColor: theme.colors.errorContainer }]}>
          <Card.Content>
            <View style={styles.errorHeader}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={24}
                color={theme.colors.onErrorContainer}
              />
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onErrorContainer, fontWeight: '700', marginLeft: 8 }}
              >
                No se pudo sincronizar
                {labor.intentosSync > 0 ? ` (${labor.intentosSync} intento${labor.intentosSync > 1 ? 's' : ''})` : ''}
              </Text>
            </View>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onErrorContainer, marginTop: 8 }}
            >
              {labor.errorMessage}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onErrorContainer, marginTop: 8 }}
            >
              El registro sigue pendiente y se reintenta automáticamente.
            </Text>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary, flex: 1 }}>
              {labor.tipoLaborNombre}
            </Text>
            <EstadoSyncChip
              estado={labor.estadoSync}
              errorMessage={labor.errorMessage}
              intentos={labor.intentosSync}
            />
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.label}>Finca:</Text>
            <Text variant="bodyMedium" style={styles.value}>{labor.fincaNombre ?? 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.label}>Cuartel:</Text>
            <Text variant="bodyMedium" style={styles.value}>{labor.cuartelNombre}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.label}>Fecha:</Text>
            <Text variant="bodyMedium" style={styles.value}>{labor.fecha}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.label}>Cantidad:</Text>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
              {labor.cantidad}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.label}>UUID Local:</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, flex: 1, textAlign: 'right' }}>
              {labor.localUuid}
            </Text>
          </View>

          <Divider style={{ marginVertical: 16 }} />

          <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: 8 }}>
            Insumos aplicados ({insumos.length})
          </Text>

          {insumos.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              No se registraron insumos para esta labor.
            </Text>
          ) : (
            insumos.map((i) => (
              <View key={i.id} style={styles.insumoRow}>
                <Text variant="bodyMedium">{i.insumoNombre}</Text>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  {i.cantidad} {i.unidadMedida ?? 'u'}
                </Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Botones de acción */}
      <View style={styles.actions}>
        {labor.estadoSync !== EstadoSync.SINCRONIZADO && (
          <Button
            mode="contained"
            icon="sync"
            onPress={handleReintentarSync}
            loading={syncing}
            disabled={syncing}
            style={styles.actionBtn}
          >
            Sincronizar ahora
          </Button>
        )}

        {labor.estadoSync !== EstadoSync.SINCRONIZADO && (
          <Button
            mode="outlined"
            icon="delete-outline"
            onPress={handleEliminar}
            textColor={theme.colors.error}
            style={[styles.actionBtn, { borderColor: theme.colors.error }]}
          >
            Eliminar registro
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
  },
  errorCard: {
    borderRadius: 12,
    marginBottom: 12,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontWeight: '600',
  },
  insumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionBtn: {
    borderRadius: 12,
  },
});
