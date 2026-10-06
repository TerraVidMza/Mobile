/**
 * Avance de la cosecha contra la meta de la campaña — M-010 (D-027).
 *
 * El backend calcula, por cuartel, la meta y los kilos ya pesados en la
 * campaña en curso. La respuesta se guarda en `sync_meta` para mostrar el
 * último dato conocido sin señal; los pesajes cargados después, todavía sin
 * sincronizar, se suman del lado del teléfono.
 */

import api from './api';
import { getDatabase } from '../db/database';

export interface AvanceCosecha {
  campania: { id: string; nombre: string; fechaDesde: string; fechaHasta: string } | null;
  metaKg: number | null;
  kgCosechados: number;
  cuarteles: Array<{ cuartelId: string; metaKg: number | null; kgCosechados: number }>;
}

const CLAVE = 'avance_cosecha';

export const avanceService = {
  /** Del servidor si hay señal; si no, el último guardado. */
  async obtener(): Promise<{ avance: AvanceCosecha | null; actualizadoAt: string | null }> {
    const db = await getDatabase();
    try {
      const { data } = await api.get<AvanceCosecha>('/campanias/actual/avance');
      const guardado = { avance: data, actualizadoAt: new Date().toISOString() };
      await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, [
        CLAVE,
        JSON.stringify(guardado),
      ]);
      return guardado;
    } catch {
      const fila = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_meta WHERE key = ?`,
        [CLAVE],
      );
      return fila ? JSON.parse(fila.value) : { avance: null, actualizadoAt: null };
    }
  },

  /** Kilos de pesajes cargados en el teléfono que el servidor todavía no tiene. */
  async kilosPendientes(): Promise<number> {
    const db = await getDatabase();
    const fila = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(peso_kg) AS total FROM pesaje_vendimia WHERE estado_sync = 'pendiente'`,
    );
    return fila?.total ?? 0;
  },
};
