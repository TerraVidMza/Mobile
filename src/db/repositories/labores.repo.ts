/**
 * Repositorio SQLite para Registro de Labores e Insumos (HU-12, HU-13, HU-14, HU-15, HU-17).
 */

import { getDatabase } from '../database';
import { EstadoSync } from '../../types/api.types';
import type {
  RegistroLaborLocal,
  DetalleInsumoLocal,
  CreateRegistroLaborDto,
} from '../../types/api.types';

export const laboresRepo = {
  /**
   * Guarda una nueva labor y sus insumos asociados de forma atómica en SQLite.
   */
  async createLabor(
    labor: Omit<RegistroLaborLocal, 'createdAt' | 'serverId'>,
    insumos: { insumoId: string; cantidad: number }[],
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO registro_labor (
          local_uuid, cuartel_id, tipo_labor_id, fecha, cantidad,
          estado_sync, error_message, created_at_local
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          labor.localUuid,
          labor.cuartelId,
          labor.tipoLaborId,
          labor.fecha,
          labor.cantidad,
          labor.estadoSync,
          labor.errorMessage ?? null,
          labor.createdAtLocal,
        ],
      );

      for (const insumo of insumos) {
        await db.runAsync(
          `INSERT INTO detalle_insumo_labor (labor_local_uuid, insumo_id, cantidad)
           VALUES (?, ?, ?)`,
          [labor.localUuid, insumo.insumoId, insumo.cantidad],
        );
      }
    });
  },

  /**
   * Actualiza una labor existente (resolución de conflictos de catálogo o corrección)
   * y reestablece su estado a PENDIENTE para reintentar la sincronización (HU-14 Criterio 4).
   */
  async updateLabor(
    localUuid: string,
    labor: {
      cuartelId: string;
      tipoLaborId: string;
      fecha: string;
      cantidad: number;
    },
    insumos: { insumoId: string; cantidad: number }[],
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE registro_labor
         SET cuartel_id = ?, tipo_labor_id = ?, fecha = ?, cantidad = ?,
             estado_sync = ?, error_message = NULL
         WHERE local_uuid = ?`,
        [
          labor.cuartelId,
          labor.tipoLaborId,
          labor.fecha,
          labor.cantidad,
          EstadoSync.PENDIENTE,
          localUuid,
        ],
      );

      // Reemplaza insumos
      await db.runAsync(
        `DELETE FROM detalle_insumo_labor WHERE labor_local_uuid = ?`,
        [localUuid],
      );

      for (const insumo of insumos) {
        await db.runAsync(
          `INSERT INTO detalle_insumo_labor (labor_local_uuid, insumo_id, cantidad)
           VALUES (?, ?, ?)`,
          [localUuid, insumo.insumoId, insumo.cantidad],
        );
      }
    });
  },

  /**
   * Elimina un registro local.
   */
  async deleteLabor(localUuid: string): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM detalle_insumo_labor WHERE labor_local_uuid = ?`,
        [localUuid],
      );
      await db.runAsync(
        `DELETE FROM registro_labor WHERE local_uuid = ?`,
        [localUuid],
      );
    });
  },

  /**
   * Obtiene una labor por su UUID local con nombres resueltos de cuartel y labor.
   */
  async getLaborByUuid(localUuid: string): Promise<
    | (RegistroLaborLocal & {
        cuartelNombre: string;
        fincaId?: string;
        fincaNombre?: string;
        tipoLaborNombre: string;
      })
    | null
  > {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      local_uuid: string;
      cuartel_id: string;
      tipo_labor_id: string;
      fecha: string;
      cantidad: number;
      estado_sync: string;
      error_message: string | null;
      created_at_local: string;
      created_at: string;
      server_id: string | null;
      cuartel_nombre: string;
      finca_id: string;
      finca_nombre: string;
      tipo_labor_nombre: string;
    }>(
      `SELECT r.*,
              c.nombre as cuartel_nombre,
              c.finca_id,
              f.nombre as finca_nombre,
              t.nombre as tipo_labor_nombre
       FROM registro_labor r
       LEFT JOIN cuarteles c ON r.cuartel_id = c.id
       LEFT JOIN fincas f ON c.finca_id = f.id
       LEFT JOIN tipos_labor t ON r.tipo_labor_id = t.id
       WHERE r.local_uuid = ?`,
      [localUuid],
    );

    if (!row) return null;

    return {
      localUuid: row.local_uuid,
      cuartelId: row.cuartel_id,
      tipoLaborId: row.tipo_labor_id,
      fecha: row.fecha,
      cantidad: row.cantidad,
      estadoSync: row.estado_sync as EstadoSync,
      errorMessage: row.error_message,
      createdAtLocal: row.created_at_local,
      createdAt: row.created_at,
      serverId: row.server_id,
      cuartelNombre: row.cuartel_nombre ?? 'Cuartel desconocido',
      fincaId: row.finca_id,
      fincaNombre: row.finca_nombre ?? 'Finca desconocida',
      tipoLaborNombre: row.tipo_labor_nombre ?? 'Labor desconocida',
    };
  },

  /**
   * Obtiene todos los registros pendientes de sincronización con sus insumos,
   * ordenados por created_at_local ascendente (criterio HU-14).
   */
  async getPendientes(limit = 10): Promise<CreateRegistroLaborDto[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      local_uuid: string;
      cuartel_id: string;
      tipo_labor_id: string;
      fecha: string;
      cantidad: number;
      created_at_local: string;
    }>(
      `SELECT local_uuid, cuartel_id, tipo_labor_id, fecha, cantidad, created_at_local
       FROM registro_labor
       WHERE estado_sync = ?
       ORDER BY created_at_local ASC
       LIMIT ?`,
      [EstadoSync.PENDIENTE, limit],
    );

    const result: CreateRegistroLaborDto[] = [];

    for (const r of rows) {
      const insumosRows = await db.getAllAsync<{
        insumo_id: string;
        cantidad: number;
      }>(
        `SELECT insumo_id, cantidad
         FROM detalle_insumo_labor
         WHERE labor_local_uuid = ?`,
        [r.local_uuid],
      );

      result.push({
        localUuid: r.local_uuid,
        cuartelId: r.cuartel_id,
        tipoLaborId: r.tipo_labor_id,
        fecha: r.fecha,
        cantidad: r.cantidad,
        createdAtLocal: r.created_at_local,
        insumos: insumosRows.map((i) => ({
          insumoId: i.insumo_id,
          cantidad: i.cantidad,
        })),
      });
    }

    return result;
  },

  /**
   * Cuenta los registros de labor pendientes de sincronización.
   */
  async countPendientes(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM registro_labor WHERE estado_sync = ?`,
      [EstadoSync.PENDIENTE],
    );
    return result?.count ?? 0;
  },

  /**
   * Marca un registro como sincronizado exitosamente.
   */
  async markSincronizado(localUuid: string, serverId?: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE registro_labor
       SET estado_sync = ?, server_id = ?, error_message = NULL
       WHERE local_uuid = ?`,
      [EstadoSync.SINCRONIZADO, serverId ?? null, localUuid],
    );
  },

  /**
   * Marca un registro con error de sincronización.
   */
  async markError(localUuid: string, errorMessage: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE registro_labor
       SET estado_sync = ?, error_message = ?
       WHERE local_uuid = ?`,
      [EstadoSync.ERROR, errorMessage, localUuid],
    );
  },

  /**
   * Obtiene las labores con filtros avanzados (fecha, fincaId, cuartelId).
   */
  async getLaboresFiltered(filters?: {
    fecha?: string;
    fincaId?: string;
    cuartelId?: string;
  }): Promise<
    (RegistroLaborLocal & {
      cuartelNombre: string;
      fincaNombre: string;
      tipoLaborNombre: string;
      insumosCount: number;
    })[]
  > {
    const db = await getDatabase();
    let query = `
      SELECT r.*,
             c.nombre as cuartel_nombre,
             f.nombre as finca_nombre,
             t.nombre as tipo_labor_nombre,
             (SELECT COUNT(*) FROM detalle_insumo_labor d WHERE d.labor_local_uuid = r.local_uuid) as insumos_count
      FROM registro_labor r
      LEFT JOIN cuarteles c ON r.cuartel_id = c.id
      LEFT JOIN fincas f ON c.finca_id = f.id
      LEFT JOIN tipos_labor t ON r.tipo_labor_id = t.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (filters?.fecha) {
      query += ` AND r.fecha = ?`;
      params.push(filters.fecha);
    }
    if (filters?.fincaId) {
      query += ` AND c.finca_id = ?`;
      params.push(filters.fincaId);
    }
    if (filters?.cuartelId) {
      query += ` AND r.cuartel_id = ?`;
      params.push(filters.cuartelId);
    }

    query += ` ORDER BY r.created_at_local DESC`;

    const rows = await db.getAllAsync<{
      local_uuid: string;
      cuartel_id: string;
      tipo_labor_id: string;
      fecha: string;
      cantidad: number;
      estado_sync: string;
      error_message: string | null;
      created_at_local: string;
      created_at: string;
      server_id: string | null;
      cuartel_nombre: string;
      finca_nombre: string;
      tipo_labor_nombre: string;
      insumos_count: number;
    }>(query, params);

    return rows.map((r) => ({
      localUuid: r.local_uuid,
      cuartelId: r.cuartel_id,
      tipoLaborId: r.tipo_labor_id,
      fecha: r.fecha,
      cantidad: r.cantidad,
      estadoSync: r.estado_sync as EstadoSync,
      errorMessage: r.error_message,
      createdAtLocal: r.created_at_local,
      createdAt: r.created_at,
      serverId: r.server_id,
      cuartelNombre: r.cuartel_nombre ?? 'Cuartel desconocido',
      fincaNombre: r.finca_nombre ?? 'Finca desconocida',
      tipoLaborNombre: r.tipo_labor_nombre ?? 'Labor desconocida',
      insumosCount: r.insumos_count,
    }));
  },

  /**
   * Obtiene los detalles de insumos de una labor específica.
   */
  async getInsumosDeLabor(laborLocalUuid: string): Promise<
    (DetalleInsumoLocal & { insumoNombre: string; unidadMedida: string | null })[]
  > {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      labor_local_uuid: string;
      insumo_id: string;
      cantidad: number;
      insumo_nombre: string;
      unidad_medida: string | null;
    }>(
      `SELECT d.*, i.nombre as insumo_nombre, i.unidad_medida
       FROM detalle_insumo_labor d
       LEFT JOIN insumos i ON d.insumo_id = i.id
       WHERE d.labor_local_uuid = ?`,
      [laborLocalUuid],
    );

    return rows.map((r) => ({
      id: r.id,
      laborLocalUuid: r.labor_local_uuid,
      insumoId: r.insumo_id,
      cantidad: r.cantidad,
      insumoNombre: r.insumo_nombre ?? 'Insumo desconocido',
      unidadMedida: r.unidad_medida,
    }));
  },
};
