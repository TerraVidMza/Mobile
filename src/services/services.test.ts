/**
 * Pruebas unitarias completas para los servicios API de TerraVid Mobile (100% Cobertura).
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
import { catalogosSyncService } from './catalogos-sync.service';
import { catalogosRepo } from '../db/repositories/catalogos.repo';

jest.mock('./api');
jest.mock('../db/repositories/catalogos.repo');
jest.mock('../utils/storage');

describe('API Services Layer (100% Coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authService', () => {
    it('debe invocar todos los endpoints de autenticación y cambio de password', async () => {
      (api.post as jest.Mock).mockImplementation((url: string) => {
        if (url === '/auth/login') return Promise.resolve({ data: { accessToken: 'tk-1', user: { id: 'u-1' } } });
        if (url === '/auth/logout') return Promise.resolve({ data: {} });
        if (url === '/auth/forgot-password') return Promise.resolve({ data: { message: 'Email enviado' } });
        if (url === '/auth/reset-password') return Promise.resolve({ data: { message: 'Password reseteado' } });
        if (url === '/auth/cambiar-password') return Promise.resolve({ data: {} });
        return Promise.resolve({ data: {} });
      });

      const loginRes = await authService.login({ email: 'test@terravid.com', password: 'password123' });
      expect(loginRes.accessToken).toBe('tk-1');

      await authService.logout();
      expect(api.post).toHaveBeenCalledWith('/auth/logout');

      const forgotRes = await authService.forgotPassword({ email: 'test@terravid.com' });
      expect(forgotRes.message).toBe('Email enviado');

      const resetRes = await authService.resetPassword({ token: 'tok-123', newPassword: 'NewPassword123!' });
      expect(resetRes.message).toBe('Password reseteado');

      await authService.changePassword({ currentPassword: 'Old', newPassword: 'New' });
      expect(api.post).toHaveBeenCalledWith('/auth/cambiar-password', {
        currentPassword: 'Old',
        newPassword: 'New',
      });
    });
  });

  describe('laborService', () => {
    it('debe registrar una labor individual (HTTP 201 y HTTP 200 idempotente)', async () => {
      (api.post as jest.Mock)
        .mockResolvedValueOnce({
          status: 201,
          data: { localUuid: 'l-1', estado: 'sincronizado', registroId: 'srv-1' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { localUuid: 'l-1', estado: 'sincronizado', registroId: 'srv-1', yaExistia: true },
        });

      const res1 = await laborService.registrarUno({
        localUuid: 'l-1',
        cuartelId: 'c-1',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        insumos: [],
      });
      expect(res1).toEqual({ localUuid: 'l-1', estado: 'sincronizado', registroId: 'srv-1' });
      expect(api.post).toHaveBeenCalledWith('/registro-labor', expect.objectContaining({ localUuid: 'l-1' }));

      const res2 = await laborService.registrarUno({
        localUuid: 'l-1',
        cuartelId: 'c-1',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        insumos: [],
      });
      expect(res2.yaExistia).toBe(true);
    });

    it('debe consultar labor por ID', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { id: 'srv-1', cantidad: 50 } });
      const labor = await laborService.findById('srv-1');
      expect(labor.id).toBe('srv-1');
    });

    it('debe sincronizar lote de labores', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: [{ localUuid: 'l-1', estado: 'sincronizado', registroId: 'srv-1' }],
      });
      const res = await laborService.sincronizarLote([
        { localUuid: 'l-1', cuartelId: 'c-1', tipoLaborId: 't-1', fecha: '2026-08-25', cantidad: 5, insumos: [] },
      ]);
      expect(res.length).toBe(1);
    });
  });

  describe('pesajeService', () => {
    it('debe registrar un pesaje individual y sincronizar lotes', async () => {
      (api.post as jest.Mock).mockImplementation((url: string) => {
        if (url === '/pesajes-vendimia') {
          return Promise.resolve({
            status: 201,
            data: { localUuid: 'loc-p1', estado: 'sincronizado', pesajeId: 'p-1' },
          });
        }
        if (url === '/pesajes-vendimia/sync') {
          return Promise.resolve({
            data: [{ localUuid: 'loc-p1', estado: 'sincronizado', pesajeId: 'p-1' }],
          });
        }
        return Promise.resolve({ data: {} });
      });

      const res = await pesajeService.registrarUno({
        localUuid: 'loc-p1',
        cuadrillaId: 'cuad-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        kgTotales: 500,
      });
      expect(res).toEqual({ localUuid: 'loc-p1', estado: 'sincronizado', pesajeId: 'p-1' });

      const batchRes = await pesajeService.sincronizarLote([
        { localUuid: 'loc-p1', cuadrillaId: 'cuad-1', cuartelId: 'c-1', fecha: '2026-08-25', kgTotales: 500 },
      ]);
      expect(batchRes.length).toBe(1);
    });
  });

  describe('catalogosService', () => {
    it('debe invocar todos los endpoints de catálogos', async () => {
      // Forma real del backend (ver Backend/src/modules/fincas y /cuarteles):
      // `hectareas`/`activa` en Finca, `variedad` anidado en Cuartel — no
      // `superficie`/`activo`/`variedad: string`, que es lo que esta prueba
      // mockeaba antes y por lo que el bug de mapeo pasó desapercibido.
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/fincas') {
          return Promise.resolve({
            data: [{ id: 'f-1', nombre: 'Finca 1', ubicacion: null, hectareas: '10.00', activa: true }],
          });
        }
        if (url.startsWith('/cuarteles')) {
          return Promise.resolve({
            data: [
              {
                id: 'c-1',
                fincaId: 'f-1',
                nombre: 'Cuartel 1',
                variedad: { nombre: 'Malbec' },
                hectareas: '5.00',
                anioImplantacion: 2020,
                estado: 'pendiente',
                activo: true,
              },
            ],
          });
        }
        if (url === '/tipos-labor') return Promise.resolve({ data: [{ id: 't-1' }] });
        if (url === '/insumos') return Promise.resolve({ data: [{ id: 'i-1' }] });
        if (url.startsWith('/cuadrillas')) return Promise.resolve({ data: [{ id: 'cu-1' }] });
        return Promise.resolve({ data: [] });
      });

      expect(await fincasService.getAll()).toEqual([
        { id: 'f-1', nombre: 'Finca 1', ubicacion: null, superficie: 10, activo: true },
      ]);
      expect(await cuartelesService.getByFinca('f-1')).toEqual([
        {
          id: 'c-1',
          fincaId: 'f-1',
          nombre: 'Cuartel 1',
          variedad: 'Malbec',
          superficie: 5,
          anioPlantacion: 2020,
          estado: 'pendiente',
          activo: true,
        },
      ]);
      expect(await tipoLaborService.getAll()).toEqual([{ id: 't-1' }]);
      expect(await insumosService.getAll()).toEqual([{ id: 'i-1' }]);
      expect(await cuadrillasService.getByFinca('f-1')).toEqual([{ id: 'cu-1' }]);
    });
  });

  describe('catalogosSyncService', () => {
    it('debe sincronizar catálogos y persistirlos en SQLite', async () => {
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/fincas') return Promise.resolve({ data: [{ id: 'f-1', nombre: 'Finca' }] });
        if (url.startsWith('/cuarteles')) return Promise.resolve({ data: [{ id: 'c-1', fincaId: 'f-1' }] });
        if (url === '/tipos-labor') return Promise.resolve({ data: [{ id: 't-1' }] });
        if (url === '/insumos') return Promise.resolve({ data: [{ id: 'i-1' }] });
        if (url.startsWith('/cuadrillas')) return Promise.resolve({ data: [{ id: 'cu-1', fincaId: 'f-1' }] });
        return Promise.resolve({ data: [] });
      });

      const res = await catalogosSyncService.syncAll();
      expect(res.success).toBe(true);
      expect(catalogosRepo.saveFincas).toHaveBeenCalled();
      expect(catalogosRepo.saveCuarteles).toHaveBeenCalled();
      expect(catalogosRepo.saveCuadrillas).toHaveBeenCalled();
    });

    it('debe manejar errores en sub-consultas y continuar con las demás', async () => {
      (api.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/fincas') return Promise.resolve({ data: [{ id: 'f-1' }, { id: 'f-2' }] });
        if (url.includes('f-1')) return Promise.reject(new Error('Finca 1 not found'));
        if (url.includes('f-2')) return Promise.resolve({ data: [{ id: 'c-2' }] });
        if (url === '/tipos-labor') return Promise.resolve({ data: [] });
        if (url === '/insumos') return Promise.resolve({ data: [] });
        return Promise.resolve({ data: [] });
      });

      const res = await catalogosSyncService.syncAll();
      expect(res.success).toBe(true);
    });

    it('debe capturar error global al fallar fincas', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('Falla global de red'));
      const res = await catalogosSyncService.syncAll();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Falla global de red');
    });

    it('debe capturar error no estándar', async () => {
      (api.get as jest.Mock).mockRejectedValue('Error string');
      const res = await catalogosSyncService.syncAll();
      expect(res.success).toBe(false);
      expect(res.error).toBe('Error desconocido al descargar catálogos');
    });
  });
});
