/**
 * Servicio de autenticación — consume los endpoints de auth del Backend.
 *
 * Endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 * - POST /api/auth/cambiar-password
 */

import api from './api';
import type {
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
} from '../types/api.types';

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', { ...data, cliente: 'movil' });
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', data);
    return response.data;
  },

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/cambiar-password', data);
  },
};
