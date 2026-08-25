/**
 * Barra de Estado de Sincronización — PAN-05 (Figma) / HU-14.
 *
 * Muestra:
 * - Modo Offline (badge naranja cuando no hay conexión).
 * - Sincronizando X de N (badge azul con spinner mientras sincroniza).
 * - Todo sincronizado (badge verde cuando pendingCount = 0).
 * - Botón para forzar sincronización manual.
 */

import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSyncStore } from '../../stores/sync.store';
import { syncEngine } from '../../sync/sync-engine';

export function SyncStatusBar() {
  const { status, pendingCount, currentIndex, totalToSync, isConnected } = useSyncStore();

  async function handleManualSync() {
    if (isConnected && status !== 'syncing') {
      await syncEngine.runSync();
    }
  }

  if (!isConnected) {
    return (
      <View style={[styles.bar, { backgroundColor: '#FFF3E0' }]}>
        <MaterialCommunityIcons name="cloud-off-outline" size={18} color="#E65100" />
        <Text variant="labelMedium" style={{ color: '#E65100', marginLeft: 8, fontWeight: '600' }}>
          Modo Offline {pendingCount > 0 ? `(${pendingCount} pendientes)` : ''}
        </Text>
      </View>
    );
  }

  if (status === 'syncing') {
    return (
      <View style={[styles.bar, { backgroundColor: '#E3F2FD' }]}>
        <ActivityIndicator size={16} color="#1565C0" />
        <Text variant="labelMedium" style={{ color: '#1565C0', marginLeft: 8, fontWeight: '600' }}>
          Sincronizando {currentIndex} de {totalToSync} registros...
        </Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <TouchableOpacity
        onPress={handleManualSync}
        style={[styles.bar, { backgroundColor: '#FFF8E1' }]}
      >
        <MaterialCommunityIcons name="sync" size={18} color="#F57F17" />
        <Text variant="labelMedium" style={{ color: '#F57F17', marginLeft: 8, fontWeight: '600' }}>
          {pendingCount} pendiente{pendingCount > 1 ? 's' : ''} — Tocar para sincronizar
        </Text>
      </TouchableOpacity>
    );
  }

  return null; // Si todo está sincronizado y conectado, no ocupa espacio
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
});
