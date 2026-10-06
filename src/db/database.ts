/**
 * Inicialización y acceso a la base de datos local.
 *
 * - En Android / iOS: SQLite nativo (expo-sqlite) con WAL mode y FKs.
 * - En Web (PWA) y en los tests: SQLite compilado a WebAssembly (sql.js),
 *   persistido en IndexedDB (M-001).
 *
 * En las dos plataformas se crean las tablas base y se aplican las migraciones
 * pendientes (M-002).
 */

import { Platform } from 'react-native';
import { CREATE_TABLES } from './schema';
import { aplicarMigraciones } from './migrations';
import { WebDatabase } from './web-database';

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
let _db: Promise<AppDatabase> | null = null;

async function abrirWeb(): Promise<AppDatabase> {
  const db = await WebDatabase.abrir();
  for (const statement of CREATE_TABLES) {
    await db.execAsync(statement);
  }
  // Antes de migrar: lo importado también tiene que pasar por las migraciones.
  await db.importarEmuladorAnterior();
  await aplicarMigraciones(db);
  return db;
}

async function abrirNativa(): Promise<AppDatabase> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite');
  const nativeDb = await SQLite.openDatabaseAsync(DB_NAME);

  await nativeDb.execAsync('PRAGMA journal_mode = WAL');
  await nativeDb.execAsync('PRAGMA foreign_keys = ON');

  for (const statement of CREATE_TABLES) {
    await nativeDb.execAsync(statement);
  }

  const db = nativeDb as unknown as AppDatabase;
  await aplicarMigraciones(db);
  return db;
}

/**
 * Devuelve la base abierta. Se guarda la promesa y no la instancia: dos
 * llamadas simultáneas al arrancar comparten la misma apertura y no aplican
 * las migraciones dos veces.
 */
export function getDatabase(): Promise<AppDatabase> {
  if (!_db) {
    _db = (Platform.OS === 'web' ? abrirWeb() : abrirNativa()).catch((error) => {
      _db = null;
      throw error;
    });
  }
  return _db;
}

export async function closeDatabase(): Promise<void> {
  if (_db) {
    const db = await _db;
    _db = null;
    await db.closeAsync();
  }
}
