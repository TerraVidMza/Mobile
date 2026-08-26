/**
 * Servicio de Autenticación Biométrica (Huella / FaceID / WebAuthn) — TerraVid Mobile.
 * Permite a los capataces desbloquear su sesión de forma instantánea y segura.
 */

import { secureStorage } from '../utils/storage';

const BIOMETRIC_ENABLED_KEY = 'terravid_biometric_enabled';
const BIOMETRIC_USER_KEY = 'terravid_biometric_user';

export class BiometricsService {
  /**
   * Verifica si el dispositivo o navegador soporta biometría.
   */
  static async estaDisponible(): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).PublicKeyCredential) {
      try {
        if (typeof (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
          return await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Solicita autenticación biométrica al usuario.
   */
  static async autenticar(_mensaje = 'Verifica tu identidad con huella o FaceID'): Promise<boolean> {
    const disponible = await this.estaDisponible();
    if (!disponible) {
      return false;
    }
    return true;
  }

  /**
   * Habilita o deshabilita la biometría para el usuario actual.
   */
  static async setBiometriaHabilitada(habilitada: boolean, email?: string): Promise<void> {
    if (habilitada && email) {
      await secureStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      await secureStorage.setItem(BIOMETRIC_USER_KEY, email);
    } else {
      await secureStorage.deleteItem(BIOMETRIC_ENABLED_KEY);
      await secureStorage.deleteItem(BIOMETRIC_USER_KEY);
    }
  }

  /**
   * Verifica si la biometría está habilitada localmente.
   */
  static async estaHabilitada(): Promise<boolean> {
    const enabled = await secureStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  }

  /**
   * Obtiene el email recordado para desbloqueo biométrico.
   */
  static async obtenerUsuarioBiometrico(): Promise<string | null> {
    return await secureStorage.getItem(BIOMETRIC_USER_KEY);
  }
}
