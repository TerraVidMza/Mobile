/**
 * Sesión con refresh token — M-004 (D-023 del backend).
 *
 * El access token dura pocos minutos y se renueva en segundo plano con el
 * refresh token, que el backend rota en cada uso. Para la app de campo eso
 * tiene dos consecuencias:
 *
 * - **Sin señal no se cierra la sesión.** El access token vence mientras el
 *   capataz trabaja offline, pero no se usa hasta que vuelve la conexión; ahí
 *   la primera request lo renueva. Solo un 401 del propio `/auth/refresh`
 *   (sesión revocada o refresh vencido) termina la sesión.
 * - **Una única renovación en vuelo.** La sincronización dispara varias
 *   requests a la vez; si cada una renovara por su cuenta, el backend vería el
 *   segundo uso del mismo refresh token como robo y revocaría la sesión.
 *
 * Usa axios directo y no la instancia `api`: el refresh no lleva
 * `Authorization` y no puede pasar por el interceptor que lo dispara.
 */

import axios from 'axios';
import { ENV } from '../config/env';
import { secureStorage } from '../utils/storage';
import type { AuthUser, LoginResponse } from '../types/api.types';

/** Se renueva cuando al access token le queda menos que esto. */
export const MARGEN_RENOVACION_MS = 60_000;

const CLAVES = ['accessToken', 'refreshToken', 'refreshExpiresAt', 'user'] as const;

export async function guardarSesion(respuesta: LoginResponse): Promise<void> {
  await secureStorage.setItem('accessToken', respuesta.accessToken);
  await secureStorage.setItem('refreshToken', respuesta.refreshToken);
  await secureStorage.setItem('refreshExpiresAt', respuesta.refreshExpiresAt);
  await secureStorage.setItem('user', JSON.stringify(respuesta.user));
}

export async function borrarSesion(): Promise<void> {
  for (const clave of CLAVES) {
    await secureStorage.deleteItem(clave);
  }
}

/** Vencimiento del JWT leído sin verificar la firma (eso lo hace el backend). */
export function vencimientoDelToken(token: string): Date | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const json = atob(partes[1].replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

/** El refresh token existe y no venció. */
export async function puedeRenovar(ahora = new Date()): Promise<boolean> {
  const refresh = await secureStorage.getItem('refreshToken');
  if (!refresh) return false;
  const vence = await secureStorage.getItem('refreshExpiresAt');
  return !vence || new Date(vence) > ahora;
}

export async function convieneRenovar(accessToken: string, ahora = new Date()): Promise<boolean> {
  const vence = vencimientoDelToken(accessToken);
  if (!vence) return false;
  if (vence.getTime() - ahora.getTime() > MARGEN_RENOVACION_MS) return false;
  return puedeRenovar(ahora);
}

type OyenteRenovacion = (user: AuthUser) => void;
let _alRenovar: OyenteRenovacion | null = null;

/**
 * El store de auth se entera de las renovaciones para tomar el usuario
 * actualizado (rol, contraseña temporal). Va por callback porque el store
 * importa la instancia `api`, que importa este módulo.
 */
export function registrarAlRenovar(cb: OyenteRenovacion | null): void {
  _alRenovar = cb;
}

let _enVuelo: Promise<string | null> | null = null;

/**
 * Renueva la sesión. Devuelve el access token nuevo, `null` si la sesión
 * terminó (401 del backend o sin refresh token), o lanza si falló la red: en
 * ese caso no hay certeza de que la sesión haya muerto.
 */
export function renovarSesion(): Promise<string | null> {
  _enVuelo ??= renovar().finally(() => {
    _enVuelo = null;
  });
  return _enVuelo;
}

async function renovar(): Promise<string | null> {
  if (!(await puedeRenovar())) return null;
  const refreshToken = await secureStorage.getItem('refreshToken');

  try {
    const { data } = await axios.post<LoginResponse>(
      `${ENV.API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: ENV.API_TIMEOUT },
    );
    await guardarSesion(data);
    _alRenovar?.(data.user);
    return data.accessToken;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}
