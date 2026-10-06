/**
 * Ubicación al registrar (M-009): web con navigator.geolocation y nativo con
 * expo-location. Nunca lanza: sin permiso o sin señal devuelve null.
 */

import { Platform } from 'react-native';
import { capturarCoordenadasGPS, formatearCoordenadas } from './location';

const expoLocation = {
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
};
jest.mock('expo-location', () => expoLocation, { virtual: true });

function navegador(valor: unknown) {
  Object.defineProperty(globalThis, 'navigator', { value: valor, configurable: true });
}

describe('capturarCoordenadasGPS', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('web', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'web';
    });

    it('sin geolocalización devuelve null', async () => {
      navegador({});
      expect(await capturarCoordenadasGPS()).toBeNull();
      expect(formatearCoordenadas(null)).toBe('Sin datos GPS');
    });

    it('devuelve las coordenadas redondeadas a 7 decimales', async () => {
      navegador({
        geolocation: {
          getCurrentPosition: (ok: (p: unknown) => void) =>
            ok({ coords: { latitude: -33.35418291234, longitude: -68.8921124, accuracy: 4.8 } }),
        },
      });
      const c = await capturarCoordenadasGPS();
      expect(c).toEqual({ latitud: -33.3541829, longitud: -68.8921124, precisionMetros: 5 });
      expect(formatearCoordenadas(c)).toBe('-33.3541829, -68.8921124 (±5 m)');
    });

    it('si el usuario niega el permiso devuelve null', async () => {
      navegador({
        geolocation: {
          getCurrentPosition: (_ok: unknown, error: (e: unknown) => void) => error({ code: 1 }),
        },
      });
      expect(await capturarCoordenadasGPS()).toBeNull();
    });
  });

  describe('nativo', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
    });

    it('sin permiso no pide la posición', async () => {
      expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      expect(await capturarCoordenadasGPS()).toBeNull();
      expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('con permiso devuelve la posición', async () => {
      expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      expoLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: -33.1, longitude: -68.2, accuracy: null },
      });
      expect(await capturarCoordenadasGPS()).toEqual({
        latitud: -33.1,
        longitud: -68.2,
        precisionMetros: undefined,
      });
    });

    it('si el GPS falla devuelve null en vez de lanzar', async () => {
      expoLocation.requestForegroundPermissionsAsync.mockRejectedValue(new Error('sin GPS'));
      expect(await capturarCoordenadasGPS()).toBeNull();
    });
  });
});
