/**
 * Pruebas del acceso a la base local: SQLite real (sql.js) en web/tests y
 * expo-sqlite (simulado) en nativo — M-001, M-002.
 */

import { Platform } from 'react-native';
import { getDatabase, closeDatabase } from './database';
import { leerVersion, VERSION_ACTUAL } from './migrations';

const mockNativeDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() => Promise.resolve(mockNativeDb)),
}));

const almacen: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => almacen[k] ?? null,
  setItem: (k: string, v: string) => {
    almacen[k] = v;
  },
  removeItem: (k: string) => {
    delete almacen[k];
  },
  clear: () => Object.keys(almacen).forEach((k) => delete almacen[k]),
};

describe('Base de datos local', () => {
  beforeAll(() => {
    (globalThis as { localStorage?: unknown }).localStorage = localStorageMock;
  });

  afterAll(async () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    await closeDatabase();
  });

  beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    localStorageMock.clear();
    await closeDatabase();
    jest.clearAllMocks();
  });

  describe('web (sql.js)', () => {
    it('crea el esquema y lo deja en la última versión', async () => {
      const db = await getDatabase();
      expect(await leerVersion(db)).toBe(VERSION_ACTUAL);

      const columnas = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(registro_labor)`);
      expect(columnas.map((c) => c.name)).toContain('intentos_sync');
    });

    it('comparte la apertura entre llamadas simultáneas', async () => {
      const [a, b] = await Promise.all([getDatabase(), getDatabase()]);
      expect(a).toBe(b);
    });

    it('respeta ORDER BY y LIMIT (el emulador anterior los ignoraba)', async () => {
      const db = await getDatabase();
      for (const [id, nombre] of [['f-3', 'C'], ['f-1', 'A'], ['f-2', 'B']]) {
        await db.runAsync(`INSERT INTO fincas (id, nombre) VALUES (?, ?)`, [id, nombre]);
      }
      const filas = await db.getAllAsync<{ nombre: string }>(
        `SELECT nombre FROM fincas ORDER BY nombre DESC LIMIT 2`,
      );
      expect(filas.map((f) => f.nombre)).toEqual(['C', 'B']);
    });

    it('reemplaza la fila con la misma PK (INSERT OR REPLACE)', async () => {
      const db = await getDatabase();
      await db.runAsync(`INSERT OR REPLACE INTO fincas (id, nombre, activo) VALUES (?, ?, ?)`, ['f-1', 'V1', true]);
      await db.runAsync(`INSERT OR REPLACE INTO fincas (id, nombre, activo) VALUES (?, ?, ?)`, ['f-1', 'V2', false]);

      const fincas = await db.getAllAsync<{ nombre: string; activo: number }>(`SELECT * FROM fincas`);
      expect(fincas).toEqual([expect.objectContaining({ nombre: 'V2', activo: 0 })]);
    });

    it('informa filas modificadas e id insertado', async () => {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO registro_labor (local_uuid, cuartel_id, tipo_labor_id, fecha, cantidad, created_at_local)
         VALUES ('l-1', 'c-1', 't-1', '2026-10-05', 1, '2026-10-05T10:00:00-03:00')`,
      );
      const res = await db.runAsync(
        `INSERT INTO detalle_insumo_labor (labor_local_uuid, insumo_id, cantidad) VALUES ('l-1', 'i-1', 2)`,
      );
      expect(res).toEqual({ lastInsertRowId: 1, changes: 1 });
      expect(await db.getFirstAsync(`SELECT * FROM fincas WHERE id = 'x'`)).toBeNull();
    });

    it('lanza error ante SQL inválido en vez de ignorarlo', async () => {
      const db = await getDatabase();
      await expect(db.runAsync(`UNKNOWN QUERY`)).rejects.toThrow();
      await expect(db.getAllAsync(`SELECT * FROM tabla_inexistente`)).rejects.toThrow();
    });

    it('revierte la transacción si la tarea falla', async () => {
      const db = await getDatabase();
      await expect(
        db.withTransactionAsync(async () => {
          await db.runAsync(`INSERT INTO fincas (id, nombre) VALUES ('f-1', 'A')`);
          throw new Error('falla a mitad');
        }),
      ).rejects.toThrow('falla a mitad');

      expect(await db.getAllAsync(`SELECT * FROM fincas`)).toEqual([]);
      expect(await db.withTransactionAsync(async () => 'ok')).toBe('ok');
    });

    it('importa los registros del emulador anterior y los pasa a pendiente', async () => {
      almacen['terravid_web_db'] = JSON.stringify({
        tables: {
          // Cuarteles antes que fincas: la importación no depende del orden.
          cuarteles: [{ id: 'c-1', finca_id: 'f-1', nombre: 'Cuartel 1', activo: 1 }],
          fincas: [{ id: 'f-1', nombre: 'Finca 1', activo: 1, columna_vieja: 'x' }],
          registro_labor: [
            {
              local_uuid: 'l-viejo',
              cuartel_id: 'c-1',
              tipo_labor_id: 't-1',
              fecha: '2026-09-01',
              cantidad: 3,
              estado_sync: 'error',
              error_message: 'timeout',
              created_at_local: '2026-09-01T08:00:00-03:00',
              created_at: '2026-09-01 08:00:00',
              server_id: null,
            },
          ],
        },
        autoIds: {},
      });

      const db = await getDatabase();
      const labor = await db.getFirstAsync<{ estado_sync: string; error_message: string }>(
        `SELECT estado_sync, error_message FROM registro_labor WHERE local_uuid = 'l-viejo'`,
      );
      expect(labor).toEqual({ estado_sync: 'pendiente', error_message: 'timeout' });
      expect(await db.getAllAsync(`SELECT * FROM cuarteles`)).toHaveLength(1);
      expect(almacen['terravid_web_db']).toBeUndefined();
    });

    it('descarta un emulador anterior corrupto sin romper el arranque', async () => {
      almacen['terravid_web_db'] = '{corrupto';
      const db = await getDatabase();
      expect(db).toBeDefined();
      expect(almacen['terravid_web_db']).toBeUndefined();
    });
  });

  describe('nativo (expo-sqlite)', () => {
    it('activa WAL y FKs y aplica las migraciones', async () => {
      (Platform as { OS: string }).OS = 'android';

      const db = await getDatabase();
      expect(db).toBe(mockNativeDb);
      expect(mockNativeDb.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
      expect(mockNativeDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
      expect(mockNativeDb.runAsync).toHaveBeenCalledWith(
        `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('schema_version', ?)`,
        [String(VERSION_ACTUAL)],
      );

      await closeDatabase();
      expect(mockNativeDb.closeAsync).toHaveBeenCalled();
    });

    it('permite reintentar la apertura si la primera falla', async () => {
      (Platform as { OS: string }).OS = 'android';
      mockNativeDb.execAsync.mockRejectedValueOnce(new Error('disco lleno'));

      await expect(getDatabase()).rejects.toThrow('disco lleno');
      await expect(getDatabase()).resolves.toBe(mockNativeDb);
    });
  });
});
