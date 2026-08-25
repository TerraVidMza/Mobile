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
   * Envía un pesaje individual al backend.
   */
  async registrarUno(dto: CreatePesajeDto): Promise<{
    id: string;
    localUuid: string;
    yaExistia: boolean;
  }> {
    const response = await api.post('/pesajes-vendimia', dto);
    return {
      id: response.data.id,
      localUuid: response.data.localUuid,
      yaExistia: response.status === 200,
    };
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
