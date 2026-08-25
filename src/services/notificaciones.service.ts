/**
 * Servicio API para Notificaciones y Device Tokens (HU-35).
 *
 * Endpoints:
 * - GET /api/notificaciones
 * - PATCH /api/notificaciones/:id/leida
 * - PATCH /api/notificaciones/leidas
 * - POST /api/notificaciones/device-token
 * - DELETE /api/notificaciones/device-token
 */

import api from './api';
import type {
  NotificacionesResponse,
  RegistrarDeviceTokenDto,
} from '../types/api.types';

export const notificacionesService = {
  /**
   * Obtiene la lista paginada de notificaciones del usuario.
   */
  async getMine(page = 1, limit = 20, soloNoLeidas = false): Promise<NotificacionesResponse> {
    const response = await api.get<NotificacionesResponse>('/notificaciones', {
      params: { page, limit, soloNoLeidas: soloNoLeidas ? 'true' : undefined },
    });
    return response.data;
  },

  /**
   * Marca una notificación individual como leída.
   */
  async marcarLeida(id: string): Promise<void> {
    await api.patch(`/notificaciones/${id}/leida`);
  },

  /**
   * Marca todas las notificaciones del usuario como leídas.
   */
  async marcarTodasLeidas(): Promise<void> {
    await api.patch('/notificaciones/leidas');
  },

  /**
   * Registra el token de dispositivo (FCM) para recibir push notifications.
   * Se ejecuta automáticamente tras login exitoso.
   */
  async registrarDeviceToken(token: string, plataforma: 'android' | 'ios'): Promise<void> {
    const dto: RegistrarDeviceTokenDto = { token, plataforma };
    await api.post('/notificaciones/device-token', dto);
  },

  /**
   * Da de baja el token al cerrar sesión.
   */
  async bajaDeviceToken(token: string): Promise<void> {
    await api.delete('/notificaciones/device-token', { data: { token } });
  },
};
