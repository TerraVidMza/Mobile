/**
 * Pruebas unitarias para la utilidad de Geolocalización GPS.
 */

import { capturarCoordenadasGPS, formatearCoordenadas } from './location';

describe('GPS Geolocation Utility', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });

  it('debe retornar null si navigator.geolocation no existe', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
    });

    const coords = await capturarCoordenadasGPS();
    expect(coords).toBeNull();
    expect(formatearCoordenadas(coords)).toBe('Sin datos GPS');
  });

  it('debe capturar coordenadas con éxito cuando se otorga permiso', async () => {
    const mockGeolocation = {
      getCurrentPosition: jest.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: -33.3541829,
            longitude: -68.8921124,
            accuracy: 4.8,
          },
        });
      }),
    };

    Object.defineProperty(global, 'navigator', {
      value: { geolocation: mockGeolocation },
      writable: true,
    });

    const coords = await capturarCoordenadasGPS();
    expect(coords).not.toBeNull();
    expect(coords?.latitud).toBe(-33.354183);
    expect(coords?.longitud).toBe(-68.892112);
    expect(coords?.precisionMetros).toBe(5);

    const formatted = formatearCoordenadas(coords);
    expect(formatted).toBe('-33.354183, -68.892112 (±5m)');
  });

  it('debe manejar denegación de permisos o timeout retornando null', async () => {
    const mockGeolocation = {
      getCurrentPosition: jest.fn().mockImplementation((_, error) => {
        error({ code: 1, message: 'User denied geolocation' });
      }),
    };

    Object.defineProperty(global, 'navigator', {
      value: { geolocation: mockGeolocation },
      writable: true,
    });

    const coords = await capturarCoordenadasGPS();
    expect(coords).toBeNull();
  });
});
