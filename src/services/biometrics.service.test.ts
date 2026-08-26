/**
 * Pruebas unitarias para el Servicio de Biometría.
 */

import { BiometricsService } from './biometrics.service';
import { secureStorage } from '../utils/storage';

jest.mock('../utils/storage');

describe('Biometrics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).window = {};
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('debe detectar no disponibilidad si PublicKeyCredential no existe', async () => {
    delete (global as any).window.PublicKeyCredential;
    const disponible = await BiometricsService.estaDisponible();
    expect(disponible).toBe(false);
  });

  it('debe detectar disponibilidad si isUserVerifyingPlatformAuthenticatorAvailable retorna true', async () => {
    (global as any).window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(true),
    };

    const disponible = await BiometricsService.estaDisponible();
    expect(disponible).toBe(true);
  });

  it('debe guardar y consultar preferencia de biometría en secureStorage', async () => {
    await BiometricsService.setBiometriaHabilitada(true, 'capataz@terravid.com');
    expect(secureStorage.setItem).toHaveBeenCalledWith('terravid_biometric_enabled', 'true');
    expect(secureStorage.setItem).toHaveBeenCalledWith('terravid_biometric_user', 'capataz@terravid.com');

    (secureStorage.getItem as jest.Mock).mockResolvedValue('true');
    const habilitada = await BiometricsService.estaHabilitada();
    expect(habilitada).toBe(true);
  });

  it('debe deshabilitar y limpiar datos biométricos', async () => {
    await BiometricsService.setBiometriaHabilitada(false);
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('terravid_biometric_enabled');
    expect(secureStorage.deleteItem).toHaveBeenCalledWith('terravid_biometric_user');
  });

  it('debe autenticar exitosamente cuando está disponible', async () => {
    (global as any).window.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(true),
    };

    const res = await BiometricsService.autenticar();
    expect(res).toBe(true);
  });
});
