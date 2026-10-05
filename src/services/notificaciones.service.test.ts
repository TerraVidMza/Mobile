/**
 * Pruebas unitarias para notificaciones.service.ts (100% Cobertura).
 */

import api from './api';
import { notificacionesService } from './notificaciones.service';

jest.mock('./api');

describe('notificacionesService (100% Coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe obtener notificaciones con y sin filtro de soloNoLeidas', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: [{ id: 'notif-1' }], total: 1, noLeidas: 1 },
    });

    const res1 = await notificacionesService.getMine(1, 20, false);
    expect(api.get).toHaveBeenCalledWith('/notificaciones', {
      params: { page: 1, pageSize: 20, soloNoLeidas: undefined },
    });
    expect(res1.total).toBe(1);

    const res2 = await notificacionesService.getMine(1, 10, true);
    expect(api.get).toHaveBeenCalledWith('/notificaciones', {
      params: { page: 1, pageSize: 10, soloNoLeidas: 'true' },
    });
    expect(res2.total).toBe(1);
  });

  it('debe marcar una notificación o todas como leídas', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });

    await notificacionesService.marcarLeida('notif-1');
    expect(api.patch).toHaveBeenCalledWith('/notificaciones/notif-1/leida');

    await notificacionesService.marcarTodasLeidas();
    expect(api.patch).toHaveBeenCalledWith('/notificaciones/leidas');
  });

  it('debe registrar y dar de baja el token de dispositivo push (FCM / APNs)', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    await notificacionesService.registrarDeviceToken('fcm-token-123', 'android');
    expect(api.post).toHaveBeenCalledWith('/notificaciones/device-token', {
      token: 'fcm-token-123',
      plataforma: 'android',
    });

    await notificacionesService.bajaDeviceToken('fcm-token-123');
    expect(api.delete).toHaveBeenCalledWith('/notificaciones/device-token', {
      data: { token: 'fcm-token-123' },
    });
  });
});
