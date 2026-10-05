/**
 * Motor de Sincronización Central (Sync Engine) — HU-14.
 *
 * Coordina:
 * 1. Conteo de pendientes locales (labores + pesajes).
 * 2. Ejecución secuencial de batches de labores y pesajes.
 * 3. Actualización de catálogos post-sincronización exitosa.
 * 4. Manejo de estado y progreso en `useSyncStore`.
 * 5. Reintento automático con backoff (M-003).
 *
 * Reintentos: si una ronda deja registros sin subir, se programa otra a los
 * 30 s, 60 s y 120 s (con jitter). Después de esos tres intentos el motor deja
 * de insistir; los registros siguen pendientes y vuelven a intentarse con la
 * próxima ronda que dispare otra cosa (reconexión, registro nuevo, botón
 * "sincronizar", pull-to-refresh). Una ronda iniciada por esos disparadores
 * reinicia la cuenta.
 */

import { syncLaboresBatch } from './sync-labores';
import { syncPesajesBatch } from './sync-pesajes';
import { getRetryDelay } from './retry-strategy';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { useSyncStore } from '../stores/sync.store';
import { ENV } from '../config/env';

let _isSyncing = false;
let _reintento: ReturnType<typeof setTimeout> | null = null;
let _intentosAutomaticos = 0;

function cancelarReintento(): void {
  if (_reintento) {
    clearTimeout(_reintento);
    _reintento = null;
  }
  useSyncStore.getState().setProximoReintento(null);
}

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
   * Programa la próxima ronda automática, si quedan intentos.
   * Devuelve false cuando ya se agotaron los tres reintentos.
   */
  programarReintento(): boolean {
    cancelarReintento();
    if (_intentosAutomaticos >= ENV.SYNC_MAX_RETRIES) {
      return false;
    }

    const delay = getRetryDelay(_intentosAutomaticos);
    _intentosAutomaticos++;
    useSyncStore.getState().setProximoReintento(new Date(Date.now() + delay).toISOString());

    _reintento = setTimeout(() => {
      _reintento = null;
      useSyncStore.getState().setProximoReintento(null);
      if (useSyncStore.getState().isConnected) {
        void syncEngine.runSync({ automatico: true });
      }
    }, delay);
    return true;
  },

  /** Cancela el reintento programado (por ejemplo, al perder la conexión). */
  cancelarReintento,

  /**
   * Ejecuta una ronda completa de sincronización.
   *
   * `automatico` lo usa solo el temporizador de reintentos: cualquier otra
   * ronda reinicia la cuenta de reintentos.
   */
  async runSync(
    opciones: { automatico?: boolean } = {},
  ): Promise<{ success: boolean; totalSynced: number; errors: number }> {
    if (_isSyncing) {
      return { success: false, totalSynced: 0, errors: 0 };
    }

    _isSyncing = true;
    if (!opciones.automatico) {
      _intentosAutomaticos = 0;
    }
    cancelarReintento();

    const store = useSyncStore.getState();
    store.setStatus('syncing');

    let totalSynced = 0;
    let totalErrors = 0;

    try {
      // 1. Obtener conteo inicial
      const initialPending = await this.updatePendingCount();
      if (initialPending === 0) {
        _intentosAutomaticos = 0;
        store.markSyncComplete();
        return { success: true, totalSynced: 0, errors: 0 };
      }

      store.setProgress(0, initialPending);

      // 2. Sincronizar labores
      const laboresResult = await syncLaboresBatch((current, total) => {
        store.setProgress(current, total);
      });
      totalSynced += laboresResult.totalSynced;
      totalErrors += laboresResult.errorsCount;

      // 3. Sincronizar pesajes (si las labores se cortaron por conexión, no tiene sentido)
      if (!laboresResult.interrumpido) {
        const pesajesResult = await syncPesajesBatch((current) => {
          store.setProgress(totalSynced + current, initialPending);
        });
        totalSynced += pesajesResult.totalSynced;
        totalErrors += pesajesResult.errorsCount;
      }

      // 4. Actualizar catálogos si hubo éxito parcial o total
      if (totalSynced > 0) {
        await catalogosSyncService.syncAll();
      }

      // 5. Actualizar estado final
      const restantes = await this.updatePendingCount();

      if (restantes > 0) {
        store.setStatus('error');
        const reintenta = useSyncStore.getState().isConnected && this.programarReintento();
        store.setError(
          `${restantes} registro(s) siguen pendientes de sincronizar` +
            (reintenta ? '. Se reintenta automáticamente.' : '.'),
        );
      } else {
        _intentosAutomaticos = 0;
        store.markSyncComplete();
      }

      return {
        success: restantes === 0,
        totalSynced,
        errors: totalErrors,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error inesperado durante la sincronización';
      store.setStatus('error');
      store.setError(message);
      if (useSyncStore.getState().isConnected) {
        this.programarReintento();
      }
      return { success: false, totalSynced, errors: totalErrors + 1 };
    } finally {
      _isSyncing = false;
    }
  },
};
