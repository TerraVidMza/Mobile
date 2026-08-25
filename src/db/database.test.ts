/**
 * Pruebas unitarias para el motor de base de datos local y adaptador Web.
 */

import { getDatabase, closeDatabase } from './database';

describe('Database Adapter (Web / Local)', () => {
  beforeEach(async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    await closeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe inicializar la base de datos singleton y ejecutar transacciones', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    const txResult = await db.withTransactionAsync(async () => {
      return 'transaccion_exitosa';
    });
    expect(txResult).toBe('transaccion_exitosa');
  });

  it('debe insertar, consultar y actualizar registros de labores en el adaptador local', async () => {
    const db = await getDatabase();

    // Insertar finca
    await db.runAsync(
      `INSERT OR REPLACE INTO fincas (id, nombre, activa) VALUES (?, ?, ?)`,
      ['finca-1', 'Finca Norte', 1],
    );

    // Insertar cuartel
    await db.runAsync(
      `INSERT OR REPLACE INTO cuarteles (id, finca_id, nombre, variedad, activo) VALUES (?, ?, ?, ?, ?)`,
      ['c-1', 'finca-1', 'Cuartel A', 'Cabernet', 1],
    );

    // Insertar labor
    await db.runAsync(
      `INSERT INTO registro_labor (local_uuid, cuartel_id, tipo_labor_id, fecha, cantidad, estado_sync, error_message, created_at_local)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['uuid-test-1', 'c-1', 't-1', '2026-08-25', 15, 'pendiente', null, '2026-08-25T10:00:00-03:00'],
    );

    // Consultar pendientes
    const count = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM registro_labor WHERE estado_sync = ?`,
      ['pendiente'],
    );
    expect(count?.count).toBe(1);

    // Actualizar a sincronizado
    await db.runAsync(
      `UPDATE registro_labor SET estado_sync = ?, server_id = ? WHERE local_uuid = ?`,
      ['sincronizado', 'server-id-99', 'uuid-test-1'],
    );

    const countAfter = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM registro_labor WHERE estado_sync = ?`,
      ['pendiente'],
    );
    expect(countAfter?.count).toBe(0);
  });
});
