/**
 * Migraciones del esquema local — M-002.
 *
 * `CREATE_TABLES` (schema.ts) es la versión 1 y no se modifica: una instalación
 * nueva crea esas tablas y después recorre las migraciones igual que una
 * instalación existente. Así hay un único camino hasta el esquema actual.
 *
 * Reglas:
 * - Cada migración se aplica una sola vez, en orden, dentro de una transacción.
 * - Nunca se edita una migración publicada: se agrega otra.
 * - La versión aplicada queda en `sync_meta.schema_version`.
 */

import type { AppDatabase } from './database';

export interface Migracion {
  version: number;
  descripcion: string;
  sentencias: string[];
}

export const MIGRACIONES: Migracion[] = [
  {
    version: 2,
    descripcion:
      'Reintento automático (M-003): contador de intentos y los registros en error vuelven a pendiente',
    sentencias: [
      `ALTER TABLE registro_labor ADD COLUMN intentos_sync INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE pesaje_vendimia ADD COLUMN intentos_sync INTEGER NOT NULL DEFAULT 0`,
      `UPDATE registro_labor SET estado_sync = 'pendiente' WHERE estado_sync = 'error'`,
      `UPDATE pesaje_vendimia SET estado_sync = 'pendiente' WHERE estado_sync = 'error'`,
    ],
  },
];

/** Versión a la que queda la base después de aplicar todas las migraciones. */
export const VERSION_ACTUAL = MIGRACIONES.reduce((max, m) => Math.max(max, m.version), 1);

export async function leerVersion(db: AppDatabase): Promise<number> {
  const fila = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_meta WHERE key = 'schema_version'`,
  );
  return fila ? Number(fila.value) : 1;
}

/** Aplica las migraciones pendientes y devuelve la versión final. */
export async function aplicarMigraciones(
  db: AppDatabase,
  migraciones: Migracion[] = MIGRACIONES,
): Promise<number> {
  let version = await leerVersion(db);

  for (const m of [...migraciones].sort((a, b) => a.version - b.version)) {
    if (m.version <= version) continue;
    await db.withTransactionAsync(async () => {
      for (const sentencia of m.sentencias) {
        await db.runAsync(sentencia);
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('schema_version', ?)`,
        [String(m.version)],
      );
    });
    version = m.version;
  }

  return version;
}
