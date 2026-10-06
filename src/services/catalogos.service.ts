/**
 * Servicios de Catálogos — llamadas a endpoints GET del Backend.
 *
 * El backend y esta app nombran algunos campos distinto (`hectareas`/`activa`
 * vs `superficie`/`activo` acá, `variedad` como objeto anidado vs texto plano).
 * `Finca`/`Cuartel` acá tipaban la respuesta cruda del backend con el shape
 * *local* sin transformarla: TypeScript no se quejaba (es un cast, no una
 * validación), pero en runtime `finca.activo` daba `undefined` para toda finca
 * real. Como `saveFincas` guarda `activo ? 1 : 0`, todas quedaban marcadas
 * inactivas y `getFincas()` (que filtra `WHERE activo = 1`) no devolvía
 * ninguna — el selector de Finca de "Nueva labor" se veía vacío sin ningún
 * error visible. Los `map*` de abajo son la traducción explícita que faltaba.
 */

import api from './api';
import type { Finca, Cuartel, TipoLabor, Insumo, Cuadrilla } from '../types/api.types';

interface FincaApi {
  id: string;
  nombre: string;
  ubicacion: string | null;
  hectareas: string | number;
  activa: boolean;
}

function mapFinca(f: FincaApi): Finca {
  return {
    id: f.id,
    nombre: f.nombre,
    ubicacion: f.ubicacion,
    superficie: f.hectareas != null ? Number(f.hectareas) : null,
    activo: f.activa,
  };
}

interface CuartelApi {
  id: string;
  fincaId: string;
  nombre: string;
  variedad: { nombre: string } | null;
  hectareas: string | number | null;
  anioImplantacion: number | null;
  estado: string | null;
  activo: boolean;
}

function mapCuartel(c: CuartelApi): Cuartel {
  return {
    id: c.id,
    fincaId: c.fincaId,
    nombre: c.nombre,
    variedad: c.variedad?.nombre ?? null,
    superficie: c.hectareas != null ? Number(c.hectareas) : null,
    anioPlantacion: c.anioImplantacion,
    estado: c.estado,
    activo: c.activo,
  };
}

export const fincasService = {
  async getAll(): Promise<Finca[]> {
    const response = await api.get<FincaApi[]>('/fincas');
    return response.data.map(mapFinca);
  },
};

export const cuartelesService = {
  async getByFinca(fincaId: string): Promise<Cuartel[]> {
    const response = await api.get<CuartelApi[]>(`/cuarteles?fincaId=${fincaId}`);
    return response.data.map(mapCuartel);
  },
};

export const tipoLaborService = {
  async getAll(): Promise<TipoLabor[]> {
    // El controller del backend expone `tipos-labor` (plural) —
    // `Backend/src/modules/tipo-labor/tipo-labor.controller.ts`.
    const response = await api.get<TipoLabor[]>('/tipos-labor');
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
