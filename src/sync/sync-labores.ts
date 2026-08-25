/**
 * Sincronizador de Registros de Labor (HU-14).
 *
 * Envía registros pendientes en lotes de hasta 10 por request al endpoint
 * `POST /api/registro-labor/sync`.
 */

import { laboresRepo } from '../db/repositories/labores.repo';
import { laborService } from '../services/labor.service';
import { ENV } from '../config/env';

export async function syncLaboresBatch(
  onProgress?: (synced: number, total: number) => void,
): Promise<{ totalSynced: number; errorsCount: number }> {
  let totalSynced = 0;
  let errorsCount = 0;

  const totalPendientes = await laboresRepo.countPendientes();
  if (totalPendientes === 0) {
    return { totalSynced: 0, errorsCount: 0 };
  }

  while (true) {
    // 1. Obtener lote de hasta 10 registros ordenados por created_at_local ASC
    const lote = await laboresRepo.getPendientes(ENV.MAXIMO_REGISTROS_POR_LOTE);
    if (lote.length === 0) break;

    try {
      // 2. Enviar lote al backend
      const results = await laborService.sincronizarLote(lote);

      // 3. Procesar resultados individuales
      for (const res of results) {
        if (res.error) {
          await laboresRepo.markError(res.localUuid, res.error);
          errorsCount++;
        } else {
          await laboresRepo.markSincronizado(res.localUuid, res.serverId);
          totalSynced++;
        }
      }

      onProgress?.(totalSynced, totalPendientes);
    } catch (error: unknown) {
      // Si falla la petición de red (timeout / 500), se marcan como error temporal
      const errorMsg =
        error instanceof Error ? error.message : 'Error al sincronizar con el servidor';

      for (const r of lote) {
        await laboresRepo.markError(r.localUuid, errorMsg);
        errorsCount++;
      }
      break; // Detener el batch si no hay conectividad
    }
  }

  return { totalSynced, errorsCount };
}
