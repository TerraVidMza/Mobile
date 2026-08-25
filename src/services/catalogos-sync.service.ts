/**
 * Servicio de Descarga y Sincronización de Catálogos Maestros.
 *
 * Descarga todos los catálogos de la empresa del usuario y los persiste en SQLite
 * para que todos los selectores funcionen 100% offline.
 */

import {
  fincasService,
  cuartelesService,
  tipoLaborService,
  insumosService,
  cuadrillasService,
} from './catalogos.service';
import { catalogosRepo } from '../db/repositories/catalogos.repo';
import type { Cuartel, Cuadrilla } from '../types/api.types';

export const catalogosSyncService = {
  /**
   * Descarga todos los catálogos desde el backend y los guarda en SQLite.
   * Se ejecuta automáticamente al login y post-sincronización exitosa.
   */
  async syncAll(): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Descargar fincas
      const fincas = await fincasService.getAll();
      await catalogosRepo.saveFincas(fincas);

      // 2. Descargar cuarteles y cuadrillas para cada finca
      const allCuarteles: Cuartel[] = [];
      const allCuadrillas: Cuadrilla[] = [];

      for (const finca of fincas) {
        try {
          const cuarteles = await cuartelesService.getByFinca(finca.id);
          allCuarteles.push(...cuarteles);
        } catch {
          // Si falla una finca individual, continuamos con las demás
        }

        try {
          const cuadrillas = await cuadrillasService.getByFinca(finca.id);
          allCuadrillas.push(...cuadrillas);
        } catch {
          // Idem
        }
      }

      if (allCuarteles.length > 0) {
        await catalogosRepo.saveCuarteles(allCuarteles);
      }
      if (allCuadrillas.length > 0) {
        await catalogosRepo.saveCuadrillas(allCuadrillas);
      }

      // 3. Descargar tipos de labor e insumos
      const tiposLabor = await tipoLaborService.getAll();
      await catalogosRepo.saveTiposLabor(tiposLabor);

      const insumos = await insumosService.getAll();
      await catalogosRepo.saveInsumos(insumos);

      return { success: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido al descargar catálogos';
      return { success: false, error: message };
    }
  },
};
