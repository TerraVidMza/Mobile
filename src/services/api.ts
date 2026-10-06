/**
 * Instancia Axios centralizada para todas las llamadas al Backend.
 *
 * Interceptors:
 * - Request: inyecta `Authorization: Bearer <token>` desde SecureStore /
 *   localStorage, renovándolo antes si está por vencer (M-004).
 * - Response: ante 401 renueva la sesión y reintenta una vez; si la sesión
 *   terminó, la borra y avisa para volver al login. Sin conexión no se cierra
 *   la sesión.
 */

import axios, { type InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../utils/storage';
import { ENV } from '../config/env';
import { borrarSesion, convieneRenovar, renovarSesion } from './sesion.service';

type UnauthorizedCallback = () => void;
let _onUnauthorized: UnauthorizedCallback | null = null;

export function registerUnauthorizedCallback(cb: UnauthorizedCallback) {
  _onUnauthorized = cb;
}

const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: ENV.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** En estas rutas un 401 es una credencial equivocada, no una sesión vencida. */
function esRutaDeCredenciales(url: string | undefined): boolean {
  return Boolean(url && /\/auth\/(login|refresh)\b/.test(url));
}

// ─── Request interceptor: inyecta JWT ─────────────────────────────────────────

api.interceptors.request.use(
  async (config) => {
    let token = await secureStorage.getItem('accessToken');
    if (token && !esRutaDeCredenciales(config.url) && (await convieneRenovar(token))) {
      // Si la renovación falla por red, sale con el token que hay y decide el backend.
      token = (await renovarSesion().catch(() => token)) ?? token;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor: maneja 401 ────────────────────────────────────────

type ConfigReintentable = InternalAxiosRequestConfig & { _reintentado?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as ConfigReintentable | undefined;
    if (error.response?.status !== 401 || !config || esRutaDeCredenciales(config.url)) {
      return Promise.reject(error);
    }

    if (!config._reintentado) {
      const nuevo = await renovarSesion().catch(() => undefined);
      if (nuevo) {
        config._reintentado = true;
        config.headers.Authorization = `Bearer ${nuevo}`;
        return api(config);
      }
      // `undefined`: la renovación falló por red. No se expulsa a nadie.
      if (nuevo === undefined) return Promise.reject(error);
    }

    await borrarSesion();
    _onUnauthorized?.();
    return Promise.reject(error);
  },
);

export default api;
