/**
 * Pruebas unitarias para sync-engine.ts (100% Cobertura).
 */

import { syncEngine } from './sync-engine';
import { syncLaboresBatch } from './sync-labores';
import { syncPesajesBatch } from './sync-pesajes';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { useSyncStore } from '../stores/sync.store';

jest.mock('./sync-labores');
jest.mock('./sync-pesajes');
jest.mock('../db/repositories/labores.repo');
jest.mock('../db/repositories/pesajes.repo');
jest.mock('../services/catalogos-sync.service');

describe('syncEngine (100% Coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('debe actualizar conteo de pendientes en useSyncStore', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(3);
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(2);

    const total = await syncEngine.updatePendingCount();
    expect(total).toBe(5);
    expect(useSyncStore.getState().pendingCount).toBe(5);
  });

  it('debe completar inmediatamente si no hay registros pendientes', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(0);
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(0);

    const result = await syncEngine.runSync();
    expect(result).toEqual({ success: true, totalSynced: 0, errors: 0 });
    expect(syncLaboresBatch).not.toHaveBeenCalled();
  });

  it('debe sincronizar labores y pesajes con éxito y descargar catálogos', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValueOnce(2).mockResolvedValue(0);
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValueOnce(1).mockResolvedValue(0);

    (syncLaboresBatch as jest.Mock).mockImplementation(async (onProgress) => {
      onProgress(2, 3);
      return { totalSynced: 2, errorsCount: 0 };
    });

    (syncPesajesBatch as jest.Mock).mockImplementation(async (onProgress) => {
      onProgress(1, 3);
      return { totalSynced: 1, errorsCount: 0 };
    });

    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: true });

    const result = await syncEngine.runSync();
    expect(result).toEqual({ success: true, totalSynced: 3, errors: 0 });
    expect(catalogosSyncService.syncAll).toHaveBeenCalled();
    expect(useSyncStore.getState().status).toBe('idle');
  });

  it('debe registrar error en el store si hubo errores en los lotes', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValueOnce(1).mockResolvedValue(1);
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValueOnce(0).mockResolvedValue(0);

    (syncLaboresBatch as jest.Mock).mockResolvedValue({ totalSynced: 0, errorsCount: 1 });
    (syncPesajesBatch as jest.Mock).mockResolvedValue({ totalSynced: 0, errorsCount: 0 });

    const result = await syncEngine.runSync();
    expect(result.success).toBe(false);
    expect(result.errors).toBe(1);
    expect(useSyncStore.getState().status).toBe('error');
  });

  it('debe manejar excepciones inesperadas durante la sincronización', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockRejectedValue(new Error('Fatal SQLite Crash'));

    const result = await syncEngine.runSync();
    expect(result.success).toBe(false);
    expect(useSyncStore.getState().lastError).toBe('Fatal SQLite Crash');
  });

  it('debe retornar inmediatamente si ya hay una sincronización en curso', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(2), 50)),
    );

    const promise1 = syncEngine.runSync();
    const promise2 = syncEngine.runSync();

    const [, res2] = await Promise.all([promise1, promise2]);
    expect(res2).toEqual({ success: false, totalSynced: 0, errors: 0 });
  });

  describe('reintento automático (M-003)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Siempre queda 1 pendiente: el backend lo rechaza en cada ronda.
      (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(1);
      (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(0);
      (syncLaboresBatch as jest.Mock).mockResolvedValue({
        totalSynced: 0,
        errorsCount: 1,
        interrumpido: false,
      });
      (syncPesajesBatch as jest.Mock).mockResolvedValue({
        totalSynced: 0,
        errorsCount: 0,
        interrumpido: false,
      });
    });

    afterEach(() => {
      syncEngine.cancelarReintento();
      jest.useRealTimers();
    });

    /** Avanza hasta el próximo reintento y espera a que termine la ronda. */
    async function correrReintento() {
      await jest.advanceTimersByTimeAsync(140_000);
    }

    it('reintenta a los 30/60/120 s y después deja de insistir', async () => {
      await syncEngine.runSync();
      expect(useSyncStore.getState().proximoReintentoAt).not.toBeNull();
      expect(useSyncStore.getState().lastError).toMatch(/se reintenta automáticamente/i);

      await correrReintento();
      await correrReintento();
      await correrReintento();
      expect(syncLaboresBatch).toHaveBeenCalledTimes(4);

      // Agotados los tres reintentos: no se programa otro y el registro sigue pendiente.
      expect(useSyncStore.getState().proximoReintentoAt).toBeNull();
      expect(useSyncStore.getState().lastError).toBe('1 registro(s) siguen pendientes de sincronizar.');
      await correrReintento();
      expect(syncLaboresBatch).toHaveBeenCalledTimes(4);
    });

    it('una ronda manual reinicia la cuenta de reintentos', async () => {
      await syncEngine.runSync();
      await correrReintento();
      await correrReintento();
      await correrReintento();
      expect(useSyncStore.getState().proximoReintentoAt).toBeNull();

      await syncEngine.runSync();
      expect(useSyncStore.getState().proximoReintentoAt).not.toBeNull();
    });

    it('no programa reintentos sin conexión', async () => {
      useSyncStore.setState({ isConnected: false });
      await syncEngine.runSync();
      expect(useSyncStore.getState().proximoReintentoAt).toBeNull();
    });

    it('el reintento no corre si se perdió la conexión mientras esperaba', async () => {
      await syncEngine.runSync();
      useSyncStore.setState({ isConnected: false });
      await correrReintento();
      expect(syncLaboresBatch).toHaveBeenCalledTimes(1);
    });

    it('no sincroniza pesajes si las labores se cortaron por conexión', async () => {
      (syncLaboresBatch as jest.Mock).mockResolvedValue({
        totalSynced: 0,
        errorsCount: 1,
        interrumpido: true,
      });
      await syncEngine.runSync();
      expect(syncPesajesBatch).not.toHaveBeenCalled();
    });

    it('cuando todo sube, limpia el error y no programa reintentos', async () => {
      (laboresRepo.countPendientes as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValue(0);
      (syncLaboresBatch as jest.Mock).mockResolvedValue({
        totalSynced: 1,
        errorsCount: 0,
        interrumpido: false,
      });

      const res = await syncEngine.runSync();

      expect(res).toEqual({ success: true, totalSynced: 1, errors: 0 });
      expect(useSyncStore.getState().status).toBe('idle');
      expect(useSyncStore.getState().proximoReintentoAt).toBeNull();
    });
  });
});
