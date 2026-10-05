import { rutaDeAccion } from './notificaciones';

describe('rutaDeAccion (M-006)', () => {
  it.each([
    [null, null],
    ['', null],
    ['/registro-labor/cuartel/abc', '/(tabs)/labores'],
    ['https://terravid.com/labores?x=1', '/(tabs)/labores'],
    ['/pesajes-vendimia/cuartel/abc', '/(tabs)/pesaje'],
    ['/remitos/123', null],
    ['/telemetria/alertas', null],
  ])('%s → %s', (url, esperado) => {
    expect(rutaDeAccion(url)).toBe(esperado);
  });
});
