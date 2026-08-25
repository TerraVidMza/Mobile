/**
 * Pruebas unitarias para Zustand auth.store (100% Cobertura).
 */

import { useAuthStore } from './auth.store';
import { authService } from '../services/auth.service';
import { secureStorage } from '../utils/storage';

jest.mock('../services/auth.service');
jest.mock('../utils/storage');
jest.mock('../services/api', () => ({
  registerUnauthorizedCallback: jest.fn((cb) => {
    (global as any).__unauthCb = cb;
  }),
}));

describe('useAuthStore (100% Coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().clearLoginError();
  });

  it('debe iniciar sesión con éxito y guardar token en secureStorage', async () => {
    const mockUser = {
      id: 'u-1',
      email: 'capataz@terravid.com',
      rol: 'Capataz' as any,
      empresaId: 'emp-1',
      debeCambiarPassword: true,
    };

    (authService.login as jest.Mock).mockResolvedValue({
      accessToken: 'jwt-token-xyz',
      user: mockUser,
    });

    await useAuthStore.getState().login('capataz@terravid.com', 'SecurePass123!');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.debeCambiarPassword).toBe(true);
    expect(state.token).toBe('jwt-token-xyz');
    expect(state.user).toEqual(mockUser);
  });

  it('debe manejar error de credenciales incorrectas (401)', async () => {
    (authService.login as jest.Mock).mockRejectedValue({
      response: { status: 401 },
    });

    await expect(
      useAuthStore.getState().login('bad@terravid.com', 'wrongpass'),
    ).rejects.toThrow('Email o contraseña incorrectos');

    expect(useAuthStore.getState().loginError).toBe('Email o contraseña incorrectos');
  });

  it('debe manejar error de rate limit (429) con mensaje del servidor o por defecto', async () => {
    (authService.login as jest.Mock).mockRejectedValueOnce({
      response: { status: 429, data: { message: 'Bloqueo temporal' } },
    });

    await expect(
      useAuthStore.getState().login('bad@terravid.com', 'wrongpass'),
    ).rejects.toThrow('Bloqueo temporal');

    (authService.login as jest.Mock).mockRejectedValueOnce({
      response: { status: 429 },
    });

    await expect(
      useAuthStore.getState().login('bad@terravid.com', 'wrongpass'),
    ).rejects.toThrow('Cuenta bloqueada por demasiados intentos. Intentá en 15 minutos');
  });

  it('debe manejar error genérico de conexión', async () => {
    (authService.login as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(
      useAuthStore.getState().login('bad@terravid.com', 'wrongpass'),
    ).rejects.toThrow('Error de conexión. Intentá nuevamente.');
  });

  it('debe restaurar la sesión guardada desde secureStorage', async () => {
    const mockUser = {
      id: 'u-1',
      email: 'capataz@terravid.com',
      rol: 'Capataz' as any,
      empresaId: 'emp-1',
      debeCambiarPassword: false,
    };

    (secureStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'accessToken') return 'saved-jwt-token';
      if (key === 'user') return JSON.stringify(mockUser);
      return null;
    });

    await useAuthStore.getState().restore();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('saved-jwt-token');
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
  });

  it('debe manejar JSON corrupto en restore borrando storage', async () => {
    (secureStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'accessToken') return 'token';
      if (key === 'user') return '{corrupted_json';
      return null;
    });

    await useAuthStore.getState().restore();

    expect(secureStorage.deleteItem).toHaveBeenCalledWith('accessToken');
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('user');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('debe cerrar sesión y manejar fallo en el servicio de logout', async () => {
    useAuthStore.setState({ token: 'active-tok' });
    (authService.logout as jest.Mock).mockRejectedValue(new Error('Logout failed on backend'));

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('accessToken');
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('user');
  });

  it('debe limpiar la sesión cuando se dispara el callback unauthorized 401', () => {
    useAuthStore.setState({ isAuthenticated: true, token: 'some-token' });
    if ((global as any).__unauthCb) {
      (global as any).__unauthCb();
    }
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
