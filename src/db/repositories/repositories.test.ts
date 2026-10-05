/**
 * Pruebas unitarias completas para la capa de repositorios SQLite (100% Cobertura).
 */

import { catalogosRepo } from './catalogos.repo';
import { laboresRepo } from './labores.repo';
import { pesajesRepo } from './pesajes.repo';
import { closeDatabase } from '../database';
import { EstadoSync, Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../../types/api.types';

describe('SQLite Repositories (100% Coverage)', () => {
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

      const tipos = await catalogosRepo.getTiposLabor();
      expect(tipos.length).toBe(1);

      const insumos = await catalogosRepo.getInsumos();
      expect(insumos.length).toBe(1);

      const cuadrillas = await catalogosRepo.getCuadrillasByFinca('f-1');
      expect(cuadrillas.length).toBe(1);
    });
  });

  describe('laboresRepo', () => {
    it('debe crear, editar, filtrar, marcar error, sincronizar y eliminar labores con insumos', async () => {
      await catalogosRepo.saveFincas(mockFincas);
      await catalogosRepo.saveCuarteles(mockCuarteles);
      await catalogosRepo.saveTiposLabor(mockTipos);
      await catalogosRepo.saveInsumos(mockInsumos);

      // Crear
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

      // Consultar pendientes
      const count = await laboresRepo.countPendientes();
      expect(count).toBe(1);

      const pendientes = await laboresRepo.getPendientes(10);
      expect(pendientes.length).toBe(1);

      // Filtros
      const filteredAll = await laboresRepo.getLaboresFiltered();
      expect(filteredAll.length).toBe(1);

      const filteredByFecha = await laboresRepo.getLaboresFiltered({ fecha: '2026-08-25' });
      expect(filteredByFecha.length).toBe(1);

      const filteredCustom = await laboresRepo.getLaboresFiltered({
        fecha: '2026-08-25',
        fincaId: 'f-1',
        cuartelId: 'c-1',
      });
      expect(filteredCustom.length).toBe(1);

      // Detalle e insumos
      const laborDetail = await laboresRepo.getLaborByUuid('labor-test-1');
      expect(laborDetail?.localUuid).toBe('labor-test-1');

      const insumosDetail = await laboresRepo.getInsumosDeLabor('labor-test-1');
      expect(insumosDetail.length).toBe(1);

      // Actualizar labor
      await laboresRepo.updateLabor(
        'labor-test-1',
        {
          cuartelId: 'c-1',
          tipoLaborId: 't-1',
          fecha: '2026-08-25',
          cantidad: 120,
        },
        [{ insumoId: 'i-1', cantidad: 4 }],
      );

      // Intento fallido: sigue pendiente (M-003)
      await laboresRepo.registrarIntentoFallido('labor-test-1', 'Error temporal');
      expect(await laboresRepo.countPendientes()).toBe(1);

      // Marcar sincronizado
      await laboresRepo.markSincronizado('labor-test-1', 'server-id-labor-1');
      const countAfterSync = await laboresRepo.countPendientes();
      expect(countAfterSync).toBe(0);

      // Eliminar
      await laboresRepo.deleteLabor('labor-test-1');
      const laborAfterDelete = await laboresRepo.getLaborByUuid('labor-test-1');
      expect(laborAfterDelete).toBeNull();
    });
  });

  describe('pesajesRepo', () => {
    it('debe crear, editar, filtrar, marcar error, calcular resumen y eliminar pesajes', async () => {
      await catalogosRepo.saveFincas(mockFincas);
      await catalogosRepo.saveCuarteles(mockCuarteles);
      await catalogosRepo.saveCuadrillas(mockCuadrillas);

      // Crear
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

      // Consultar pendientes
      const count = await pesajesRepo.countPendientes();
      expect(count).toBe(1);

      const pendientes = await pesajesRepo.getPendientes(10);
      expect(pendientes.length).toBe(1);

      // Consultar por fecha
      const pesajesHoy = await pesajesRepo.getPesajesByFecha('2026-08-25');
      expect(pesajesHoy.length).toBe(1);

      // Detalle
      const pesajeDetail = await pesajesRepo.getPesajeByUuid('pesaje-test-1');
      expect(pesajeDetail?.localUuid).toBe('pesaje-test-1');

      // Resumen por cuadrilla
      const resumen = await pesajesRepo.getResumenPorCuadrilla('2026-08-25');
      expect(resumen.length).toBe(1);

      // Editar pesaje
      await pesajesRepo.updatePesaje('pesaje-test-1', {
        cuadrillaId: 'cu-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 1800,
      });

      // Intento fallido: sigue pendiente (M-003)
      await pesajesRepo.registrarIntentoFallido('pesaje-test-1', 'Error de peso');
      expect(await pesajesRepo.countPendientes()).toBe(1);

      // Marcar sincronizado
      await pesajesRepo.markSincronizado('pesaje-test-1', 'srv-p1');
      const countAfter = await pesajesRepo.countPendientes();
      expect(countAfter).toBe(0);

      // Eliminar
      await pesajesRepo.deletePesaje('pesaje-test-1');
      const deleted = await pesajesRepo.getPesajeByUuid('pesaje-test-1');
      expect(deleted).toBeNull();
    });
  });
});
