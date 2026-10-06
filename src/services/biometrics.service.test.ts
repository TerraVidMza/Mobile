/**
 * Desbloqueo biométrico (M-007): nativo con expo-local-authentication y web
 * con WebAuthn. Lo importante: nunca devuelve `true` sin verificación.
 */

import { Platform } from 'react-native';
import { BiometricsService } from './biometrics.service';
import { secureStorage } from '../utils/storage';

jest.mock('../utils/storage', () => {
  const almacen = new Map<string, string>();
  return {
    secureStorage: {
      getItem: jest.fn(async (k: string) => almacen.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void almacen.set(k, v)),
      deleteItem: jest.fn(async (k: string) => void almacen.delete(k)),
      __almacen: almacen,
    },
  };
});

const localAuth = {
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
};
jest.mock('expo-local-authentication', () => localAuth, { virtual: true });

const almacen = (secureStorage as unknown as { __almacen: Map<string, string> }).__almacen;

describe('BiometricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    almacen.clear();
  });

  describe('nativo', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
    });

    it('está disponible solo con hardware y huella cargada', async () => {
      localAuth.hasHardwareAsync.mockResolvedValue(true);
      localAuth.isEnrolledAsync.mockResolvedValue(false);
      expect(await BiometricsService.estaDisponible()).toBe(false);

      localAuth.isEnrolledAsync.mockResolvedValue(true);
      expect(await BiometricsService.estaDisponible()).toBe(true);
    });

    it('autenticar devuelve lo que dice el sistema', async () => {
      localAuth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
      expect(await BiometricsService.autenticar()).toBe(false);

      localAuth.authenticateAsync.mockResolvedValueOnce({ success: true });
      expect(await BiometricsService.autenticar()).toBe(true);
    });

    it('no se habilita si la verificación inicial falla', async () => {
      localAuth.authenticateAsync.mockResolvedValueOnce({ success: false });
      expect(await BiometricsService.habilitar('a@b.c')).toBe(false);
      expect(await BiometricsService.estaHabilitada()).toBe(false);
    });

    it('se habilita y se deshabilita', async () => {
      localAuth.authenticateAsync.mockResolvedValueOnce({ success: true });
      expect(await BiometricsService.habilitar('a@b.c')).toBe(true);
      expect(await BiometricsService.estaHabilitada()).toBe(true);

      await BiometricsService.deshabilitar();
      expect(await BiometricsService.estaHabilitada()).toBe(false);
    });
  });

  describe('web (WebAuthn)', () => {
    const credentials = { create: jest.fn(), get: jest.fn() };

    beforeEach(() => {
      (Platform as { OS: string }).OS = 'web';
      (globalThis as Record<string, unknown>).window = {
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(true),
        },
      };
      Object.defineProperty(globalThis, 'navigator', {
        value: { credentials },
        configurable: true,
      });
    });

    afterEach(() => {
      delete (globalThis as Record<string, unknown>).window;
    });

    it('sin credencial registrada no desbloquea (antes devolvía true)', async () => {
      expect(await BiometricsService.autenticar()).toBe(false);
      expect(credentials.get).not.toHaveBeenCalled();
    });

    it('registra la credencial al habilitar y la exige al desbloquear', async () => {
      credentials.create.mockResolvedValueOnce({ rawId: new Uint8Array([1, 2, 3]).buffer });
      expect(await BiometricsService.habilitar('a@b.c')).toBe(true);

      credentials.get.mockResolvedValueOnce({ id: 'x' });
      expect(await BiometricsService.autenticar()).toBe(true);

      const opciones = credentials.get.mock.calls[0][0].publicKey;
      expect(opciones.userVerification).toBe('required');
      expect(Array.from(opciones.allowCredentials[0].id)).toEqual([1, 2, 3]);
    });

    it('si el usuario cancela, no desbloquea', async () => {
      credentials.create.mockResolvedValueOnce({ rawId: new Uint8Array([9]).buffer });
      await BiometricsService.habilitar('a@b.c');
      credentials.get.mockRejectedValueOnce(new Error('NotAllowedError'));
      expect(await BiometricsService.autenticar()).toBe(false);
    });

    it('sin autenticador de plataforma no está disponible', async () => {
      (globalThis as { window: { PublicKeyCredential: unknown } }).window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(false),
      };
      expect(await BiometricsService.estaDisponible()).toBe(false);
    });
  });
});
