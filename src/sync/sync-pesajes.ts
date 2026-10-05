/**
 * Sincronizador de Pesajes de Vendimia (HU-24).
 *
 * Envía registros pendientes en lotes de hasta 10 por request al endpoint
 * `POST /api/pesajes-vendimia/sync`. La lógica de lotes y reintentos está en
 * `sync-lotes.ts` (M-003).
 */

import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { pesajeService } from '../services/pesaje.service';
import { sincronizarEnLotes, type ResultadoSync } from './sync-lotes';

export function syncPesajesBatch(
  onProgress?: (synced: number, total: number) => void,
): Promise<ResultadoSync> {
  return sincronizarEnLotes(
    {
      contarPendientes: () => pesajesRepo.countPendientes(),
      obtenerPendientes: (limit, offset) => pesajesRepo.getPendientes(limit, offset),
      enviarLote: (pesajes) => pesajeService.sincronizarLote(pesajes),
      enviarUno: (pesaje) => pesajeService.registrarUno(pesaje),
      marcarSincronizado: (uuid, serverId) => pesajesRepo.markSincronizado(uuid, serverId),
      registrarIntentoFallido: (uuid, msg) => pesajesRepo.registrarIntentoFallido(uuid, msg),
      idServidor: (res) => res.pesajeId,
    },
    onProgress,
  );
}
