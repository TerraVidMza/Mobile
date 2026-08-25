/**
 * Pruebas unitarias para Zustand auth.store.
 */

import { useAuthStore } from './auth.store';
import { authService } from '../services/auth.service';
import { secureStorage } from '../utils/storage';

jest.mock('../services/auth.service');
jest.mock('../utils/storage');

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('debe iniciar sesión con éxito y guardar token en secureStorage', async () => {
    const mockUser = {
      id: 'u-1',
      email: 'capataz@terravid.com',
      rol: 'capataz' as const,
      empresaId: 'emp-1',
      debeCambiarPassword: false,
    };

    (authService.login as jest.Mock).mockResolvedValue({
      accessToken: 'jwt-token-xyz',
      user: mockUser,
    });

    await useAuthStore.getState().login('capataz@terravid.com', 'SecurePass123!');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token-xyz');
    expect(state.user).toEqual(mockUser);
    expect(secureStorage.setItem).toHaveBeenCalledWith('accessToken', 'jwt-token-xyz');
  });

  it('debe manejar error de credenciales incorrectas (401)', async () => {
    (authService.login as jest.Mock).mockRejectedValue({
      response: { status: 401 },
    });

    await expect(
      useAuthStore.getState().login('bad@terravid.com', 'wrongpass'),
    ).rejects.toThrow('Email o contraseña incorrectos');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loginError).toBe('Email o contraseña incorrectos');
  });

  it('debe restaurar la sesión guardada desde secureStorage', async () => {
    const mockUser = {
      id: 'u-1',
      email: 'capataz@terravid.com',
      rol: 'capataz' as const,
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

  it('debe cerrar sesión y limpiar el almacenamiento seguro', async () => {
    (authService.logout as jest.Mock).mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('accessToken');
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('user');
  });
});
