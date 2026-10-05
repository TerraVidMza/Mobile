/**
 * Pruebas del mecanismo de migraciones (M-002) sobre SQLite real.
 */

import { getDatabase, closeDatabase } from './database';
import { aplicarMigraciones, leerVersion, type Migracion } from './migrations';

describe('Migraciones del esquema local', () => {
  beforeEach(async () => {
    await closeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('aplica solo las migraciones con versión mayor a la actual, en orden', async () => {
    const db = await getDatabase();
    const base = await leerVersion(db);

    const migraciones: Migracion[] = [
      {
        version: base + 2,
        descripcion: 'segunda',
        sentencias: [`INSERT INTO sync_meta (key, value) VALUES ('orden', 'segunda')`],
      },
      {
        version: base + 1,
        descripcion: 'primera',
        sentencias: [`CREATE TABLE prueba_migracion (id TEXT)`],
      },
      { version: base, descripcion: 'ya aplicada', sentencias: [`SELECT no_debe_correr()`] },
    ];

    expect(await aplicarMigraciones(db, migraciones)).toBe(base + 2);
    expect(await leerVersion(db)).toBe(base + 2);
    expect(
      await db.getFirstAsync<{ value: string }>(`SELECT value FROM sync_meta WHERE key = 'orden'`),
    ).toEqual({ value: 'segunda' });

    // Idempotente: una segunda pasada no vuelve a ejecutar nada.
    expect(await aplicarMigraciones(db, migraciones)).toBe(base + 2);
  });

  it('no avanza la versión si una sentencia de la migración falla', async () => {
    const db = await getDatabase();
    const base = await leerVersion(db);

    await expect(
      aplicarMigraciones(db, [
        {
          version: base + 1,
          descripcion: 'rota',
          sentencias: [`CREATE TABLE a_medias (id TEXT)`, `SENTENCIA INVALIDA`],
        },
      ]),
    ).rejects.toThrow();

    expect(await leerVersion(db)).toBe(base);
    expect(
      await db.getAllAsync(`SELECT name FROM sqlite_master WHERE name = 'a_medias'`),
    ).toEqual([]);
  });
});
