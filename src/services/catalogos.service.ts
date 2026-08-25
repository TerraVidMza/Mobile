/**
 * Servicios de Catálogos — llamadas a endpoints GET del Backend.
 */

import api from './api';
import type { Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../types/api.types';

export const fincasService = {
  async getAll(): Promise<Finca[]> {
    const response = await api.get<Finca[]>('/fincas');
    return response.data;
  },
};

export const cuartelesService = {
  async getByFinca(fincaId: string): Promise<Cuartel[]> {
    const response = await api.get<Cuartel[]>(`/cuarteles?fincaId=${fincaId}`);
    return response.data;
  },
};

export const tipoLaborService = {
  async getAll(): Promise<TipoLabor[]> {
    const response = await api.get<TipoLabor[]>('/tipo-labor');
    return response.data;
  },
};

export const insumosService = {
  async getAll(): Promise<Insumo[]> {
    const response = await api.get<Insumo[]>('/insumos');
    return response.data;
  },
};

export const cuadrillasService = {
  async getByFinca(fincaId: string): Promise<Cuadrilla[]> {
    const response = await api.get<Cuadrilla[]>(`/cuadrillas?fincaId=${fincaId}`);
    return response.data;
  },
};
