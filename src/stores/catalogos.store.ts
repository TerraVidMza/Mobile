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
  /**
   * La última descarga no terminó (sin señal o falló alguna finca): puede
   * faltar algún cuartel o cuadrilla. Se reintenta al volver la señal (M-016).
   */
  catalogosIncompletos: boolean;

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
  catalogosIncompletos: false,

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
    // Aun si falló, lo que llegó ya está en la base local: se recarga igual.
    try {
      const [fincas, tiposLabor, insumos] = await Promise.all([
        catalogosRepo.getFincas(),
        catalogosRepo.getTiposLabor(),
        catalogosRepo.getInsumos(),
      ]);
      set({ fincas, tiposLabor, insumos });
    } catch {
      // Se conserva lo que había en memoria.
    }
    set({ isSyncing: false, catalogosIncompletos: !result.success });
    return result.success;
  },

  getCuartelesByFinca: async (fincaId: string) => {
    return catalogosRepo.getCuartelesByFinca(fincaId);
  },

  getCuadrillasByFinca: async (fincaId: string) => {
    return catalogosRepo.getCuadrillasByFinca(fincaId);
  },
}));
