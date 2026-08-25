/**
 * Pruebas unitarias para Zustand sync.store.
 */

import { useSyncStore } from './sync.store';

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.setState({
      pendingCount: 0,
      currentIndex: 0,
      totalToSync: 0,
      isConnected: true,
      status: 'idle',
      lastSyncAt: null,
      lastError: null,
    });
  });

  it('debe incrementar y decrementar la cantidad de registros pendientes', () => {
    useSyncStore.getState().incrementPending(3);
    expect(useSyncStore.getState().pendingCount).toBe(3);

    useSyncStore.getState().decrementPending(2);
    expect(useSyncStore.getState().pendingCount).toBe(1);

    useSyncStore.getState().decrementPending(5);
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });

  it('debe actualizar el estado de conectividad y sincronización', () => {
    useSyncStore.getState().setConnected(false);
    expect(useSyncStore.getState().isConnected).toBe(false);
    expect(useSyncStore.getState().status).toBe('offline');

    useSyncStore.getState().setConnected(true);
    expect(useSyncStore.getState().isConnected).toBe(true);

    useSyncStore.getState().setStatus('syncing');
    expect(useSyncStore.getState().status).toBe('syncing');

    useSyncStore.getState().setProgress(1, 5);
    expect(useSyncStore.getState().currentIndex).toBe(1);
    expect(useSyncStore.getState().totalToSync).toBe(5);

    useSyncStore.getState().setError('Error de conexión');
    expect(useSyncStore.getState().lastError).toBe('Error de conexión');

    useSyncStore.getState().markSyncComplete();
    expect(useSyncStore.getState().status).toBe('idle');
    expect(useSyncStore.getState().lastError).toBeNull();
    expect(useSyncStore.getState().lastSyncAt).toBeDefined();
  });
});
