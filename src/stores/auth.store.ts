/**
 * Store de autenticación — Zustand + Secure Storage.
 *
 * Gestiona el estado de sesión, persiste los tokens en SecureStore /
 * localStorage (access + refresh, M-004) y coordina la descarga de catálogos
 * al login exitoso.
 */

import { create } from 'zustand';
import { secureStorage } from '../utils/storage';
import { authService } from '../services/auth.service';
import { registerUnauthorizedCallback } from '../services/api';
import {
  borrarSesion,
  guardarSesion,
  puedeRenovar,
  registrarAlRenovar,
  vencimientoDelToken,
} from '../services/sesion.service';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { useCatalogosStore } from './catalogos.store';
import type { AuthUser } from '../types/api.types';
import { MENSAJE_SIN_ACCESO_MOVIL, puede } from '../utils/permisos';

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
  /** La contraseña temporal ya se cambió: se actualiza el store y lo guardado. */
  marcarPasswordCambiada: () => Promise<void>;
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

      // El backend ya lo rechaza con 403; esto cubre a un backend anterior a
      // D-024, que no conoce `cliente` (M-005).
      if (!puede(response.user, 'appMovil')) {
        set({ loginError: MENSAJE_SIN_ACCESO_MOVIL });
        throw new Error(MENSAJE_SIN_ACCESO_MOVIL);
      }

      // Tokens y usuario en almacenamiento seguro, para restaurar la sesión
      // en el próximo arranque aunque no haya señal.
      await guardarSesion(response);

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
      if (error instanceof Error && error.message === MENSAJE_SIN_ACCESO_MOVIL) {
        throw error;
      }
      let message = 'Error de conexión. Intentá nuevamente.';

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response: { status: number; data?: { message?: string } } };
        const status = axiosError.response.status;

        if (status === 401) {
          message = 'Email o contraseña incorrectos';
        } else if (status === 403) {
          message = axiosError.response.data?.message ?? MENSAJE_SIN_ACCESO_MOVIL;
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
      // Revoca en el servidor el access token y la sesión con su refresh token.
      if (get().token) {
        await authService.logout();
      }
    } catch {
      // Si falla (ej. sin red), la sesión se limpia igual en el cliente.
    } finally {
      await borrarSesion();
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

      // Se entra aunque el access token haya vencido, mientras el refresh siga
      // vigente: el capataz puede abrir la app sin señal y cargar registros, y
      // la primera request al volver la conexión renueva la sesión (M-004).
      const vence = token ? vencimientoDelToken(token) : null;
      const accessVigente = !vence || vence > new Date();
      const sesionUtilizable = accessVigente || (await puedeRenovar());

      const user: AuthUser | null = userStr ? JSON.parse(userStr) : null;
      // Una sesión guardada antes de D-024 no trae permisos: se pide login para
      // obtenerlos. Lo mismo si el rol perdió el acceso a la app (M-005).
      if (token && user && sesionUtilizable && puede(user, 'appMovil')) {
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
      // Datos corruptos: se descartan.
    }
    await borrarSesion();
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

  marcarPasswordCambiada: async () => {
    const user = get().user;
    if (!user) return;
    const actualizado = { ...user, debeCambiarPassword: false };
    // Persistido: si no, la próxima apertura de la app volvía a pedirla.
    await secureStorage.setItem('user', JSON.stringify(actualizado));
    set({ user: actualizado, debeCambiarPassword: false });
  },
}));

registerUnauthorizedCallback(() => {
  useAuthStore.getState().clearSession();
});

// Cada renovación trae el usuario actualizado (rol, contraseña temporal).
registrarAlRenovar((user) => {
  useAuthStore.setState({ user, debeCambiarPassword: user.debeCambiarPassword });
});
