/**
 * Store de autenticación — Zustand + Secure Storage.
 *
 * Gestiona el estado de sesión, persiste el JWT en SecureStore / localStorage,
 * y coordina la descarga de catálogos al login exitoso.
 */

import { create } from 'zustand';
import { secureStorage } from '../utils/storage';
import { authService } from '../services/auth.service';
import { registerUnauthorizedCallback } from '../services/api';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { useCatalogosStore } from './catalogos.store';
import type { AuthUser } from '../types/api.types';

interface AuthState {
  /** Usuario autenticado, null si no hay sesión. */
  user: AuthUser | null;
  /** Token JWT actual (en memoria — la fuente de verdad está en SecureStore). */
  token: string | null;
  /** True si hay una sesión válida. */
  isAuthenticated: boolean;
  /** True si el usuario debe cambiar su contraseña antes de operar. */
  debeCambiarPassword: boolean;
  /** True mientras se carga el estado inicial desde SecureStore. */
  isLoading: boolean;
  /** Mensaje de error del último intento de login. */
  loginError: string | null;

  /** Intenta login con email y password. */
  login: (email: string, password: string) => Promise<void>;
  /** Cierra sesión y limpia todo el estado local. */
  logout: () => Promise<void>;
  /** Restaura sesión desde SecureStore al arrancar la app. */
  restore: () => Promise<void>;
  /** Limpia la sesión sin llamar al backend (usado por el interceptor 401). */
  clearSession: () => void;
  /** Limpia el error de login. */
  clearLoginError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  debeCambiarPassword: false,
  isLoading: true,
  loginError: null,

  login: async (email, password) => {
    set({ loginError: null });
    try {
      const response = await authService.login({ email, password });

      // Persiste el token en almacenamiento seguro
      await secureStorage.setItem('accessToken', response.accessToken);
      // Persiste datos del usuario para restaurar en el próximo arranque
      await secureStorage.setItem('user', JSON.stringify(response.user));

      set({
        user: response.user,
        token: response.accessToken,
        isAuthenticated: true,
        debeCambiarPassword: response.user.debeCambiarPassword,
        loginError: null,
      });

      // El docstring de este store prometía esto desde siempre, pero nada lo
      // llamaba: `syncEngine.runSync()` solo baja catálogos si antes hubo
      // labores/pesajes pendientes para subir, así que una sesión nueva sin
      // nada local (login recién hecho) se quedaba con los selectores de
      // Finca/Cuartel/Tipo de Labor vacíos hasta el primer pull-to-refresh.
      // No debe tumbar el login si falla (ej. sin conexión): ya hay sesión.
      try {
        await catalogosSyncService.syncAll();
        await useCatalogosStore.getState().loadFromLocalDb();
      } catch {
        // Sin conexión al loguearse: los selectores quedan vacíos hasta el
        // próximo pull-to-refresh o reconexión, que sí reintentan la sync.
      }
    } catch (error: unknown) {
      let message = 'Error de conexión. Intentá nuevamente.';

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response: { status: number; data?: { message?: string } } };
        const status = axiosError.response.status;

        if (status === 401) {
          message = 'Email o contraseña incorrectos';
        } else if (status === 429) {
          message = axiosError.response.data?.message
            ?? 'Cuenta bloqueada por demasiados intentos. Intentá en 15 minutos';
        }
      }

      set({ loginError: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      // Intenta notificar al backend (revoca el JWT en el servidor).
      if (get().token) {
        await authService.logout();
      }
    } catch {
      // Si falla (ej. sin red), la sesión se limpia igual en el cliente.
    } finally {
      await secureStorage.deleteItem('accessToken');
      await secureStorage.deleteItem('user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        debeCambiarPassword: false,
        loginError: null,
      });
    }
  },

  restore: async () => {
    try {
      const token = await secureStorage.getItem('accessToken');
      const userStr = await secureStorage.getItem('user');

      if (token && userStr) {
        const user: AuthUser = JSON.parse(userStr);
        set({
          user,
          token,
          isAuthenticated: true,
          debeCambiarPassword: user.debeCambiarPassword,
          isLoading: false,
        });
        return;
      }
    } catch {
      await secureStorage.deleteItem('accessToken');
      await secureStorage.deleteItem('user');
    }
    set({ isLoading: false });
  },

  clearSession: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      debeCambiarPassword: false,
    });
  },

  clearLoginError: () => {
    set({ loginError: null });
  },
}));

registerUnauthorizedCallback(() => {
  useAuthStore.getState().clearSession();
});
