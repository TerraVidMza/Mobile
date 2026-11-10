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

/** Pesaje observado: quedó así porque el remito que lo contenía fue rechazado. */
export interface PesajeObservado {
  id: string;
  fecha: string;
  kgTotales: number | string;
  cuadrilla?: { nombre: string };
  cuartel?: { nombre: string; finca?: { nombre: string } };
  remito?: { numeroRemito: string; motivoRechazo?: string | null } | null;
}

/**
 * Observados y su corrección. A diferencia del alta, **no pasan por la cola
 * offline**: el pesaje ya existe en el servidor, y corregirlo exige conexión
 * para que el cambio se aplique sobre el dato real y no sobre una copia vieja.
 */
export const pesajeObservadosService = {
  async listar(): Promise<PesajeObservado[]> {
    const response = await api.get<PesajeObservado[]>('/pesajes-vendimia/observados');
    return response.data;
  },

  async corregir(
    id: string,
    cambios: { kgTotales?: number; fecha?: string },
  ): Promise<void> {
    await api.patch(`/pesajes-vendimia/${id}`, cambios);
  },
};
