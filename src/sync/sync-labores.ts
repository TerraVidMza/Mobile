/**
 * Sincronizador de Registros de Labor (HU-14).
 *
 * Envía registros pendientes en lotes de hasta 10 por request al endpoint
 * `POST /api/registro-labor/sync`. La lógica de lotes y reintentos está en
 * `sync-lotes.ts` (M-003).
 */

import { laboresRepo } from '../db/repositories/labores.repo';
import { laborService } from '../services/labor.service';
import { sincronizarEnLotes, type ResultadoSync } from './sync-lotes';

export function syncLaboresBatch(
  onProgress?: (synced: number, total: number) => void,
): Promise<ResultadoSync> {
  return sincronizarEnLotes(
    {
      contarPendientes: () => laboresRepo.countPendientes(),
      obtenerPendientes: (limit, offset) => laboresRepo.getPendientes(limit, offset),
      enviarLote: (registros) => laborService.sincronizarLote(registros),
      enviarUno: (registro) => laborService.registrarUno(registro),
      marcarSincronizado: (uuid, serverId) => laboresRepo.markSincronizado(uuid, serverId),
      registrarIntentoFallido: (uuid, msg) => laboresRepo.registrarIntentoFallido(uuid, msg),
      idServidor: (res) => res.registroId,
    },
    onProgress,
  );
}
