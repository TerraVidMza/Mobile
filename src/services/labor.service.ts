/**
 * Servicio API para Registro y Sincronización de Labores (HU-12, HU-14).
 *
 * Endpoints:
 * - POST /api/registro-labor (uno)
 * - POST /api/registro-labor/sync (lote de máx 10)
 * - GET /api/registro-labor/:id
 */

import api from './api';
import type {
  CreateRegistroLaborDto,
  SyncRegistroLaborDto,
  SyncResultItem,
} from '../types/api.types';

export const laborService = {
  /**
   * Envía un registro individual al backend.
   * HTTP 201 si es nuevo, HTTP 200 si ya existía (idempotencia por local_uuid).
   */
  async registrarUno(dto: CreateRegistroLaborDto): Promise<{
    id: string;
    localUuid: string;
    yaExistia: boolean;
  }> {
    const response = await api.post('/registro-labor', dto);
    return {
      id: response.data.id,
      localUuid: response.data.localUuid,
      yaExistia: response.status === 200,
    };
  },

  /**
   * Sincroniza un lote de registros (máx 10 por request según HU-14).
   */
  async sincronizarLote(
    registros: CreateRegistroLaborDto[],
  ): Promise<SyncResultItem[]> {
    const dto: SyncRegistroLaborDto = { registros };
    const response = await api.post<SyncResultItem[]>('/registro-labor/sync', dto);
    return response.data;
  },

  /**
   * Obtiene el detalle de un registro por ID.
   */
  async findById(id: string) {
    const response = await api.get(`/registro-labor/${id}`);
    return response.data;
  },
};
