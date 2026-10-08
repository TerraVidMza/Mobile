/**
 * Pruebas unitarias para connectivity-monitor.ts (100% Cobertura).
 */

import NetInfo from '@react-native-community/netinfo';
import { initConnectivityMonitor } from './connectivity-monitor';
import { syncEngine } from './sync-engine';
import { useSyncStore } from '../stores/sync.store';
import { useAuthStore } from '../stores/auth.store';
import { useCatalogosStore } from '../stores/catalogos.store';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
}));
jest.mock('./sync-engine');
jest.mock('../stores/auth.store', () => {
  const { create } = jest.requireActual('zustand');
  return { useAuthStore: create(() => ({ isAuthenticated: true })) };
});
jest.mock('../stores/catalogos.store', () => {
  const { create } = jest.requireActual('zustand');
  return {
    useCatalogosStore: create(() => ({
      catalogosIncompletos: false,
      syncWithServer: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('connectivityMonitor (100% Coverage)', () => {
  let netInfoCallback: (state: any) => void;

  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true });
    useCatalogosStore.setState({ catalogosIncompletos: false });
    jest.useFakeTimers();
    (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
      netInfoCallback = cb;
      return jest.fn();
    });
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
    jest.useRealTimers();
  });

  it('debe registrar el listener de red y actualizar pendientes inicialmente', () => {
    const unsubscribe = initConnectivityMonitor();
    expect(NetInfo.addEventListener).toHaveBeenCalled();
    expect(syncEngine.updatePendingCount).toHaveBeenCalled();

    // Reinvocación devuelve la misma función de unsubscribe
    const sameUnsub = initConnectivityMonitor();
    expect(sameUnsub).toBe(unsubscribe);

    unsubscribe();
  });

  it('sincroniza al arrancar con conexión y sesión (pendientes de la sesión anterior)', () => {
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(1500);
    expect(syncEngine.runSync).toHaveBeenCalledTimes(1);
  });

  it('al volver la señal repite la descarga de catálogos si quedó incompleta (M-016)', () => {
    useCatalogosStore.setState({ catalogosIncompletos: true });
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(1500);
    expect(useCatalogosStore.getState().syncWithServer).toHaveBeenCalledTimes(1);
  });

  it('con los catálogos completos no los vuelve a descargar', () => {
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(1500);
    expect(useCatalogosStore.getState().syncWithServer).not.toHaveBeenCalled();
  });

  it('no sincroniza sin sesión', () => {
    useAuthStore.setState({ isAuthenticated: false });
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(1500);
    expect(syncEngine.runSync).not.toHaveBeenCalled();
  });

  it('sincroniza al iniciar sesión y cancela el reintento al cerrarla', () => {
    useAuthStore.setState({ isAuthenticated: false });
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });

    useAuthStore.setState({ isAuthenticated: true });
    expect(syncEngine.runSync).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ isAuthenticated: false });
    expect(syncEngine.cancelarReintento).toHaveBeenCalled();
  });

  it('cancela el reintento programado al perder la conexión', () => {
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: false, isInternetReachable: false });
    expect(syncEngine.cancelarReintento).toHaveBeenCalled();
  });

  it('debe disparar syncEngine.runSync al pasar de offline a online', () => {
    unsubscribe = initConnectivityMonitor();

    // Simular desconexión
    netInfoCallback({ isConnected: false, isInternetReachable: false });
    expect(useSyncStore.getState().isConnected).toBe(false);

    // Simular reconexión
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    expect(useSyncStore.getState().isConnected).toBe(true);

    // Avanzar timer (1000ms delay)
    jest.advanceTimersByTime(1500);
    expect(syncEngine.runSync).toHaveBeenCalled();
  });

  it('no vuelve a sincronizar por eventos sucesivos con conexión', () => {
    unsubscribe = initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    jest.advanceTimersByTime(1500);
    expect(useSyncStore.getState().isConnected).toBe(true);
    expect(syncEngine.runSync).toHaveBeenCalledTimes(1);
  });
});
