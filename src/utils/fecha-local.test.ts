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

  it('timestampLocal devuelve un formato ISO 8601 con offset positivo y negativo', () => {
    const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;

    // Offset negativo (ej. GMT+3 -> getTimezoneOffset() = -180)
    Date.prototype.getTimezoneOffset = () => -180;
    const tsPos = timestampLocal();
    expect(tsPos).toMatch(/\+03:00$/);

    // Offset positivo (ej. GMT-3 -> getTimezoneOffset() = 180)
    Date.prototype.getTimezoneOffset = () => 180;
    const tsNeg = timestampLocal();
    expect(tsNeg).toMatch(/-03:00$/);

    Date.prototype.getTimezoneOffset = origGetTimezoneOffset;
  });
});
