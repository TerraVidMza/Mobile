/**
 * Desbloqueo biométrico de la sesión guardada — M-007.
 *
 * Es un **desbloqueo local**, no un login: la sesión (access + refresh token)
 * ya está en el dispositivo y la huella solo decide si se puede usar al abrir
 * la app. Sin biometría disponible, o si el usuario la cancela, queda la
 * contraseña.
 *
 * - Android / iOS: `expo-local-authentication` (huella, rostro o el PIN del
 *   dispositivo como respaldo).
 * - PWA: WebAuthn con un autenticador de plataforma. Al habilitarla se crea una
 *   credencial; al desbloquear se pide esa credencial con
 *   `userVerification: 'required'`, que obliga al navegador a verificar al
 *   usuario (huella, rostro o PIN del sistema). No hay servidor que valide la
 *   firma: el mismo nivel de confianza que la verificación local de Android.
 *
 * La versión anterior devolvía `true` sin pedir nada si el navegador conocía
 * `PublicKeyCredential`.
 */

import { Platform } from 'react-native';
import { secureStorage } from '../utils/storage';

const CLAVE_HABILITADA = 'terravid_biometric_enabled';
const CLAVE_CREDENCIAL_WEB = 'terravid_biometric_webauthn_id';

type LocalAuth = typeof import('expo-local-authentication');

function localAuth(): LocalAuth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-local-authentication') as LocalAuth;
}

function webAuthn(): typeof PublicKeyCredential | undefined {
  return typeof window !== 'undefined'
    ? (window as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential
    : undefined;
}

function aBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

function aleatorio(bytes: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(bytes));
  crypto.getRandomValues(arr);
  return arr;
}

export class BiometricsService {
  /** El dispositivo tiene biometría (o PIN) configurada. */
  static async estaDisponible(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        const pkc = webAuthn();
        if (!pkc?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
        return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      const la = localAuth();
      return (await la.hasHardwareAsync()) && (await la.isEnrolledAsync());
    } catch {
      return false;
    }
  }

  /** Pide la verificación. `true` solo si el usuario la superó. */
  static async autenticar(mensaje = 'Desbloqueá TerraVid'): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        const id = await secureStorage.getItem(CLAVE_CREDENCIAL_WEB);
        if (!id || !webAuthn()) return false;
        const resultado = await navigator.credentials.get({
          publicKey: {
            challenge: aleatorio(32),
            allowCredentials: [{ type: 'public-key', id: deBase64(id) }],
            userVerification: 'required',
            timeout: 60_000,
          },
        });
        return resultado !== null;
      }
      const resultado = await localAuth().authenticateAsync({
        promptMessage: mensaje,
        cancelLabel: 'Usar contraseña',
        disableDeviceFallback: false,
      });
      return resultado.success;
    } catch {
      return false;
    }
  }

  /**
   * Habilita el desbloqueo. Pide la verificación en el momento: no se habilita
   * algo que el usuario no comprobó que funciona.
   */
  static async habilitar(email: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (!webAuthn()) return false;
      try {
        const credencial = (await navigator.credentials.create({
          publicKey: {
            challenge: aleatorio(32),
            rp: { name: 'TerraVid' },
            user: { id: aleatorio(16), name: email, displayName: email },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },
              { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60_000,
          },
        })) as PublicKeyCredential | null;
        if (!credencial) return false;
        await secureStorage.setItem(CLAVE_CREDENCIAL_WEB, aBase64(credencial.rawId));
      } catch {
        return false;
      }
    } else if (!(await this.autenticar('Confirmá para activar el desbloqueo'))) {
      return false;
    }
    await secureStorage.setItem(CLAVE_HABILITADA, 'true');
    return true;
  }

  static async deshabilitar(): Promise<void> {
    await secureStorage.deleteItem(CLAVE_HABILITADA);
    await secureStorage.deleteItem(CLAVE_CREDENCIAL_WEB);
  }

  static async estaHabilitada(): Promise<boolean> {
    return (await secureStorage.getItem(CLAVE_HABILITADA)) === 'true';
  }
}
