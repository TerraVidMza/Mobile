/**
 * Pruebas unitarias para la instancia Axios y sus interceptores (api.ts - 100% Cobertura).
 */

import api, { registerUnauthorizedCallback } from './api';
import { secureStorage } from '../utils/storage';

jest.mock('../utils/storage');

describe('API Axios Instance & Interceptors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe registrar y ejecutar el callback onUnauthorized ante un error 401', async () => {
    const unauthCallback = jest.fn();
    registerUnauthorizedCallback(unauthCallback);

    const responseInterceptor = (api.interceptors.response as any).handlers[0];

    const error401 = { response: { status: 401 } };
    await expect(responseInterceptor.rejected(error401)).rejects.toEqual(error401);

    expect(secureStorage.deleteItem).toHaveBeenCalledWith('accessToken');
    expect(unauthCallback).toHaveBeenCalled();
  });

  it('debe pasar las respuestas exitosas directamente', () => {
    const responseInterceptor = (api.interceptors.response as any).handlers[0];
    const mockRes = { data: { ok: true } };
    expect(responseInterceptor.fulfilled(mockRes)).toEqual(mockRes);
  });

  it('debe inyectar token en la cabecera Authorization si existe', async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue('jwt-token-val');
    const requestInterceptor = (api.interceptors.request as any).handlers[0];

    const config = { headers: {} as any };
    const resultConfig = await requestInterceptor.fulfilled(config);
    expect(resultConfig.headers.Authorization).toBe('Bearer jwt-token-val');
  });

  it('debe no inyectar cabecera Authorization si no hay token', async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
    const requestInterceptor = (api.interceptors.request as any).handlers[0];

    const config = { headers: {} as any };
    const resultConfig = await requestInterceptor.fulfilled(config);
    expect(resultConfig.headers.Authorization).toBeUndefined();
  });

  it('debe rechazar errores en el interceptor de request', async () => {
    const requestInterceptor = (api.interceptors.request as any).handlers[0];
    const reqError = new Error('Request configuration error');
    await expect(requestInterceptor.rejected(reqError)).rejects.toEqual(reqError);
  });
});
