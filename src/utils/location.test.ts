/**
 * Ubicación al registrar (M-009): web con navigator.geolocation y nativo con
 * expo-location. Nunca lanza: sin permiso o sin señal devuelve null.
 */

import { Platform } from 'react-native';
import { capturarCoordenadasGPS, formatearCoordenadas } from './location';

const expoLocation = {
  getForegroundPermissionsAsync: jest.fn(),
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

    afterEach(() => jest.useRealTimers());

    const posicion = { coords: { latitude: -33.1, longitude: -68.2, accuracy: null } };

    it('con permiso ya concedido no lo vuelve a pedir', async () => {
      // Android 17 no contesta un pedido sin nada que preguntar (M-016).
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
      });
      expoLocation.getCurrentPositionAsync.mockResolvedValue(posicion);
      expect(await capturarCoordenadasGPS()).toEqual({
        latitud: -33.1,
        longitud: -68.2,
        precisionMetros: undefined,
      });
      expect(expoLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('sin permiso lo pide y, si lo da, devuelve la posición', async () => {
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      expoLocation.getCurrentPositionAsync.mockResolvedValue(posicion);
      expect(await capturarCoordenadasGPS()).not.toBeNull();
      expect(expoLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('si niega el permiso no pide la posición', async () => {
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      expoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
      expect(await capturarCoordenadasGPS()).toBeNull();
      expect(expoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('si el permiso quedó negado para siempre no lo pide', async () => {
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
      });
      expect(await capturarCoordenadasGPS()).toBeNull();
      expect(expoLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('si el pedido de permiso no contesta, sigue sin coordenadas', async () => {
      jest.useFakeTimers();
      expoLocation.getForegroundPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
        canAskAgain: true,
      });
      expoLocation.requestForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
      const resultado = capturarCoordenadasGPS();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(await resultado).toBeNull();
    });

    it('si el GPS falla devuelve null en vez de lanzar', async () => {
      expoLocation.getForegroundPermissionsAsync.mockRejectedValue(new Error('sin GPS'));
      expect(await capturarCoordenadasGPS()).toBeNull();
    });
  });
});
