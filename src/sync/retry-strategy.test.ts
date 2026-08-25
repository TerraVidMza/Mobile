/**
 * Tests unitarios para la estrategia de reintentos (HU-14).
 */

import { getRetryDelay } from './retry-strategy';

describe('retry-strategy (HU-14)', () => {
  it('1er intento está cerca de 30s con jitter (27s - 33s)', () => {
    const delay = getRetryDelay(0);
    expect(delay).toBeGreaterThanOrEqual(27_000);
    expect(delay).toBeLessThanOrEqual(33_000);
  });

  it('2do intento está cerca de 60s con jitter (54s - 66s)', () => {
    const delay = getRetryDelay(1);
    expect(delay).toBeGreaterThanOrEqual(54_000);
    expect(delay).toBeLessThanOrEqual(66_000);
  });

  it('3er intento está cerca de 120s con jitter (108s - 132s)', () => {
    const delay = getRetryDelay(2);
    expect(delay).toBeGreaterThanOrEqual(108_000);
    expect(delay).toBeLessThanOrEqual(132_000);
  });
});
