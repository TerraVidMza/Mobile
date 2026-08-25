/**
 * Pruebas unitarias para connectivity-monitor.ts (100% Cobertura).
 */

import NetInfo from '@react-native-community/netinfo';
import { initConnectivityMonitor } from './connectivity-monitor';
import { syncEngine } from './sync-engine';
import { useSyncStore } from '../stores/sync.store';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
}));
jest.mock('./sync-engine');

describe('connectivityMonitor (100% Coverage)', () => {
  let netInfoCallback: (state: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
      netInfoCallback = cb;
      return jest.fn();
    });
  });

  afterEach(() => {
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

  it('debe disparar syncEngine.runSync al pasar de offline a online', () => {
    initConnectivityMonitor();

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

  it('debe manejar estado online sin haber estado offline', () => {
    initConnectivityMonitor();
    netInfoCallback({ isConnected: true, isInternetReachable: true });
    expect(useSyncStore.getState().isConnected).toBe(true);
    expect(syncEngine.runSync).not.toHaveBeenCalled();
  });
});
