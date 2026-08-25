/**
 * Variables de entorno de la aplicación.
 *
 * En un proyecto Expo se pueden inyectar a través de `extra` en app.json
 * o mediante expo-constants. Por ahora se hardcodean con fallback seguro
 * para que arrancar en dev sea inmediato.
 */

export const ENV = {
  /** URL base del backend API (sin trailing slash). */
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000/api',

  /** Máximo de registros por lote de sincronización (HU-14). */
  MAXIMO_REGISTROS_POR_LOTE: 10,

  /** Reintentos de sincronización antes de marcar como error. */
  SYNC_MAX_RETRIES: 3,

  /** Delays de backoff exponencial en ms (HU-14: 30s, 60s, 120s). */
  SYNC_RETRY_DELAYS: [30_000, 60_000, 120_000],

  /** Tiempo máximo de espera por request en ms. */
  API_TIMEOUT: 15_000,
} as const;
