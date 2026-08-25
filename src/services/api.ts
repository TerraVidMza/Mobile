/**
 * Instancia Axios centralizada para todas las llamadas al Backend.
 *
 * Interceptors:
 * - Request: inyecta `Authorization: Bearer <token>` desde SecureStore / localStorage.
 * - Response: ante 401 → borra sesión y redirige a login.
 */

import axios from 'axios';
import { secureStorage } from '../utils/storage';
import { ENV } from '../config/env';

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

// ─── Request interceptor: inyecta JWT ─────────────────────────────────────────

api.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor: maneja 401 ────────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await secureStorage.deleteItem('accessToken');
      if (_onUnauthorized) {
        _onUnauthorized();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
