/**
 * Sincronizador de Pesajes de Vendimia (HU-24).
 *
 * Envía registros pendientes en lotes de hasta 10 por request al endpoint
 * `POST /api/pesajes-vendimia/sync`.
 */

import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { pesajeService } from '../services/pesaje.service';
import { ENV } from '../config/env';

export async function syncPesajesBatch(
  onProgress?: (synced: number, total: number) => void,
): Promise<{ totalSynced: number; errorsCount: number }> {
  let totalSynced = 0;
  let errorsCount = 0;

  const totalPendientes = await pesajesRepo.countPendientes();
  if (totalPendientes === 0) {
    return { totalSynced: 0, errorsCount: 0 };
  }

  while (true) {
    const lote = await pesajesRepo.getPendientes(ENV.MAXIMO_REGISTROS_POR_LOTE);
    if (lote.length === 0) break;

    try {
      const results = await pesajeService.sincronizarLote(lote);

      for (const res of results) {
        if (res.error) {
          await pesajesRepo.markError(res.localUuid, res.error);
          errorsCount++;
        } else {
          await pesajesRepo.markSincronizado(res.localUuid, res.serverId);
          totalSynced++;
        }
      }

      onProgress?.(totalSynced, totalPendientes);
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Error al sincronizar pesajes';

      for (const p of lote) {
        await pesajesRepo.markError(p.localUuid, errorMsg);
        errorsCount++;
      }
      break;
    }
  }

  return { totalSynced, errorsCount };
}
