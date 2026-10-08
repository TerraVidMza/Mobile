/**
 * Pruebas unitarias para Zustand catalogos.store (100% Cobertura).
 */

import { useCatalogosStore } from './catalogos.store';
import { catalogosRepo } from '../db/repositories/catalogos.repo';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../types/api.types';

jest.mock('../db/repositories/catalogos.repo');
jest.mock('../services/catalogos-sync.service');

describe('useCatalogosStore (100% Coverage)', () => {
  const mockFincas: Finca[] = [
    { id: 'f-1', nombre: 'Finca Principal', ubicacion: 'Mendoza', superficie: 50, activo: true },
  ];
  const mockTipos: TipoLabor[] = [
    { id: 't-1', nombre: 'Poda', unidadMedida: 'plantas', activo: true },
  ];
  const mockInsumos: Insumo[] = [
    { id: 'i-1', nombre: 'Fertilizante', unidadMedida: 'kg', activo: true },
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
  const mockCuadrillas: Cuadrilla[] = [
    { id: 'cu-1', fincaId: 'f-1', nombre: 'Cuadrilla Norte', activa: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useCatalogosStore.setState({
      fincas: [],
      tiposLabor: [],
      insumos: [],
      isLoading: false,
      isSyncing: false,
    });
  });

  it('debe cargar catálogos desde el repositorio SQLite', async () => {
    (catalogosRepo.getFincas as jest.Mock).mockResolvedValue(mockFincas);
    (catalogosRepo.getTiposLabor as jest.Mock).mockResolvedValue(mockTipos);
    (catalogosRepo.getInsumos as jest.Mock).mockResolvedValue(mockInsumos);

    await useCatalogosStore.getState().loadFromLocalDb();

    const state = useCatalogosStore.getState();
    expect(state.fincas).toEqual(mockFincas);
    expect(state.tiposLabor).toEqual(mockTipos);
    expect(state.insumos).toEqual(mockInsumos);
  });

  it('debe manejar errores en loadFromLocalDb', async () => {
    (catalogosRepo.getFincas as jest.Mock).mockRejectedValue(new Error('SQLite error'));
    await useCatalogosStore.getState().loadFromLocalDb();
    expect(useCatalogosStore.getState().isLoading).toBe(false);
  });

  it('debe sincronizar con el servidor con éxito y recargar catálogos', async () => {
    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: true });
    (catalogosRepo.getFincas as jest.Mock).mockResolvedValue(mockFincas);
    (catalogosRepo.getTiposLabor as jest.Mock).mockResolvedValue(mockTipos);
    (catalogosRepo.getInsumos as jest.Mock).mockResolvedValue(mockInsumos);

    const success = await useCatalogosStore.getState().syncWithServer();
    expect(success).toBe(true);
    expect(useCatalogosStore.getState().fincas).toEqual(mockFincas);
  });

  it('debe manejar fallo en syncWithServer retornando false', async () => {
    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: false });
    const success = await useCatalogosStore.getState().syncWithServer();
    expect(success).toBe(false);
    expect(useCatalogosStore.getState().isSyncing).toBe(false);
  });

  it('una descarga incompleta recarga lo que llegó y queda marcada (M-016)', async () => {
    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: false });
    (catalogosRepo.getFincas as jest.Mock).mockResolvedValue(mockFincas);
    (catalogosRepo.getTiposLabor as jest.Mock).mockResolvedValue(mockTipos);
    (catalogosRepo.getInsumos as jest.Mock).mockResolvedValue(mockInsumos);

    await useCatalogosStore.getState().syncWithServer();
    expect(useCatalogosStore.getState().catalogosIncompletos).toBe(true);
    expect(useCatalogosStore.getState().fincas).toEqual(mockFincas);

    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: true });
    await useCatalogosStore.getState().syncWithServer();
    expect(useCatalogosStore.getState().catalogosIncompletos).toBe(false);
  });

  it('si falla la base local conserva lo que había en memoria', async () => {
    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: true });
    (catalogosRepo.getFincas as jest.Mock).mockRejectedValue(new Error('SQLite error'));
    useCatalogosStore.setState({ fincas: mockFincas });

    expect(await useCatalogosStore.getState().syncWithServer()).toBe(true);
    expect(useCatalogosStore.getState().fincas).toEqual(mockFincas);
    expect(useCatalogosStore.getState().isSyncing).toBe(false);
  });

  it('debe consultar cuarteles y cuadrillas por finca', async () => {
    (catalogosRepo.getCuartelesByFinca as jest.Mock).mockResolvedValue(mockCuarteles);
    (catalogosRepo.getCuadrillasByFinca as jest.Mock).mockResolvedValue(mockCuadrillas);

    const cuarteles = await useCatalogosStore.getState().getCuartelesByFinca('f-1');
    const cuadrillas = await useCatalogosStore.getState().getCuadrillasByFinca('f-1');

    expect(cuarteles).toEqual(mockCuarteles);
    expect(cuadrillas).toEqual(mockCuadrillas);
  });
});
