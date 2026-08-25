/**
 * Pruebas unitarias para el motor de base de datos local y adaptador Web (100% Cobertura).
 */

import { Platform } from 'react-native';
import { getDatabase, closeDatabase } from './database';

const mockNativeDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation((fn: any) => fn()),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() => Promise.resolve(mockNativeDb)),
}));

describe('Database Adapter (100% Coverage)', () => {
  const localStorageMock: { [key: string]: string } = {};

  beforeAll(() => {
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => localStorageMock[key] ?? null,
        setItem: (key: string, val: string) => {
          localStorageMock[key] = val;
        },
        removeItem: (key: string) => {
          delete localStorageMock[key];
        },
        clear: () => {
          Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
        },
      },
    };
  });

  beforeEach(async () => {
    (Platform as any).OS = 'web';
    (global as any).window.localStorage.clear();
    await closeDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe inicializar la base de datos Web y persistir en storage', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    const txResult = await db.withTransactionAsync(async () => {
      return 'transaccion_exitosa';
    });
    expect(txResult).toBe('transaccion_exitosa');
  });

  it('debe reemplazar registro existente con misma PK (INSERT OR REPLACE)', async () => {
    const db = await getDatabase();
    await db.runAsync(`INSERT OR REPLACE INTO fincas (id, nombre, activo) VALUES (?, ?, ?)`, ['f-1', 'Finca V1', 1]);
    await db.runAsync(`INSERT OR REPLACE INTO fincas (id, nombre, activo) VALUES (?, ?, ?)`, ['f-1', 'Finca V2', 1]);

    const fincas = await db.getAllAsync<any>(`SELECT * FROM fincas`);
    expect(fincas.length).toBe(1);
    expect(fincas[0].nombre).toBe('Finca V2');
  });

  it('debe manejar queries desconocidas en runAsync y getAllAsync', async () => {
    const db = await getDatabase();
    const resultRun = await db.runAsync(`UNKNOWN QUERY`);
    expect(resultRun.changes).toBe(0);

    const resultGet = await db.getAllAsync(`SELECT * FROM tabla_inexistente`);
    expect(resultGet).toEqual([]);
  });

  it('debe manejar JSON corrupto en localStorage al iniciar WebDatabase', async () => {
    localStorageMock['terravid_web_db'] = '{corrupted_json';
    const db = await getDatabase();
    expect(db).toBeDefined();
  });

  it('debe manejar error al guardar en localStorage', async () => {
    const origSet = (global as any).window.localStorage.setItem;
    (global as any).window.localStorage.setItem = () => {
      throw new Error('QuotaExceeded');
    };

    const db = await getDatabase();
    await db.runAsync(`INSERT INTO fincas (id, nombre) VALUES (?, ?)`, ['f-1', 'Finca 1']);
    (global as any).window.localStorage.setItem = origSet;
  });

  it('debe inicializar SQLite nativo cuando Platform.OS es ios o android', async () => {
    (Platform as any).OS = 'ios';
    await closeDatabase();

    const nativeDb = await getDatabase();
    expect(nativeDb).toBeDefined();
    expect(mockNativeDb.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    expect(mockNativeDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');

    await closeDatabase();
    expect(mockNativeDb.closeAsync).toHaveBeenCalled();
  });
});
