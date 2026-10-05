/**
 * Instancia Axios: inyección del token y renovación de sesión (M-004).
 *
 * Las requests pasan por un adapter falso en vez de la red, y `/auth/refresh`
 * (que va por axios directo) se simula con un spy sobre `axios.post`.
 */

import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import api, { registerUnauthorizedCallback } from './api';
import { secureStorage } from '../utils/storage';

jest.mock('../utils/storage', () => {
  const almacen = new Map<string, string>();
  return {
    secureStorage: {
      getItem: jest.fn(async (k: string) => almacen.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        almacen.set(k, v);
      }),
      deleteItem: jest.fn(async (k: string) => {
        almacen.delete(k);
      }),
      __almacen: almacen,
    },
  };
});

const almacen = (secureStorage as unknown as { __almacen: Map<string, string> }).__almacen;

function jwt(expEnSegundos: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', exp: expEnSegundos })}.firma`;
}
const AHORA = Math.floor(Date.now() / 1000);
const VIGENTE = jwt(AHORA + 3600);
const VENCE_PRONTO = jwt(AHORA + 10);

function sesion(access: string, refresh = 'refresh-1', refreshVence = '2099-01-01T00:00:00.000Z') {
  almacen.set('accessToken', access);
  almacen.set('refreshToken', refresh);
  almacen.set('refreshExpiresAt', refreshVence);
  almacen.set('user', '{}');
}

function respuestaRefresh(n: number) {
  return {
    data: {
      accessToken: jwt(AHORA + 900 + n),
      expiresIn: 900,
      refreshToken: `refresh-${n + 1}`,
      refreshExpiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'a@b.c', rol: 'Capataz', empresaId: 'e-1', debeCambiarPassword: false },
    },
  };
}

function error401(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: {},
  });
}

/** Adapter que responde 401 a los tokens de la lista y 200 al resto. */
function adapterQueRechaza(rechazados: Set<string>, llamadas: string[]): AxiosAdapter {
  return async (config) => {
    const auth = String(config.headers?.Authorization ?? '');
    llamadas.push(auth);
    if (rechazados.has(auth.replace('Bearer ', ''))) throw error401(config);
    return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
  };
}

describe('api: token y renovación de sesión', () => {
  let postSpy: jest.SpyInstance;
  let llamadas: string[];
  let expulsado: jest.Mock;

  beforeEach(() => {
    almacen.clear();
    llamadas = [];
    expulsado = jest.fn();
    registerUnauthorizedCallback(expulsado);
    let n = 1;
    postSpy = jest.spyOn(axios, 'post').mockImplementation(async () => respuestaRefresh(n++));
  });

  afterEach(() => {
    postSpy.mockRestore();
    api.defaults.adapter = undefined;
  });

  it('inyecta el token vigente sin renovar', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = adapterQueRechaza(new Set(), llamadas);

    await api.get('/fincas');

    expect(llamadas).toEqual([`Bearer ${VIGENTE}`]);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('no inyecta nada sin sesión', async () => {
    api.defaults.adapter = adapterQueRechaza(new Set(), llamadas);
    await api.get('/fincas');
    expect(llamadas).toEqual(['']);
  });

  it('renueva antes de mandar si el token está por vencer y guarda el refresh rotado', async () => {
    sesion(VENCE_PRONTO);
    api.defaults.adapter = adapterQueRechaza(new Set(), llamadas);

    await api.get('/fincas');

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      { refreshToken: 'refresh-1' },
      expect.anything(),
    );
    expect(llamadas[0]).not.toContain(VENCE_PRONTO);
    expect(almacen.get('refreshToken')).toBe('refresh-2');
  });

  it('ante un 401 renueva y reintenta una sola vez', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = adapterQueRechaza(new Set([VIGENTE]), llamadas);

    const res = await api.get('/fincas');

    expect(res.data).toEqual({ ok: true });
    expect(llamadas).toHaveLength(2);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(expulsado).not.toHaveBeenCalled();
  });

  it('varios 401 a la vez comparten una sola renovación', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = adapterQueRechaza(new Set([VIGENTE]), llamadas);

    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('si el refresh fue revocado, borra la sesión y avisa', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = adapterQueRechaza(new Set([VIGENTE]), llamadas);
    postSpy.mockRejectedValue(
      error401({ headers: new AxiosHeaders(), url: '/auth/refresh' } as InternalAxiosRequestConfig),
    );

    await expect(api.get('/fincas')).rejects.toThrow('Unauthorized');

    expect(expulsado).toHaveBeenCalledTimes(1);
    expect(almacen.has('accessToken')).toBe(false);
    expect(almacen.has('refreshToken')).toBe(false);
  });

  it('sin señal para renovar, no cierra la sesión', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = adapterQueRechaza(new Set([VIGENTE]), llamadas);
    postSpy.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    await expect(api.get('/fincas')).rejects.toThrow('Unauthorized');

    expect(expulsado).not.toHaveBeenCalled();
    expect(almacen.get('refreshToken')).toBe('refresh-1');
  });

  it('con el refresh vencido no intenta renovar y cierra la sesión', async () => {
    sesion(VIGENTE, 'refresh-1', '2000-01-01T00:00:00.000Z');
    api.defaults.adapter = adapterQueRechaza(new Set([VIGENTE]), llamadas);

    await expect(api.get('/fincas')).rejects.toThrow('Unauthorized');

    expect(postSpy).not.toHaveBeenCalled();
    expect(expulsado).toHaveBeenCalledTimes(1);
  });

  it('un 401 del token recién renovado no entra en bucle', async () => {
    sesion(VIGENTE);
    const llamadasAdapter: string[] = [];
    api.defaults.adapter = async (config) => {
      llamadasAdapter.push(String(config.headers?.Authorization));
      throw error401(config);
    };

    await expect(api.get('/fincas')).rejects.toThrow('Unauthorized');

    expect(llamadasAdapter).toHaveLength(2);
    expect(expulsado).toHaveBeenCalledTimes(1);
  });

  it('el 401 del login no renueva ni expulsa', async () => {
    api.defaults.adapter = async (config) => {
      throw error401(config);
    };

    await expect(api.post('/auth/login', {})).rejects.toThrow('Unauthorized');

    expect(postSpy).not.toHaveBeenCalled();
    expect(expulsado).not.toHaveBeenCalled();
  });

  it('pasa los errores que no son 401', async () => {
    sesion(VIGENTE);
    api.defaults.adapter = async (config) => {
      throw new AxiosError('boom', 'ERR_BAD_RESPONSE', config, {}, {
        status: 500,
        statusText: '',
        headers: {},
        config,
        data: {},
      });
    };

    await expect(api.get('/fincas')).rejects.toThrow('boom');
    expect(postSpy).not.toHaveBeenCalled();
  });
});
