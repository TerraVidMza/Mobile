/**
 * Envío de registros pendientes en lotes — HU-14, M-003.
 *
 * Lo comparten labores y pesajes. Reglas:
 *
 * - Lotes de hasta 10, del más viejo al más nuevo.
 * - Un registro que el backend no acepta **sigue pendiente**: se guarda el
 *   mensaje, se suma un intento y el motor lo reintenta más tarde.
 * - Sin conexión, error 5xx, 401 o 429: se corta la ronda. El lote en curso
 *   queda pendiente con el motivo y no se insiste con los siguientes.
 * - Si el backend rechaza el lote entero (400/403/404/409/422, por ejemplo un
 *   cuartel dado de baja en un solo registro), se envían de a uno para que el
 *   registro problemático no bloquee al resto.
 */

import axios from 'axios';
import { ENV } from '../config/env';
import { EstadoSync, type SyncResultItem } from '../types/api.types';

export interface FuenteSync<T extends { localUuid: string }> {
  contarPendientes(): Promise<number>;
  obtenerPendientes(limit: number, offset: number): Promise<T[]>;
  enviarLote(registros: T[]): Promise<SyncResultItem[]>;
  enviarUno(registro: T): Promise<SyncResultItem>;
  marcarSincronizado(localUuid: string, serverId?: string): Promise<void>;
  registrarIntentoFallido(localUuid: string, mensaje: string): Promise<void>;
  /** Id del servidor dentro del resultado (`registroId` o `pesajeId`). */
  idServidor(resultado: SyncResultItem): string | undefined;
}

export interface ResultadoSync {
  totalSynced: number;
  errorsCount: number;
  /** true si la ronda se cortó por conectividad o por el servidor (reintentable). */
  interrumpido: boolean;
}

/** Fallos que no dependen del contenido del lote: conviene esperar y reintentar todo. */
function esFalloTransitorio(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return true;
  const status = error.response?.status;
  return status === undefined || status >= 500 || status === 401 || status === 429;
}

export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Sin conexión con el servidor';
    const data = error.response.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join('. ');
    if (typeof msg === 'string' && msg.length > 0) return msg;
    return `El servidor respondió ${error.response.status}`;
  }
  return error instanceof Error ? error.message : porDefecto;
}

export async function sincronizarEnLotes<T extends { localUuid: string }>(
  fuente: FuenteSync<T>,
  onProgress?: (synced: number, total: number) => void,
): Promise<ResultadoSync> {
  let totalSynced = 0;
  let errorsCount = 0;

  const totalPendientes = await fuente.contarPendientes();
  if (totalPendientes === 0) {
    return { totalSynced: 0, errorsCount: 0, interrumpido: false };
  }

  const aplicar = async (res: SyncResultItem) => {
    if (res.estado === EstadoSync.SINCRONIZADO) {
      await fuente.marcarSincronizado(res.localUuid, fuente.idServidor(res));
      totalSynced++;
    } else {
      await fuente.registrarIntentoFallido(
        res.localUuid,
        res.errorMessage ?? 'El servidor no aceptó el registro',
      );
      errorsCount++;
    }
  };

  const fallarTodos = async (lote: T[], mensaje: string) => {
    for (const r of lote) {
      await fuente.registrarIntentoFallido(r.localUuid, mensaje);
      errorsCount++;
    }
  };

  // Los que fallan siguen pendientes y quedan primeros en el orden: se saltean.
  while (true) {
    const lote = await fuente.obtenerPendientes(ENV.MAXIMO_REGISTROS_POR_LOTE, errorsCount);
    if (lote.length === 0) break;

    try {
      const resultados = await fuente.enviarLote(lote);
      const procesados = new Set<string>();
      for (const res of resultados) {
        procesados.add(res.localUuid);
        await aplicar(res);
      }
      // Un registro sin resultado no se da por sincronizado.
      await fallarTodos(
        lote.filter((r) => !procesados.has(r.localUuid)),
        'El servidor no devolvió resultado para este registro',
      );
    } catch (error: unknown) {
      if (esFalloTransitorio(error)) {
        await fallarTodos(lote, mensajeDeError(error, 'Error al sincronizar con el servidor'));
        onProgress?.(totalSynced, totalPendientes);
        return { totalSynced, errorsCount, interrumpido: true };
      }

      // El backend rechazó el lote entero: de a uno para aislar al culpable.
      for (let i = 0; i < lote.length; i++) {
        try {
          await aplicar(await fuente.enviarUno(lote[i]));
        } catch (errorUno: unknown) {
          if (esFalloTransitorio(errorUno)) {
            await fallarTodos(lote.slice(i), mensajeDeError(errorUno, 'Error al sincronizar'));
            onProgress?.(totalSynced, totalPendientes);
            return { totalSynced, errorsCount, interrumpido: true };
          }
          await fuente.registrarIntentoFallido(
            lote[i].localUuid,
            mensajeDeError(errorUno, 'El servidor no aceptó el registro'),
          );
          errorsCount++;
        }
      }
    }

    onProgress?.(totalSynced, totalPendientes);
  }

  return { totalSynced, errorsCount, interrumpido: false };
}
