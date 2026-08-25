/**
 * Tests unitarios para las utilidades de fecha local (D-009).
 */

import { fechaLocal, hoyLocal, timestampLocal } from './fecha-local';

describe('fecha-local utilities (D-009)', () => {
  it('fechaLocal formatea correctamente una fecha en YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 25); // Mes 7 = Agosto (0-indexed)
    expect(fechaLocal(d)).toBe('2026-08-25');
  });

  it('hoyLocal devuelve un string con formato YYYY-MM-DD', () => {
    const hoy = hoyLocal();
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('timestampLocal devuelve un formato ISO 8601 con offset', () => {
    const ts = timestampLocal();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });
});
