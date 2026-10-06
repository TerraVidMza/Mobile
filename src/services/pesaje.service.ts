/**
 * Servicio API para Pesajes de Vendimia (HU-24).
 */

import api from '../services/api';
import type {
  CreatePesajeDto,
  SyncPesajeDto,
  SyncResultItem,
} from '../types/api.types';

export const pesajeService = {
  /**
   * Envía un registro individual. Lo usa el motor de sync para aislar un
   * registro cuando el backend rechaza el lote entero (M-003).
   * HTTP 201 si es nuevo, 200 si ya existía (idempotencia por local_uuid); en
   * los dos casos el cuerpo es el mismo resultado que devuelve `/sync`.
   */
  async registrarUno(dto: CreatePesajeDto): Promise<SyncResultItem> {
    const response = await api.post<SyncResultItem>('/pesajes-vendimia', dto);
    return response.data;
  },

  /**
   * Sincroniza un lote de pesajes (máx 10 por request).
   */
  async sincronizarLote(
    pesajes: CreatePesajeDto[],
  ): Promise<SyncResultItem[]> {
    const dto: SyncPesajeDto = { pesajes };
    const response = await api.post<SyncResultItem[]>('/pesajes-vendimia/sync', dto);
    return response.data;
  },
};
