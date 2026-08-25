/**
 * Inicialización y acceso a la base de datos local.
 *
 * - En Android / iOS: utiliza SQLite nativo (expo-sqlite) con WAL mode y FKs.
 * - En Web: provee un adaptador compatible con persistencia en localStorage / memoria
 *   para permitir probar la app en navegadores sin errores de módulos nativos.
 */

import { Platform } from 'react-native';
import { CREATE_TABLES, SCHEMA_VERSION } from './schema';

export interface AppDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: (string | number | boolean | null)[],
  ): Promise<{ lastInsertRowId?: number; changes?: number }>;
  getAllAsync<T = unknown>(
    sql: string,
    params?: (string | number | boolean | null)[],
  ): Promise<T[]>;
  getFirstAsync<T = unknown>(
    sql: string,
    params?: (string | number | boolean | null)[],
  ): Promise<T | null>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
  closeAsync(): Promise<void>;
}

const DB_NAME = 'terravid.db';
let _db: AppDatabase | null = null;

// ─── Adaptador Web (localStorage / memoria) ──────────────────────────────────

class WebDatabase implements AppDatabase {
  private tables: { [tableName: string]: any[] } = {};
  private autoIds: { [tableName: string]: number } = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = window.localStorage.getItem('terravid_web_db');
        if (data) {
          const parsed = JSON.parse(data);
          this.tables = parsed.tables ?? {};
          this.autoIds = parsed.autoIds ?? {};
        }
      } catch {
        // Fallback memoria
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          'terravid_web_db',
          JSON.stringify({ tables: this.tables, autoIds: this.autoIds }),
        );
      } catch {
        // Ignorar
      }
    }
  }

  private getTable(name: string): any[] {
    if (!this.tables[name]) {
      this.tables[name] = [];
    }
    return this.tables[name];
  }

  async execAsync(sql: string): Promise<void> {
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
    if (createMatch) {
      const tableName = createMatch[1];
      this.getTable(tableName);
    }
  }

  async runAsync(
    sql: string,
    params: (string | number | boolean | null)[] = [],
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    const trimmed = sql.trim();

    // DELETE FROM
    const deleteMatch = trimmed.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const table = this.getTable(tableName);
      const uuid = params[0];

      if (tableName === 'detalle_insumo_labor') {
        this.tables[tableName] = table.filter((d) => d.labor_local_uuid !== uuid);
      } else if (tableName === 'registro_labor' || tableName === 'pesaje_vendimia') {
        this.tables[tableName] = table.filter((r) => r.local_uuid !== uuid);
      }

      this.saveToStorage();
      return { changes: 1 };
    }

    // INSERT OR REPLACE / INSERT INTO
    const insertMatch = trimmed.match(/INSERT (?:OR REPLACE INTO|INTO)\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const cols = insertMatch[2].split(',').map((c) => c.trim().toLowerCase());
      const row: any = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });

      const table = this.getTable(tableName);

      if (tableName === 'detalle_insumo_labor') {
        if (!this.autoIds[tableName]) this.autoIds[tableName] = 0;
        this.autoIds[tableName]++;
        row.id = this.autoIds[tableName];
      }

      // Check PK
      const pkCol = cols[0];
      const existingIdx = table.findIndex((r) => r[pkCol] === row[pkCol]);
      if (existingIdx >= 0) {
        table[existingIdx] = { ...table[existingIdx], ...row };
      } else {
        table.push(row);
      }

      this.saveToStorage();
      return { changes: 1, lastInsertRowId: row.id };
    }

    // UPDATE
    const updateMatch = trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.*?)\s+WHERE\s+(.*)/i)
      || trimmed.match(/UPDATE\s+(\w+)\s+SET\s+(.*)/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const table = this.getTable(tableName);
      let changes = 0;

      if (tableName === 'registro_labor') {
        if (params.length === 6) {
          // updateLabor (cuartel_id, tipo_labor_id, fecha, cantidad, estado_sync, local_uuid)
          const [cuartelId, tipoLaborId, fecha, cantidad, estadoSync, localUuid] = params;
          for (const r of table) {
            if (r.local_uuid === localUuid) {
              r.cuartel_id = cuartelId;
              r.tipo_labor_id = tipoLaborId;
              r.fecha = fecha;
              r.cantidad = cantidad;
              r.estado_sync = estadoSync;
              r.error_message = null;
              changes++;
            }
          }
        } else {
          // markSincronizado / markError
          const localUuid = params[params.length - 1];
          const estado = params[0];
          const secondParam = params.length > 2 ? params[1] : null;

          for (const r of table) {
            if (r.local_uuid === localUuid) {
              r.estado_sync = estado;
              if (trimmed.includes('server_id')) {
                r.server_id = secondParam;
                r.error_message = null;
              } else if (trimmed.includes('error_message')) {
                r.error_message = secondParam;
              }
              changes++;
            }
          }
        }
      } else if (tableName === 'pesaje_vendimia') {
        if (params.length === 6) {
          // updatePesaje (cuadrilla_id, cuartel_id, fecha, peso_kg, estado_sync, local_uuid)
          const [cuadrillaId, cuartelId, fecha, pesoKg, estadoSync, localUuid] = params;
          for (const p of table) {
            if (p.local_uuid === localUuid) {
              p.cuadrilla_id = cuadrillaId;
              p.cuartel_id = cuartelId;
              p.fecha = fecha;
              p.peso_kg = pesoKg;
              p.estado_sync = estadoSync;
              p.error_message = null;
              changes++;
            }
          }
        } else {
          const localUuid = params[params.length - 1];
          const estado = params[0];
          const secondParam = params.length > 2 ? params[1] : null;

          for (const p of table) {
            if (p.local_uuid === localUuid) {
              p.estado_sync = estado;
              if (trimmed.includes('server_id')) {
                p.server_id = secondParam;
                p.error_message = null;
              } else if (trimmed.includes('error_message')) {
                p.error_message = secondParam;
              }
              changes++;
            }
          }
        }
      }

      this.saveToStorage();
      return { changes };
    }

    return { changes: 0 };
  }

  async getAllAsync<T = unknown>(
    sql: string,
    params: (string | number | boolean | null)[] = [],
  ): Promise<T[]> {
    const trimmed = sql.trim();

    if (/SELECT \* FROM fincas/i.test(trimmed)) {
      return this.getTable('fincas').filter((f) => f.activo === 1) as T[];
    }
    if (/SELECT \* FROM cuarteles WHERE finca_id = \?/i.test(trimmed)) {
      const fincaId = params[0];
      return this.getTable('cuarteles').filter((c) => c.finca_id === fincaId && c.activo === 1) as T[];
    }
    if (/SELECT \* FROM tipos_labor/i.test(trimmed)) {
      return this.getTable('tipos_labor').filter((t) => t.activo === 1) as T[];
    }
    if (/SELECT \* FROM insumos/i.test(trimmed)) {
      return this.getTable('insumos').filter((i) => i.activo === 1) as T[];
    }
    if (/SELECT \* FROM cuadrillas WHERE finca_id = \?/i.test(trimmed)) {
      const fincaId = params[0];
      return this.getTable('cuadrillas').filter((c) => c.finca_id === fincaId && c.activa === 1) as T[];
    }
    if (/FROM registro_labor\s+WHERE estado_sync = \?/i.test(trimmed)) {
      const estado = params[0];
      return this.getTable('registro_labor').filter((r) => r.estado_sync === estado) as T[];
    }
    if (/FROM detalle_insumo_labor/i.test(trimmed) && !/FROM registro_labor/i.test(trimmed)) {
      const uuid = params[0];
      const insumos = this.getTable('insumos');
      const detalles = this.getTable('detalle_insumo_labor').filter((d) => d.labor_local_uuid === uuid);
      return detalles.map((d) => {
        const ins = insumos.find((i) => i.id === d.insumo_id);
        return {
          ...d,
          insumo_nombre: ins?.nombre ?? 'Insumo',
          unidad_medida: ins?.unidad_medida ?? 'u',
        };
      }) as T[];
    }
    if (/FROM pesaje_vendimia\s+WHERE estado_sync = \?/i.test(trimmed)) {
      const estado = params[0];
      return this.getTable('pesaje_vendimia').filter((p) => p.estado_sync === estado) as T[];
    }
    if (/SUM\(p\.peso_kg\)\s+as total_kg/i.test(trimmed)) {
      // getResumenPorCuadrilla
      const fecha = params[0];
      const cuadrillas = this.getTable('cuadrillas');
      const pesajes = this.getTable('pesaje_vendimia').filter((p) => !fecha || p.fecha === fecha);

      const map: { [id: string]: { cuadrilla_id: string; cuadrilla_nombre: string; total_kg: number; pesajes_count: number } } = {};
      for (const p of pesajes) {
        const cu = cuadrillas.find((c) => c.id === p.cuadrilla_id);
        if (!map[p.cuadrilla_id]) {
          map[p.cuadrilla_id] = {
            cuadrilla_id: p.cuadrilla_id,
            cuadrilla_nombre: cu?.nombre ?? 'Cuadrilla',
            total_kg: 0,
            pesajes_count: 0,
          };
        }
        map[p.cuadrilla_id].total_kg += p.peso_kg;
        map[p.cuadrilla_id].pesajes_count += 1;
      }
      return Object.values(map) as T[];
    }
    if (/FROM registro_labor/i.test(trimmed)) {
      // getLaboresFiltered / getLaboresByFecha / getLaborByUuid
      const fincas = this.getTable('fincas');
      const cuarteles = this.getTable('cuarteles');
      const tipos = this.getTable('tipos_labor');
      const detalles = this.getTable('detalle_insumo_labor');

      let filtered = [...this.getTable('registro_labor')];

      if (/WHERE r\.local_uuid = \?/i.test(trimmed)) {
        const uuid = params[0];
        filtered = filtered.filter((r) => r.local_uuid === uuid);
      } else {
        let paramIdx = 0;
        if (trimmed.includes('r.fecha = ?')) {
          const fecha = params[paramIdx++];
          filtered = filtered.filter((r) => r.fecha === fecha);
        }
        if (trimmed.includes('c.finca_id = ?')) {
          const fincaId = params[paramIdx++];
          filtered = filtered.filter((r) => {
            const c = cuarteles.find((x) => x.id === r.cuartel_id);
            return c?.finca_id === fincaId;
          });
        }
        if (trimmed.includes('r.cuartel_id = ?')) {
          const cuartelId = params[paramIdx++];
          filtered = filtered.filter((r) => r.cuartel_id === cuartelId);
        }
      }

      return filtered.map((r) => {
        const c = cuarteles.find((x) => x.id === r.cuartel_id);
        const f = fincas.find((x) => x.id === c?.finca_id);
        const t = tipos.find((x) => x.id === r.tipo_labor_id);
        const count = detalles.filter((d) => d.labor_local_uuid === r.local_uuid).length;
        return {
          ...r,
          cuartel_nombre: c?.nombre ?? 'Cuartel',
          finca_id: c?.finca_id,
          finca_nombre: f?.nombre ?? 'Finca',
          tipo_labor_nombre: t?.nombre ?? 'Labor',
          insumos_count: count,
        };
      }) as T[];
    }
    if (/FROM pesaje_vendimia/i.test(trimmed)) {
      const fincas = this.getTable('fincas');
      const cuadrillas = this.getTable('cuadrillas');
      const cuarteles = this.getTable('cuarteles');

      let filtered = [...this.getTable('pesaje_vendimia')];
      if (/WHERE p\.local_uuid = \?/i.test(trimmed)) {
        const uuid = params[0];
        filtered = filtered.filter((p) => p.local_uuid === uuid);
      } else if (params[0]) {
        const fecha = params[0];
        filtered = filtered.filter((p) => p.fecha === fecha);
      }

      return filtered.map((p) => {
        const cu = cuadrillas.find((x) => x.id === p.cuadrilla_id);
        const ct = cuarteles.find((x) => x.id === p.cuartel_id);
        const f = fincas.find((x) => x.id === ct?.finca_id);
        return {
          ...p,
          cuadrilla_nombre: cu?.nombre ?? 'Cuadrilla',
          cuartel_nombre: ct?.nombre ?? 'Cuartel',
          finca_id: ct?.finca_id,
          finca_nombre: f?.nombre ?? 'Finca',
        };
      }) as T[];
    }

    return [] as T[];
  }

  async getFirstAsync<T = unknown>(
    sql: string,
    params: (string | number | boolean | null)[] = [],
  ): Promise<T | null> {
    if (/COUNT\(\*\)\s+as count FROM registro_labor WHERE estado_sync = \?/i.test(sql)) {
      const estado = params[0];
      const count = this.getTable('registro_labor').filter((r) => r.estado_sync === estado).length;
      return { count } as T;
    }
    if (/COUNT\(\*\)\s+as count FROM pesaje_vendimia WHERE estado_sync = \?/i.test(sql)) {
      const estado = params[0];
      const count = this.getTable('pesaje_vendimia').filter((p) => p.estado_sync === estado).length;
      return { count } as T;
    }

    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    return await task();
  }

  async closeAsync(): Promise<void> {
    this.saveToStorage();
  }
}

// ─── Singleton Getter ────────────────────────────────────────────────────────

export async function getDatabase(): Promise<AppDatabase> {
  if (_db) return _db;

  if (Platform.OS === 'web') {
    _db = new WebDatabase();
    for (const statement of CREATE_TABLES) {
      await _db.execAsync(statement);
    }
    return _db;
  }

  // Plataforma nativa (Android / iOS)
  const SQLite = require('expo-sqlite');
  const nativeDb = await SQLite.openDatabaseAsync(DB_NAME);

  await nativeDb.execAsync('PRAGMA journal_mode = WAL');
  await nativeDb.execAsync('PRAGMA foreign_keys = ON');

  for (const statement of CREATE_TABLES) {
    await nativeDb.execAsync(statement);
  }

  await nativeDb.runAsync(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)],
  );

  _db = nativeDb as unknown as AppDatabase;
  return _db;
}

export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}
