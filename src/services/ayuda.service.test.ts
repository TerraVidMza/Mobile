/**
 * Pruebas de ayuda.service.ts (M-022).
 */

import api from './api';
import { ayudaService } from './ayuda.service';

jest.mock('./api');
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

describe('ayudaService', () => {
  it('manda el módulo, la descripción y la versión de la app', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 't-1', emailEnviado: true } });

    const ticket = await ayudaService.crearTicket('vendimia', 'No aparece la cuadrilla nueva.');

    expect(api.post).toHaveBeenCalledWith('/ayuda/tickets', {
      modulo: 'vendimia',
      descripcion: 'No aparece la cuadrilla nueva.',
      appVersion: 'movil 1.0.0',
    });
    expect(ticket.emailEnviado).toBe(true);
  });
});
