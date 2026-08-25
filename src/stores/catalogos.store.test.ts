/**
 * Pruebas unitarias para Zustand catalogos.store.
 */

import { useCatalogosStore } from './catalogos.store';
import { catalogosRepo } from '../db/repositories/catalogos.repo';
import { Finca, Cuartel, TipoLabor, Insumo } from '../types/api.types';

jest.mock('../db/repositories/catalogos.repo');

describe('useCatalogosStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCatalogosStore.setState({
      fincas: [],
      tiposLabor: [],
      insumos: [],
      isLoading: false,
    });
  });

  it('debe cargar catálogos desde el repositorio SQLite', async () => {
    const mockFincas: Finca[] = [
      { id: 'f-1', nombre: 'Finca Principal', ubicacion: 'Mendoza', superficie: 50, activo: true },
    ];
    const mockTipos: TipoLabor[] = [
      { id: 't-1', nombre: 'Poda', unidadMedida: 'plantas', activo: true },
    ];
    const mockInsumos: Insumo[] = [
      { id: 'i-1', nombre: 'Fertilizante', unidadMedida: 'kg', activo: true },
    ];

    (catalogosRepo.getFincas as jest.Mock).mockResolvedValue(mockFincas);
    (catalogosRepo.getTiposLabor as jest.Mock).mockResolvedValue(mockTipos);
    (catalogosRepo.getInsumos as jest.Mock).mockResolvedValue(mockInsumos);

    await useCatalogosStore.getState().loadFromLocalDb();

    const state = useCatalogosStore.getState();
    expect(state.fincas).toEqual(mockFincas);
    expect(state.tiposLabor).toEqual(mockTipos);
    expect(state.insumos).toEqual(mockInsumos);
  });

  it('debe consultar cuarteles por finca', async () => {
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
    (catalogosRepo.getCuartelesByFinca as jest.Mock).mockResolvedValue(mockCuarteles);

    const result = await useCatalogosStore.getState().getCuartelesByFinca('f-1');
    expect(result).toEqual(mockCuarteles);
    expect(catalogosRepo.getCuartelesByFinca).toHaveBeenCalledWith('f-1');
  });
});
