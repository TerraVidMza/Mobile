/**
 * Monitor de Conectividad — HU-14.
 *
 * Escucha cambios de estado de red con @react-native-community/netinfo y de
 * sesión, y decide cuándo correr una ronda de sincronización (M-003):
 *
 * - Al recuperar conexión, en ≤5s (criterio HU-14).
 * - Al arrancar la app con conexión: lo que quedó pendiente de la sesión
 *   anterior no espera a que se corte y vuelva la señal.
 * - Al iniciar sesión.
 *
 * Sin conexión o sin sesión se cancela el reintento programado.
 */

import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/sync.store';
import { useAuthStore } from '../stores/auth.store';
import { syncEngine } from './sync-engine';

let _unsubscribe: (() => void) | null = null;
/** Arranca en true: la primera lectura "con conexión" equivale a una reconexión. */
let _wasOffline = true;

function sincronizarSiCorresponde(): void {
  if (useAuthStore.getState().isAuthenticated && useSyncStore.getState().isConnected) {
    void syncEngine.runSync();
  }
}

export function initConnectivityMonitor(): () => void {
  if (_unsubscribe) {
    return _unsubscribe;
  }
  _wasOffline = true;

  const netInfoUnsub = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    const store = useSyncStore.getState();

    store.setConnected(isOnline);

    if (isOnline) {
      if (_wasOffline) {
        // Dispara la sincronización automática al recuperar señal (≤ 5 segundos)
        setTimeout(sincronizarSiCorresponde, 1000);
      }
      _wasOffline = false;
    } else {
      _wasOffline = true;
      syncEngine.cancelarReintento();
    }
  });

  const authUnsub = useAuthStore.subscribe((estado, anterior) => {
    if (estado.isAuthenticated && !anterior.isAuthenticated) {
      sincronizarSiCorresponde();
    } else if (!estado.isAuthenticated && anterior.isAuthenticated) {
      syncEngine.cancelarReintento();
    }
  });

  // Chequeo inicial
  syncEngine.updatePendingCount();

  _unsubscribe = () => {
    netInfoUnsub();
    authUnsub();
    _unsubscribe = null;
  };

  return _unsubscribe;
}
