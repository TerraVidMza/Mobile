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
 * Si la última descarga de catálogos quedó incompleta (por ejemplo, se cortó
 * la señal justo después del login), también la repite (M-016).
 *
 * Sin conexión o sin sesión se cancela el reintento programado.
 */

import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ENV } from '../config/env';
import { useSyncStore } from '../stores/sync.store';
import { useAuthStore } from '../stores/auth.store';
import { useCatalogosStore } from '../stores/catalogos.store';
import { syncEngine } from './sync-engine';

let _unsubscribe: (() => void) | null = null;
/** Último refresco de catálogos al volver al primer plano (evita pedirlos en cada vuelta). */
let _ultimoRefrescoCatalogos = 0;
const REFRESCO_CATALOGOS_MS = 5 * 60 * 1000;

/**
 * NetInfo decide "hay internet" haciendo un pedido a un servidor de Google por
 * defecto. Si esa red lo bloquea (wifi de oficina, algunos proveedores), la
 * app se quedaba en "Sin conexión" y nunca sincronizaba aunque el servidor de
 * TerraVid estuviera al alcance. Se prueba contra el propio backend: cualquier
 * respuesta que no sea 5xx alcanza, aunque sea 404 o 401.
 */
function configurarChequeoDeInternet(): void {
  if (Platform.OS === 'web') return; // en web NetInfo usa navigator.onLine
  NetInfo.configure?.({
    reachabilityUrl: `${ENV.API_BASE_URL}/auth/refresh`,
    reachabilityMethod: 'HEAD',
    reachabilityTest: async (response) => response.status < 500,
    reachabilityShortTimeout: 5 * 1000,
    reachabilityLongTimeout: 60 * 1000,
    reachabilityRequestTimeout: 10 * 1000,
  });
}
/** Arranca en true: la primera lectura "con conexión" equivale a una reconexión. */
let _wasOffline = true;

function sincronizarSiCorresponde(): void {
  if (useAuthStore.getState().isAuthenticated && useSyncStore.getState().isConnected) {
    void syncEngine.runSync();
    if (useCatalogosStore.getState().catalogosIncompletos) {
      void useCatalogosStore.getState().syncWithServer();
    }
  }
}

export function initConnectivityMonitor(): () => void {
  if (_unsubscribe) {
    return _unsubscribe;
  }
  _wasOffline = true;
  configurarChequeoDeInternet();

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

  // Al volver a la app (desbloquear el teléfono, cambiar de aplicación) NetInfo
  // no avisa nada si la conexión nunca cambió: lo pendiente esperaba hasta la
  // próxima reconexión. Acá se reintenta y se refrescan los catálogos para ver
  // lo que se cargó mientras tanto en la Web.
  const appStateSub = AppState.addEventListener('change', (estado) => {
    if (estado !== 'active') return;
    const { isConnected, pendingCount } = useSyncStore.getState();
    if (!isConnected || !useAuthStore.getState().isAuthenticated) return;
    if (pendingCount > 0) void syncEngine.runSync();
    if (Date.now() - _ultimoRefrescoCatalogos > REFRESCO_CATALOGOS_MS) {
      _ultimoRefrescoCatalogos = Date.now();
      void useCatalogosStore.getState().syncWithServer();
    }
  });

  // Chequeo inicial (si falla la lectura local, el contador queda como estaba)
  syncEngine.updatePendingCount().catch(() => {});

  _unsubscribe = () => {
    netInfoUnsub();
    authUnsub();
    appStateSub?.remove?.();
    _unsubscribe = null;
  };

  return _unsubscribe;
}
