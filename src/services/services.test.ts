/**
 * Pruebas unitarias para los servicios API de TerraVid Mobile.
 */

import api from './api';
import { laborService } from './labor.service';
import { pesajeService } from './pesaje.service';
import { authService } from './auth.service';
import {
  fincasService,
  cuartelesService,
  tipoLaborService,
  insumosService,
  cuadrillasService,
} from './catalogos.service';

jest.mock('./api');

describe('API Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authService', () => {
    it('debe llamar a POST /auth/login con credenciales', async () => {
      const mockResponse = { data: { accessToken: 'tk-1', user: { id: 'u-1' } } };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      const res = await authService.login({ email: 'test@terravid.com', password: 'password123' });
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@terravid.com',
        password: 'password123',
      });
      expect(res).toEqual(mockResponse.data);
    });

    it('debe llamar a POST /auth/logout', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: {} });
      await authService.logout();
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
    });
  });

  describe('laborService', () => {
    it('debe llamar a POST /registro-labor/sync con el lote', async () => {
      const mockLote = [
        {
          localUuid: 'uuid-1',
          cuartelId: 'c-1',
          tipoLaborId: 'tl-1',
          fecha: '2026-08-25',
          cantidad: 10,
          createdAtLocal: '2026-08-25T10:00:00Z',
          insumos: [],
        },
      ];
      const mockResponse = {
        data: [{ localUuid: 'uuid-1', serverId: 'srv-1', status: 'created' }],
      };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      const res = await laborService.sincronizarLote(mockLote);
      expect(api.post).toHaveBeenCalledWith('/registro-labor/sync', { registros: mockLote });
      expect(res).toEqual(mockResponse.data);
    });
  });

  describe('pesajeService', () => {
    it('debe llamar a POST /pesajes-vendimia/sync con el lote', async () => {
      const mockLote = [
        {
          localUuid: 'p-1',
          cuadrillaId: 'cuad-1',
          cuartelId: 'c-1',
          fecha: '2026-08-25',
          pesoKg: 1000,
          createdAtLocal: '2026-08-25T11:00:00Z',
        },
      ];
      const mockResponse = {
        data: [{ localUuid: 'p-1', serverId: 'srv-p1', status: 'created' }],
      };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      const res = await pesajeService.sincronizarLote(mockLote);
      expect(api.post).toHaveBeenCalledWith('/pesajes-vendimia/sync', { pesajes: mockLote });
      expect(res).toEqual(mockResponse.data);
    });
  });

  describe('catalogos services', () => {
    it('debe consultar todos los catálogos correctamente', async () => {
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/fincas') return Promise.resolve({ data: [{ id: 'f-1' }] });
        if (url.startsWith('/cuarteles')) return Promise.resolve({ data: [{ id: 'c-1' }] });
        if (url === '/tipo-labor') return Promise.resolve({ data: [{ id: 't-1' }] });
        if (url === '/insumos') return Promise.resolve({ data: [{ id: 'i-1' }] });
        if (url.startsWith('/cuadrillas')) return Promise.resolve({ data: [{ id: 'cu-1' }] });
        return Promise.resolve({ data: [] });
      });

      const fincas = await fincasService.getAll();
      const cuarteles = await cuartelesService.getByFinca('f-1');
      const tipos = await tipoLaborService.getAll();
      const insumos = await insumosService.getAll();
      const cuadrillas = await cuadrillasService.getByFinca('f-1');

      expect(fincas).toEqual([{ id: 'f-1' }]);
      expect(cuarteles).toEqual([{ id: 'c-1' }]);
      expect(tipos).toEqual([{ id: 't-1' }]);
      expect(insumos).toEqual([{ id: 'i-1' }]);
      expect(cuadrillas).toEqual([{ id: 'cu-1' }]);
    });
  });
});
