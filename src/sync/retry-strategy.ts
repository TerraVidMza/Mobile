/**
 * Estrategia de Reintentos con Backoff Exponencial y Jitter — HU-14.
 *
 * Delays:
 * - 1er reintento: 30s + jitter
 * - 2do reintento: 60s + jitter
 * - 3er reintento: 120s + jitter
 * - Máx 3 reintentos por sesión de sincronización.
 */

import { ENV } from '../config/env';

/**
 * Calcula el delay en milisegundos para el intento dado (0-indexed).
 * Agrega un jitter aleatorio de ±10% para evitar thundering herd.
 */
export function getRetryDelay(attemptIndex: number): number {
  const baseDelay =
    ENV.SYNC_RETRY_DELAYS[attemptIndex] ??
    ENV.SYNC_RETRY_DELAYS[ENV.SYNC_RETRY_DELAYS.length - 1];

  // Jitter entre -10% y +10%. NOSONAR: solo reparte reintentos en el tiempo,
  // no es un valor de seguridad; no necesita un generador criptográfico.
  const jitterFactor = 0.9 + Math.random() * 0.2; // NOSONAR
  return Math.round(baseDelay * jitterFactor);
}

/**
 * Espera el delay correspondiente al intento.
 */
export async function waitRetry(attemptIndex: number): Promise<void> {
  const delay = getRetryDelay(attemptIndex);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
