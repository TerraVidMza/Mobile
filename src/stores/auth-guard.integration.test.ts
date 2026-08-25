/**
 * Pruebas de Integración para Seguridad, AuthGate y Guards de Sesión (HU-01, HU-04).
 *
 * Valida:
 * 1. Forzado de cambio de contraseña cuando debeCambiarPassword === true.
 * 2. Cierre de sesión y revocación atómica tras respuesta 401 Unauthorized.
 * 3. Eliminación de credenciales en almacenamiento seguro durante el logout.
 */

import { useAuthStore } from './auth.store';
import { authService } from '../services/auth.service';
import { secureStorage } from '../utils/storage';
import api, { registerUnauthorizedCallback } from '../services/api';
import { RolNombre } from '../types/api.types';

jest.mock('../services/auth.service');
jest.mock('../utils/storage');

describe('AuthGuard & Session Security Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('debe identificar usuario que debe cambiar contraseña obligatoriamente (HU-04)', async () => {
    (authService.login as jest.Mock).mockResolvedValueOnce({
      accessToken: 'jwt-temp-token',
      user: {
        id: 'u-1',
        email: 'nuevo.capataz@terravid.com',
        rol: RolNombre.CAPATAZ,
        empresaId: 'emp-1',
        debeCambiarPassword: true,
      },
    });

    await useAuthStore.getState().login('nuevo.capataz@terravid.com', 'TempPass123!');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.debeCambiarPassword).toBe(true);
    expect(secureStorage.setItem).toHaveBeenCalledWith('accessToken', 'jwt-temp-token');
  });

  it('debe revocar sesión y borrar tokens cuando el interceptor detecta error 401', async () => {
    // Configurar callback de 401 conectado al store
    registerUnauthorizedCallback(() => {
      useAuthStore.getState().logout();
    });

    useAuthStore.setState({
      user: {
        id: 'u-1',
        email: 'capataz@terravid.com',
        rol: RolNombre.CAPATAZ,
        empresaId: 'emp-1',
        debeCambiarPassword: false,
      },
      token: 'jwt-expired-token',
      isAuthenticated: true,
    });

    // Simular error 401 interceptado
    const responseInterceptor = (api.interceptors.response as any).handlers[0].rejected;
    const error401 = {
      response: { status: 401, data: { message: 'Token expired' } },
      config: { headers: {} },
    };

    await expect(responseInterceptor(error401)).rejects.toEqual(error401);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('accessToken');
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('user');
  });
});
