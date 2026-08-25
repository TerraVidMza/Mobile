/**
 * Pruebas unitarias para la capa de repositorios SQLite (HU-12, HU-13, HU-14, HU-24, HU-27).
 */

import { catalogosRepo } from './catalogos.repo';
import { laboresRepo } from './labores.repo';
import { pesajesRepo } from './pesajes.repo';
import { closeDatabase } from '../database';
import { EstadoSync, Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../../types/api.types';

describe('SQLite Repositories', () => {
  const mockFincas: Finca[] = [
    { id: 'f-1', nombre: 'Finca Principal', ubicacion: 'Mendoza', superficie: 50, activo: true },
  ];
  const mockCuarteles: Cuartel[] = [
    {
      id: 'c-1',
      fincaId: 'f-1',
      nombre: 'Cuartel 1',
      variedad: 'Malbec',
      superficie: 10,
      anioPlantacion: 2018,
      estado: 'activo',
      activo: true,
    },
  ];
  const mockTipos: TipoLabor[] = [
    { id: 't-1', nombre: 'Poda', unidadMedida: 'plantas', activo: true },
  ];
  const mockInsumos: Insumo[] = [
    { id: 'i-1', nombre: 'Fertilizante', unidadMedida: 'kg', activo: true },
  ];
  const mockCuadrillas: Cuadrilla[] = [
    { id: 'cu-1', fincaId: 'f-1', nombre: 'Cuadrilla Norte', activa: true },
  ];

  beforeEach(async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    await closeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('catalogosRepo', () => {
    it('debe guardar y consultar fincas, cuarteles, tipos de labor, insumos y cuadrillas', async () => {
      await catalogosRepo.saveFincas(mockFincas);
      await catalogosRepo.saveCuarteles(mockCuarteles);
      await catalogosRepo.saveTiposLabor(mockTipos);
      await catalogosRepo.saveInsumos(mockInsumos);
      await catalogosRepo.saveCuadrillas(mockCuadrillas);

      const fincas = await catalogosRepo.getFincas();
      expect(fincas.length).toBe(1);
      expect(fincas[0].nombre).toBe('Finca Principal');

      const cuarteles = await catalogosRepo.getCuartelesByFinca('f-1');
      expect(cuarteles.length).toBe(1);
      expect(cuarteles[0].nombre).toBe('Cuartel 1');

      const tipos = await catalogosRepo.getTiposLabor();
      expect(tipos.length).toBe(1);

      const insumos = await catalogosRepo.getInsumos();
      expect(insumos.length).toBe(1);

      const cuadrillas = await catalogosRepo.getCuadrillasByFinca('f-1');
      expect(cuadrillas.length).toBe(1);
    });
  });

  describe('laboresRepo', () => {
    it('debe crear, consultar, marcar sincronizado y eliminar labores con insumos', async () => {
      await catalogosRepo.saveFincas(mockFincas);
      await catalogosRepo.saveCuarteles(mockCuarteles);
      await catalogosRepo.saveTiposLabor(mockTipos);
      await catalogosRepo.saveInsumos(mockInsumos);

      await laboresRepo.createLabor(
        {
          localUuid: 'labor-test-1',
          cuartelId: 'c-1',
          tipoLaborId: 't-1',
          fecha: '2026-08-25',
          cantidad: 100,
          estadoSync: EstadoSync.PENDIENTE,
          errorMessage: null,
          createdAtLocal: '2026-08-25T10:00:00-03:00',
        },
        [{ insumoId: 'i-1', cantidad: 2 }],
      );

      const count = await laboresRepo.countPendientes();
      expect(count).toBe(1);

      const pendientes = await laboresRepo.getPendientes(10);
      expect(pendientes.length).toBe(1);
      expect(pendientes[0].insumos.length).toBe(1);

      const laborDetail = await laboresRepo.getLaborByUuid('labor-test-1');
      expect(laborDetail?.localUuid).toBe('labor-test-1');

      const insumosDetail = await laboresRepo.getInsumosDeLabor('labor-test-1');
      expect(insumosDetail.length).toBe(1);

      await laboresRepo.markSincronizado('labor-test-1', 'server-id-labor-1');
      const countAfterSync = await laboresRepo.countPendientes();
      expect(countAfterSync).toBe(0);

      await laboresRepo.deleteLabor('labor-test-1');
      const laborAfterDelete = await laboresRepo.getLaborByUuid('labor-test-1');
      expect(laborAfterDelete).toBeNull();
    });
  });

  describe('pesajesRepo', () => {
    it('debe crear, consultar, calcular resumen por cuadrilla y eliminar pesajes', async () => {
      await catalogosRepo.saveFincas(mockFincas);
      await catalogosRepo.saveCuarteles(mockCuarteles);
      await catalogosRepo.saveCuadrillas(mockCuadrillas);

      await pesajesRepo.createPesaje({
        localUuid: 'pesaje-test-1',
        cuadrillaId: 'cu-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 1500,
        estadoSync: EstadoSync.PENDIENTE,
        errorMessage: null,
        createdAtLocal: '2026-08-25T11:00:00-03:00',
      });

      const count = await pesajesRepo.countPendientes();
      expect(count).toBe(1);

      const pendientes = await pesajesRepo.getPendientes(10);
      expect(pendientes.length).toBe(1);
      expect(pendientes[0].pesoKg).toBe(1500);

      const pesajeDetail = await pesajesRepo.getPesajeByUuid('pesaje-test-1');
      expect(pesajeDetail?.localUuid).toBe('pesaje-test-1');

      const resumen = await pesajesRepo.getResumenPorCuadrilla('2026-08-25');
      expect(resumen.length).toBe(1);
      expect(resumen[0].totalKg).toBe(1500);

      await pesajesRepo.markSincronizado('pesaje-test-1', 'srv-p1');
      const countAfter = await pesajesRepo.countPendientes();
      expect(countAfter).toBe(0);

      await pesajesRepo.deletePesaje('pesaje-test-1');
      const deleted = await pesajesRepo.getPesajeByUuid('pesaje-test-1');
      expect(deleted).toBeNull();
    });
  });
});
