/**
 * Utilidad de Registro de Service Worker para PWA (Progressive Web App).
 * Permite la carga instantánea y caché offline en navegadores móviles (Chrome / Safari).
 */

export interface ServiceWorkerRegistrationStatus {
  isSupported: boolean;
  isRegistered: boolean;
  error?: string;
}

export async function registerServiceWorker(swUrl = '/sw.js'): Promise<ServiceWorkerRegistrationStatus> {
  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!(navigator as any).serviceWorker;
  if (!isSupported) {
    return { isSupported: false, isRegistered: false };
  }

  try {
    const registration = await (navigator as any).serviceWorker.register(swUrl, { scope: '/' });
    return {
      isSupported: true,
      isRegistered: !!registration,
    };
  } catch (err: any) {
    return {
      isSupported: true,
      isRegistered: false,
      error: err?.message ?? 'Error desconocido al registrar Service Worker',
    };
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!(navigator as any).serviceWorker;
  if (!isSupported) {
    return false;
  }

  try {
    const registration = await (navigator as any).serviceWorker.getRegistration();
    if (registration && typeof registration.unregister === 'function') {
      return await registration.unregister();
    }
    return false;
  } catch {
    return false;
  }
}
