/**
 * Store de Catálogos — Zustand.
 *
 * Carga los catálogos desde SQLite en memoria para acceso sincrónico instantáneo
 * en formularios, evitando renders parpadeantes o delays.
 */

import { create } from 'zustand';
import { catalogosRepo } from '../db/repositories/catalogos.repo';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import type { Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../types/api.types';

interface CatalogosState {
  fincas: Finca[];
  tiposLabor: TipoLabor[];
  insumos: Insumo[];
  isLoading: boolean;
  isSyncing: boolean;

  /** Carga los catálogos desde SQLite local a memoria. */
  loadFromLocalDb: () => Promise<void>;
  /** Descarga del servidor y actualiza localmente. */
  syncWithServer: () => Promise<boolean>;
  /** Obtiene cuarteles de una finca desde SQLite. */
  getCuartelesByFinca: (fincaId: string) => Promise<Cuartel[]>;
  /** Obtiene cuadrillas de una finca desde SQLite. */
  getCuadrillasByFinca: (fincaId: string) => Promise<Cuadrilla[]>;
}

export const useCatalogosStore = create<CatalogosState>((set) => ({
  fincas: [],
  tiposLabor: [],
  insumos: [],
  isLoading: false,
  isSyncing: false,

  loadFromLocalDb: async () => {
    set({ isLoading: true });
    try {
      const [fincas, tiposLabor, insumos] = await Promise.all([
        catalogosRepo.getFincas(),
        catalogosRepo.getTiposLabor(),
        catalogosRepo.getInsumos(),
      ]);

      set({
        fincas,
        tiposLabor,
        insumos,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  syncWithServer: async () => {
    set({ isSyncing: true });
    const result = await catalogosSyncService.syncAll();
    if (result.success) {
      // Recargar memoria desde DB local actualizada
      const [fincas, tiposLabor, insumos] = await Promise.all([
        catalogosRepo.getFincas(),
        catalogosRepo.getTiposLabor(),
        catalogosRepo.getInsumos(),
      ]);
      set({ fincas, tiposLabor, insumos, isSyncing: false });
      return true;
    }
    set({ isSyncing: false });
    return false;
  },

  getCuartelesByFinca: async (fincaId: string) => {
    return catalogosRepo.getCuartelesByFinca(fincaId);
  },

  getCuadrillasByFinca: async (fincaId: string) => {
    return catalogosRepo.getCuadrillasByFinca(fincaId);
  },
}));
