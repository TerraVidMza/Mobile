/**
 * Monitor de Conectividad — HU-14.
 *
 * Escucha cambios de estado de red con @react-native-community/netinfo.
 * Al recuperar conexión, dispara `syncEngine.runSync()` en ≤5s (criterio HU-14).
 */

import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/sync.store';
import { syncEngine } from './sync-engine';

let _unsubscribe: (() => void) | null = null;
let _wasOffline = false;

export function initConnectivityMonitor(): () => void {
  if (_unsubscribe) {
    return _unsubscribe;
  }

  const netInfoUnsub = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    const store = useSyncStore.getState();

    store.setConnected(isOnline);

    if (isOnline) {
      if (_wasOffline) {
        // Dispara la sincronización automática al recuperar señal (≤ 5 segundos)
        setTimeout(() => {
          syncEngine.runSync();
        }, 1000);
      }
      _wasOffline = false;
    } else {
      _wasOffline = true;
    }
  });

  // Chequeo inicial
  syncEngine.updatePendingCount();

  _unsubscribe = () => {
    netInfoUnsub();
    _unsubscribe = null;
  };

  return _unsubscribe;
}
