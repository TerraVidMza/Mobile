/**
 * Pedidos de soporte desde la app (HU-36, M-022).
 *
 * Endpoint: POST /api/ayuda/tickets
 */

import Constants from 'expo-constants';
import api from './api';

/** Los módulos que acepta el backend (`ModuloAyuda`). */
export const MODULOS_AYUDA = [
  { valor: 'autenticacion', etiqueta: 'Acceso y cuenta' },
  { valor: 'fincas', etiqueta: 'Fincas y cuarteles' },
  { valor: 'operaciones', etiqueta: 'Labores e insumos' },
  { valor: 'vendimia', etiqueta: 'Pesajes y vendimia' },
  { valor: 'telemetria', etiqueta: 'Sensores' },
  { valor: 'reportes', etiqueta: 'Resumen y avance' },
] as const;

export type ModuloAyuda = (typeof MODULOS_AYUDA)[number]['valor'];

export interface TicketCreado {
  id: string;
  /** El ticket queda registrado aunque el correo al soporte no haya salido. */
  emailEnviado: boolean;
}

export const ayudaService = {
  async crearTicket(modulo: ModuloAyuda, descripcion: string): Promise<TicketCreado> {
    const response = await api.post<TicketCreado>('/ayuda/tickets', {
      modulo,
      descripcion,
      // Soporte necesita saber qué versión tiene el teléfono.
      appVersion: `movil ${Constants.expoConfig?.version ?? 'desconocida'}`,
    });
    return response.data;
  },
};
