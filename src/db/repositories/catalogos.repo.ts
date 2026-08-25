/**
 * Repositorio SQLite para Catálogos Maestros.
 *
 * Administra fincas, cuarteles, tipos de labor, insumos y cuadrillas
 * en la base de datos local para que los formularios funcionen sin conexión.
 */

import { getDatabase } from '../database';
import type { Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../../types/api.types';

export const catalogosRepo = {
  // ─── Fincas ───────────────────────────────────────────────────────────────

  async saveFincas(fincas: Finca[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const f of fincas) {
        await db.runAsync(
          `INSERT OR REPLACE INTO fincas (id, nombre, ubicacion, superficie, activo)
           VALUES (?, ?, ?, ?, ?)`,
          [f.id, f.nombre, f.ubicacion ?? null, f.superficie ?? null, f.activo ? 1 : 0],
        );
      }
    });
  },

  async getFincas(): Promise<Finca[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      nombre: string;
      ubicacion: string | null;
      superficie: number | null;
      activo: number;
    }>('SELECT * FROM fincas WHERE activo = 1 ORDER BY nombre ASC');

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      ubicacion: r.ubicacion,
      superficie: r.superficie,
      activo: r.activo === 1,
    }));
  },

  // ─── Cuarteles ────────────────────────────────────────────────────────────

  async saveCuarteles(cuarteles: Cuartel[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const c of cuarteles) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cuarteles (id, finca_id, nombre, variedad, superficie, anio_plantacion, estado, activo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id,
            c.fincaId,
            c.nombre,
            c.variedad ?? null,
            c.superficie ?? null,
            c.anioPlantacion ?? null,
            c.estado ?? null,
            c.activo ? 1 : 0,
          ],
        );
      }
    });
  },

  async getCuartelesByFinca(fincaId: string): Promise<Cuartel[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      finca_id: string;
      nombre: string;
      variedad: string | null;
      superficie: number | null;
      anio_plantacion: number | null;
      estado: string | null;
      activo: number;
    }>('SELECT * FROM cuarteles WHERE finca_id = ? AND activo = 1 ORDER BY nombre ASC', [fincaId]);

    return rows.map((r) => ({
      id: r.id,
      fincaId: r.finca_id,
      nombre: r.nombre,
      variedad: r.variedad,
      superficie: r.superficie,
      anioPlantacion: r.anio_plantacion,
      estado: r.estado,
      activo: r.activo === 1,
    }));
  },

  // ─── Tipos de labor ───────────────────────────────────────────────────────

  async saveTiposLabor(tipos: TipoLabor[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const t of tipos) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tipos_labor (id, nombre, unidad_medida, activo)
           VALUES (?, ?, ?, ?)`,
          [t.id, t.nombre, t.unidadMedida ?? null, t.activo ? 1 : 0],
        );
      }
    });
  },

  async getTiposLabor(): Promise<TipoLabor[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      nombre: string;
      unidad_medida: string | null;
      activo: number;
    }>('SELECT * FROM tipos_labor WHERE activo = 1 ORDER BY nombre ASC');

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      unidadMedida: r.unidad_medida,
      activo: r.activo === 1,
    }));
  },

  // ─── Insumos ──────────────────────────────────────────────────────────────

  async saveInsumos(insumos: Insumo[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const i of insumos) {
        await db.runAsync(
          `INSERT OR REPLACE INTO insumos (id, nombre, unidad_medida, activo)
           VALUES (?, ?, ?, ?)`,
          [i.id, i.nombre, i.unidadMedida ?? null, i.activo ? 1 : 0],
        );
      }
    });
  },

  async getInsumos(): Promise<Insumo[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      nombre: string;
      unidad_medida: string | null;
      activo: number;
    }>('SELECT * FROM insumos WHERE activo = 1 ORDER BY nombre ASC');

    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      unidadMedida: r.unidad_medida,
      activo: r.activo === 1,
    }));
  },

  // ─── Cuadrillas ───────────────────────────────────────────────────────────

  async saveCuadrillas(cuadrillas: Cuadrilla[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const c of cuadrillas) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cuadrillas (id, finca_id, nombre, activa)
           VALUES (?, ?, ?, ?)`,
          [c.id, c.fincaId, c.nombre, c.activa ? 1 : 0],
        );
      }
    });
  },

  async getCuadrillasByFinca(fincaId: string): Promise<Cuadrilla[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      finca_id: string;
      nombre: string;
      activa: number;
    }>('SELECT * FROM cuadrillas WHERE finca_id = ? AND activa = 1 ORDER BY nombre ASC', [fincaId]);

    return rows.map((r) => ({
      id: r.id,
      fincaId: r.finca_id,
      nombre: r.nombre,
      activa: r.activa === 1,
    }));
  },
};
