/**
 * Permisos de la sesión — M-005 (D-024 del backend).
 *
 * El backend manda en `user.permisos` lo que el rol puede hacer. La app usa
 * tres:
 * - `appMovil`: poder usar la app (registrar labores o pesajes). Sin él no se
 *   entra; el backend además responde 403 al login con `cliente: 'movil'`.
 * - `laboresRegistro` y `pesajesRegistro`: qué pestañas y accesos se muestran.
 */

import type { AuthUser } from '../types/api.types';

export type PermisoMovil = 'appMovil' | 'laboresRegistro' | 'pesajesRegistro';

export function puede(user: Pick<AuthUser, 'permisos'> | null | undefined, permiso: PermisoMovil): boolean {
  return Array.isArray(user?.permisos) && user.permisos.includes(permiso);
}

export const MENSAJE_SIN_ACCESO_MOVIL =
  'Tu rol no tiene acceso a la app móvil. Ingresá desde la versión web.';
