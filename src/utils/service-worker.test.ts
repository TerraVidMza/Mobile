/**
 * Pruebas unitarias para el registro de Service Worker PWA.
 */

import { registerServiceWorker, unregisterServiceWorker } from './service-worker';

describe('Service Worker PWA Utility', () => {
  afterEach(() => {
    delete (global as any).navigator;
  });

  it('debe indicar no soportado si navigator.serviceWorker no existe', async () => {
    (global as any).navigator = {};

    const status = await registerServiceWorker();
    expect(status.isSupported).toBe(false);
    expect(status.isRegistered).toBe(false);
  });

  it('debe registrar el service worker exitosamente cuando está disponible', async () => {
    const mockRegister = jest.fn().mockResolvedValue({ scope: '/' });
    (global as any).navigator = {
      serviceWorker: {
        register: mockRegister,
      },
    };

    const status = await registerServiceWorker('/custom-sw.js');
    expect(status.isSupported).toBe(true);
    expect(status.isRegistered).toBe(true);
    expect(mockRegister).toHaveBeenCalledWith('/custom-sw.js', { scope: '/' });
  });

  it('debe capturar errores al fallar el registro', async () => {
    const mockRegister = jest.fn().mockRejectedValue(new Error('Network failure'));
    (global as any).navigator = {
      serviceWorker: {
        register: mockRegister,
      },
    };

    const status = await registerServiceWorker();
    expect(status.isSupported).toBe(true);
    expect(status.isRegistered).toBe(false);
    expect(status.error).toContain('Network failure');
  });

  it('debe desregistrar el service worker existente', async () => {
    const mockUnregister = jest.fn().mockResolvedValue(true);
    (global as any).navigator = {
      serviceWorker: {
        getRegistration: jest.fn().mockResolvedValue({ unregister: mockUnregister }),
      },
    };

    const unreg = await unregisterServiceWorker();
    expect(unreg).toBe(true);
    expect(mockUnregister).toHaveBeenCalled();
  });
});
