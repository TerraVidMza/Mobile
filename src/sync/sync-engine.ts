/**
 * Motor de Sincronización Central (Sync Engine) — HU-14.
 *
 * Coordina:
 * 1. Conteo de pendientes locales (labores + pesajes).
 * 2. Ejecución secuencial de batches de labores y pesajes.
 * 3. Actualización de catálogos post-sincronización exitosa.
 * 4. Manejo de estado y progreso en `useSyncStore`.
 */

import { syncLaboresBatch } from './sync-labores';
import { syncPesajesBatch } from './sync-pesajes';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { useSyncStore } from '../stores/sync.store';

let _isSyncing = false;

export const syncEngine = {
  /**
   * Actualiza el conteo de pendientes en el store.
   */
  async updatePendingCount(): Promise<number> {
    const [laboresPendientes, pesajesPendientes] = await Promise.all([
      laboresRepo.countPendientes(),
      pesajesRepo.countPendientes(),
    ]);
    const total = laboresPendientes + pesajesPendientes;
    useSyncStore.getState().setPendingCount(total);
    return total;
  },

  /**
   * Ejecuta una ronda completa de sincronización.
   */
  async runSync(): Promise<{ success: boolean; totalSynced: number; errors: number }> {
    if (_isSyncing) {
      return { success: false, totalSynced: 0, errors: 0 };
    }

    _isSyncing = true;
    const store = useSyncStore.getState();
    store.setStatus('syncing');

    let totalSynced = 0;
    let totalErrors = 0;

    try {
      // 1. Obtener conteo inicial
      const initialPending = await this.updatePendingCount();
      if (initialPending === 0) {
        store.markSyncComplete();
        _isSyncing = false;
        return { success: true, totalSynced: 0, errors: 0 };
      }

      store.setProgress(0, initialPending);

      // 2. Sincronizar labores
      const laboresResult = await syncLaboresBatch((current, total) => {
        store.setProgress(current, total);
      });
      totalSynced += laboresResult.totalSynced;
      totalErrors += laboresResult.errorsCount;

      // 3. Sincronizar pesajes
      const pesajesResult = await syncPesajesBatch((current) => {
        store.setProgress(totalSynced + current, initialPending);
      });
      totalSynced += pesajesResult.totalSynced;
      totalErrors += pesajesResult.errorsCount;

      // 4. Actualizar catálogos si hubo éxito parcial o total
      if (totalSynced > 0) {
        await catalogosSyncService.syncAll();
      }

      // 5. Actualizar estado final
      await this.updatePendingCount();

      if (totalErrors > 0) {
        store.setStatus('error');
        store.setError(`${totalErrors} registro(s) no se pudieron sincronizar.`);
      } else {
        store.markSyncComplete();
      }

      return {
        success: totalErrors === 0,
        totalSynced,
        errors: totalErrors,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error inesperado durante la sincronización';
      store.setStatus('error');
      store.setError(message);
      return { success: false, totalSynced, errors: totalErrors + 1 };
    } finally {
      _isSyncing = false;
    }
  },
};
