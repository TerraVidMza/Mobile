/**
 * Base de datos local de la versión web (PWA) — M-001.
 *
 * SQLite real compilado a WebAssembly (sql.js). Reemplaza al emulador de SQL
 * con expresiones regulares sobre localStorage, que ignoraba `ORDER BY`,
 * `LIMIT` y cualquier sentencia que no reconociera. Así la PWA ejecuta las
 * mismas consultas que la app nativa, y los tests (que corren con
 * `Platform.OS = 'web'`) prueban SQL de verdad.
 *
 * La base vive en memoria y se persiste completa en IndexedDB después de cada
 * escritura. Con el volumen de un capataz (catálogos + registros del día) el
 * archivo pesa unos pocos cientos de KB.
 */

import type { Database, SqlValue } from 'sql.js';
import type { AppDatabase } from './database';
import { cargarSqlJs } from './sqljs-loader';

type Parametro = string | number | boolean | null;

const IDB_NOMBRE = 'terravid';
const IDB_STORE = 'sqlite';
const IDB_CLAVE = 'terravid.db';

/** Clave del emulador anterior; se importa una sola vez y se borra. */
const CLAVE_EMULADOR_ANTERIOR = 'terravid_web_db';

function aSqlValue(p: Parametro): SqlValue {
  if (typeof p === 'boolean') return p ? 1 : 0;
  return p;
}

// ─── Persistencia en IndexedDB ───────────────────────────────────────────────

function idbDisponible(): boolean {
  return typeof indexedDB !== 'undefined';
}

function abrirIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOMBRE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function leerIdb(): Promise<Uint8Array | null> {
  if (!idbDisponible()) return null;
  const idb = await abrirIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_CLAVE);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function escribirIdb(datos: Uint8Array): Promise<void> {
  if (!idbDisponible()) return;
  const idb = await abrirIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(datos, IDB_CLAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Adaptador ───────────────────────────────────────────────────────────────

export class WebDatabase implements AppDatabase {
  /** Profundidad de transacción: dentro de una no se persiste en cada sentencia. */
  private enTransaccion = 0;

  private constructor(private readonly db: Database) {}

  static async abrir(): Promise<WebDatabase> {
    const SQL = await cargarSqlJs();
    const guardada = await leerIdb().catch(() => null);
    const db = new SQL.Database(guardada ?? undefined);
    db.run('PRAGMA foreign_keys = ON');
    return new WebDatabase(db);
  }

  private async persistir(): Promise<void> {
    if (this.enTransaccion > 0) return;
    try {
      await escribirIdb(this.db.export());
    } catch {
      // Sin IndexedDB (modo privado de algunos navegadores) la base sigue en
      // memoria: se pierde al cerrar la pestaña, pero la app funciona.
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
    await this.persistir();
  }

  async runAsync(
    sql: string,
    params: Parametro[] = [],
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    this.db.run(sql, params.map(aSqlValue));
    const changes = this.db.getRowsModified();
    const fila = this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
    await this.persistir();
    return { lastInsertRowId: typeof fila === 'number' ? fila : undefined, changes };
  }

  async getAllAsync<T = unknown>(sql: string, params: Parametro[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params.map(aSqlValue));
      const filas: T[] = [];
      while (stmt.step()) {
        filas.push(stmt.getAsObject() as T);
      }
      return filas;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T = unknown>(sql: string, params: Parametro[] = []): Promise<T | null> {
    const filas = await this.getAllAsync<T>(sql, params);
    return filas[0] ?? null;
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    this.db.run('BEGIN');
    this.enTransaccion++;
    try {
      const resultado = await task();
      this.db.run('COMMIT');
      return resultado;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    } finally {
      this.enTransaccion--;
      await this.persistir();
    }
  }

  async closeAsync(): Promise<void> {
    await this.persistir();
    this.db.close();
  }

  /**
   * Importa los datos que dejó el emulador anterior en localStorage.
   *
   * Un capataz que usaba la PWA puede tener registros sin sincronizar ahí: no
   * se pueden perder. Las columnas que ya no existen se descartan y los
   * duplicados se ignoran. Se llama después de crear las tablas.
   */
  async importarEmuladorAnterior(): Promise<number> {
    if (typeof localStorage === 'undefined') return 0;
    const crudo = localStorage.getItem(CLAVE_EMULADOR_ANTERIOR);
    if (!crudo) return 0;

    let tablas: Record<string, Record<string, unknown>[]> = {};
    try {
      tablas = (JSON.parse(crudo) as { tables?: typeof tablas }).tables ?? {};
    } catch {
      localStorage.removeItem(CLAVE_EMULADOR_ANTERIOR);
      return 0;
    }

    // El JSON no garantiza el orden de las tablas (cuarteles antes que fincas):
    // las FKs se apagan mientras dura la importación.
    this.db.run('PRAGMA foreign_keys = OFF');
    let importadas = 0;
    try {
      await this.importarTablas(tablas, (n) => (importadas += n));
    } finally {
      this.db.run('PRAGMA foreign_keys = ON');
    }

    localStorage.removeItem(CLAVE_EMULADOR_ANTERIOR);
    return importadas;
  }

  private async importarTablas(
    tablas: Record<string, Record<string, unknown>[]>,
    contar: (n: number) => void,
  ): Promise<void> {
    await this.withTransactionAsync(async () => {
      for (const [tabla, filas] of Object.entries(tablas)) {
        if (!/^\w+$/.test(tabla)) continue;
        const columnas = new Set(
          (await this.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla})`)).map((c) => c.name),
        );
        if (columnas.size === 0) continue;

        for (const fila of filas) {
          const claves = Object.keys(fila).filter((k) => columnas.has(k));
          if (claves.length === 0) continue;
          const valores = claves.map((k) => {
            const v = fila[k];
            return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null;
          });
          await this.runAsync(
            `INSERT OR IGNORE INTO ${tabla} (${claves.join(', ')}) VALUES (${claves.map(() => '?').join(', ')})`,
            valores,
          );
          contar(1);
        }
      }
    });
  }
}
