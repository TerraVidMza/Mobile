/**
 * Repositorio SQLite para Pesajes de Vendimia (HU-24, HU-27).
 */

import { getDatabase } from '../database';
import { EstadoSync } from '../../types/api.types';
import type { PesajeVendimiaLocal, CreatePesajeDto } from '../../types/api.types';

export interface ResumenCuadrilla {
  cuadrillaId: string;
  cuadrillaNombre: string;
  totalKg: number;
  pesajesCount: number;
}

export const pesajesRepo = {
  /**
   * Guarda un nuevo pesaje de vendimia en SQLite con estado pendiente.
   */
  async createPesaje(
    pesaje: Omit<PesajeVendimiaLocal, 'createdAt' | 'serverId' | 'intentosSync'>,
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO pesaje_vendimia (
        local_uuid, cuadrilla_id, cuartel_id, fecha, peso_kg,
        estado_sync, error_message, created_at_local
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pesaje.localUuid,
        pesaje.cuadrillaId,
        pesaje.cuartelId,
        pesaje.fecha,
        pesaje.pesoKg,
        pesaje.estadoSync,
        pesaje.errorMessage ?? null,
        pesaje.createdAtLocal,
      ],
    );
  },

  /**
   * Actualiza un pesaje (resolución de conflicto o corrección de kilos)
   * y reestablece su estado a PENDIENTE para reintentar la sincronización.
   */
  async updatePesaje(
    localUuid: string,
    pesaje: {
      cuadrillaId: string;
      cuartelId: string;
      fecha: string;
      pesoKg: number;
    },
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE pesaje_vendimia
       SET cuadrilla_id = ?, cuartel_id = ?, fecha = ?, peso_kg = ?,
           estado_sync = ?, error_message = NULL, intentos_sync = 0
       WHERE local_uuid = ?`,
      [
        pesaje.cuadrillaId,
        pesaje.cuartelId,
        pesaje.fecha,
        pesaje.pesoKg,
        EstadoSync.PENDIENTE,
        localUuid,
      ],
    );
  },

  /**
   * Elimina un pesaje local.
   */
  async deletePesaje(localUuid: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM pesaje_vendimia WHERE local_uuid = ?`, [localUuid]);
  },

  /**
   * Obtiene un pesaje por UUID local con nombres resueltos.
   */
  async getPesajeByUuid(localUuid: string): Promise<
    | (PesajeVendimiaLocal & {
        cuadrillaNombre: string;
        cuartelNombre: string;
        fincaId?: string;
        fincaNombre?: string;
      })
    | null
  > {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      local_uuid: string;
      cuadrilla_id: string;
      cuartel_id: string;
      fecha: string;
      peso_kg: number;
      estado_sync: string;
      error_message: string | null;
      intentos_sync: number;
      created_at_local: string;
      created_at: string;
      server_id: string | null;
      cuadrilla_nombre: string;
      cuartel_nombre: string;
      finca_id: string;
      finca_nombre: string;
    }>(
      `SELECT p.*,
              cu.nombre as cuadrilla_nombre,
              ct.nombre as cuartel_nombre,
              ct.finca_id,
              f.nombre as finca_nombre
       FROM pesaje_vendimia p
       LEFT JOIN cuadrillas cu ON p.cuadrilla_id = cu.id
       LEFT JOIN cuarteles ct ON p.cuartel_id = ct.id
       LEFT JOIN fincas f ON ct.finca_id = f.id
       WHERE p.local_uuid = ?`,
      [localUuid],
    );

    if (!row) return null;

    return {
      localUuid: row.local_uuid,
      cuadrillaId: row.cuadrilla_id,
      cuartelId: row.cuartel_id,
      fecha: row.fecha,
      pesoKg: row.peso_kg,
      estadoSync: row.estado_sync as EstadoSync,
      errorMessage: row.error_message,
      intentosSync: row.intentos_sync,
      createdAtLocal: row.created_at_local,
      createdAt: row.created_at,
      serverId: row.server_id,
      cuadrillaNombre: row.cuadrilla_nombre ?? 'Cuadrilla desconocida',
      cuartelNombre: row.cuartel_nombre ?? 'Cuartel desconocido',
      fincaId: row.finca_id,
      fincaNombre: row.finca_nombre ?? 'Finca desconocida',
    };
  },

  /**
   * Obtiene los pesajes pendientes de sincronización (lotes de máx 10), ya con
   * la forma del DTO del backend (`kgTotales`).
   *
   * `offset` saltea los que ya fallaron en la ronda en curso (M-003).
   */
  async getPendientes(limit = 10, offset = 0): Promise<CreatePesajeDto[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      local_uuid: string;
      cuadrilla_id: string;
      cuartel_id: string;
      fecha: string;
      peso_kg: number;
      created_at_local: string;
    }>(
      `SELECT local_uuid, cuadrilla_id, cuartel_id, fecha, peso_kg, created_at_local
       FROM pesaje_vendimia
       WHERE estado_sync = ?
       ORDER BY created_at_local ASC, local_uuid ASC
       LIMIT ? OFFSET ?`,
      [EstadoSync.PENDIENTE, limit, offset],
    );

    return rows.map((r) => ({
      localUuid: r.local_uuid,
      cuadrillaId: r.cuadrilla_id,
      cuartelId: r.cuartel_id,
      fecha: r.fecha,
      // El backend llama kgTotales a lo que localmente es peso_kg.
      kgTotales: r.peso_kg,
      createdAtLocal: r.created_at_local,
    }));
  },

  /**
   * Cuenta los pesajes pendientes de sincronización.
   */
  async countPendientes(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM pesaje_vendimia WHERE estado_sync = ?`,
      [EstadoSync.PENDIENTE],
    );
    return result?.count ?? 0;
  },

  /**
   * Marca un pesaje como sincronizado.
   */
  async markSincronizado(localUuid: string, serverId?: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE pesaje_vendimia
       SET estado_sync = ?, server_id = ?, error_message = NULL
       WHERE local_uuid = ?`,
      [EstadoSync.SINCRONIZADO, serverId ?? null, localUuid],
    );
  },

  /**
   * Registra un intento de sincronización fallido: el pesaje sigue pendiente
   * con el mensaje del error (M-003).
   */
  async registrarIntentoFallido(localUuid: string, errorMessage: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE pesaje_vendimia
       SET estado_sync = ?, error_message = ?, intentos_sync = intentos_sync + 1
       WHERE local_uuid = ?`,
      [EstadoSync.PENDIENTE, errorMessage, localUuid],
    );
  },

  /**
   * Obtiene pesajes de una fecha con datos de cuadrilla y cuartel para la UI.
   */
  async getPesajesByFecha(fecha: string): Promise<
    (PesajeVendimiaLocal & {
      cuadrillaNombre: string;
      cuartelNombre: string;
    })[]
  > {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      local_uuid: string;
      cuadrilla_id: string;
      cuartel_id: string;
      fecha: string;
      peso_kg: number;
      estado_sync: string;
      error_message: string | null;
      intentos_sync: number;
      created_at_local: string;
      created_at: string;
      server_id: string | null;
      cuadrilla_nombre: string;
      cuartel_nombre: string;
    }>(
      `SELECT p.*,
              cu.nombre as cuadrilla_nombre,
              ct.nombre as cuartel_nombre
       FROM pesaje_vendimia p
       LEFT JOIN cuadrillas cu ON p.cuadrilla_id = cu.id
       LEFT JOIN cuarteles ct ON p.cuartel_id = ct.id
       WHERE p.fecha = ?
       ORDER BY p.created_at_local DESC`,
      [fecha],
    );

    return rows.map((r) => ({
      localUuid: r.local_uuid,
      cuadrillaId: r.cuadrilla_id,
      cuartelId: r.cuartel_id,
      fecha: r.fecha,
      pesoKg: r.peso_kg,
      estadoSync: r.estado_sync as EstadoSync,
      errorMessage: r.error_message,
      intentosSync: r.intentos_sync,
      createdAtLocal: r.created_at_local,
      createdAt: r.created_at,
      serverId: r.server_id,
      cuadrillaNombre: r.cuadrilla_nombre ?? 'Cuadrilla desconocida',
      cuartelNombre: r.cuartel_nombre ?? 'Cuartel desconocido',
    }));
  },

  /**
   * Obtiene el desglose agrupado por cuadrilla para la fecha dada (HU-27).
   */
  async getResumenPorCuadrilla(fecha: string): Promise<ResumenCuadrilla[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      cuadrilla_id: string;
      cuadrilla_nombre: string;
      total_kg: number;
      pesajes_count: number;
    }>(
      `SELECT p.cuadrilla_id,
              cu.nombre as cuadrilla_nombre,
              SUM(p.peso_kg) as total_kg,
              COUNT(p.local_uuid) as pesajes_count
       FROM pesaje_vendimia p
       LEFT JOIN cuadrillas cu ON p.cuadrilla_id = cu.id
       WHERE p.fecha = ?
       GROUP BY p.cuadrilla_id, cu.nombre
       ORDER BY total_kg DESC`,
      [fecha],
    );

    return rows.map((r) => ({
      cuadrillaId: r.cuadrilla_id,
      cuadrillaNombre: r.cuadrilla_nombre ?? 'Cuadrilla',
      totalKg: r.total_kg ?? 0,
      pesajesCount: r.pesajes_count ?? 0,
    }));
  },
};
