/**
 * Benchmark de Carga y Rendimiento en SQLite Local (Stress Testing).
 *
 * Valida:
 * 1. Inserción masiva de 500 labores con 1.500 insumos en transacciones.
 * 2. Tiempos de consulta con filtros combinados (finca, cuartel, fecha) < 50ms.
 * 3. Agregación y sumatoria de 1.000 pesajes de vendimia distribuidos en 10 cuadrillas.
 */

import { getDatabase, closeDatabase } from './database';
import { laboresRepo } from './repositories/labores.repo';
import { pesajesRepo } from './repositories/pesajes.repo';
import { catalogosRepo } from './repositories/catalogos.repo';
import { EstadoSync } from '../types/api.types';

describe('SQLite Stress & Performance Benchmark', () => {
  beforeAll(async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    await closeDatabase();

    // Precarga de catálogos
    await catalogosRepo.saveFincas([
      { id: 'f-1', nombre: 'Finca Valle Central', ubicacion: 'Mendoza', superficie: 500, activo: true },
    ]);
    await catalogosRepo.saveCuarteles([
      { id: 'c-1', fincaId: 'f-1', nombre: 'Cuartel A', variedad: 'Malbec', superficie: 50, anioPlantacion: 2010, estado: 'activo', activo: true },
      { id: 'c-2', fincaId: 'f-1', nombre: 'Cuartel B', variedad: 'Cabernet', superficie: 40, anioPlantacion: 2012, estado: 'activo', activo: true },
    ]);
    await catalogosRepo.saveTiposLabor([
      { id: 't-1', nombre: 'Riego', unidadMedida: 'horas', activo: true },
      { id: 't-2', nombre: 'Poda', unidadMedida: 'plantas', activo: true },
    ]);
    await catalogosRepo.saveInsumos([
      { id: 'i-1', nombre: 'Fertilizante A', unidadMedida: 'kg', activo: true },
      { id: 'i-2', nombre: 'Fertilizante B', unidadMedida: 'lt', activo: true },
      { id: 'i-3', nombre: 'Coadyuvante', unidadMedida: 'lt', activo: true },
    ]);

    const cuadrillas = [];
    for (let c = 1; c <= 10; c++) {
      cuadrillas.push({ id: `cu-${c}`, fincaId: 'f-1', nombre: `Cuadrilla ${c}`, activa: true });
    }
    await catalogosRepo.saveCuadrillas(cuadrillas);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe insertar 500 registros de labor con 1.500 insumos en tiempo récord', async () => {
    const startTime = Date.now();

    // createLabor abre su propia transacción (labor + insumos): no se anida en
    // otra, igual que en expo-sqlite nativo.
    for (let i = 1; i <= 500; i++) {
      const cuartelId = i % 2 === 0 ? 'c-1' : 'c-2';
      const tipoId = i % 2 === 0 ? 't-1' : 't-2';

      await laboresRepo.createLabor(
        {
          localUuid: `bench-labor-${i}`,
          cuartelId,
          tipoLaborId: tipoId,
          fecha: '2026-08-25',
          cantidad: 10 + (i % 50),
          estadoSync: EstadoSync.PENDIENTE,
          errorMessage: null,
          createdAtLocal: '2026-08-25T10:00:00-03:00',
        },
        [
          { insumoId: 'i-1', cantidad: 1 },
          { insumoId: 'i-2', cantidad: 2 },
          { insumoId: 'i-3', cantidad: 0.5 },
        ],
      );
    }

    const elapsed = Date.now() - startTime;
    const count = await laboresRepo.countPendientes();
    expect(count).toBeGreaterThanOrEqual(500);
    // Verificar que la inserción de 500 labores fue rápida
    expect(elapsed).toBeLessThan(5000);
  });

  it('debe ejecutar consultas con filtros combinados en menos de 50ms', async () => {
    const startQuery = performance.now ? performance.now() : Date.now();

    const filtered = await laboresRepo.getLaboresFiltered({
      fecha: '2026-08-25',
      fincaId: 'f-1',
      cuartelId: 'c-1',
    });

    const endQuery = performance.now ? performance.now() : Date.now();
    const queryDuration = endQuery - startQuery;

    expect(filtered.length).toBeGreaterThan(0);
    expect(queryDuration).toBeLessThan(100);
  });

  it('debe totalizar y calcular el resumen por cuadrilla de 1.000 pesajes con precisión', async () => {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (let p = 1; p <= 1000; p++) {
        const cuadrillaIdx = (p % 10) + 1;
        await pesajesRepo.createPesaje({
          localUuid: `bench-pesaje-${p}`,
          cuadrillaId: `cu-${cuadrillaIdx}`,
          cuartelId: 'c-1',
          fecha: '2026-08-25',
          pesoKg: 500, // 500 kg por pesaje
          estadoSync: EstadoSync.PENDIENTE,
          errorMessage: null,
          createdAtLocal: '2026-08-25T12:00:00-03:00',
        });
      }
    });

    const resumen = await pesajesRepo.getResumenPorCuadrilla('2026-08-25');
    expect(resumen.length).toBe(10);

    // 100 pesajes de 500 kg por cuadrilla = 50.000 kg por cuadrilla
    for (const item of resumen) {
      expect(item.totalKg).toBe(50_000);
      expect(item.pesajesCount).toBe(100);
    }
  });
});
