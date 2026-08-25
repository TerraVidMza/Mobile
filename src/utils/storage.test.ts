/**
 * Pruebas unitarias completas para almacenamiento seguro multiplataforma (storage.ts).
 */

import { Platform } from 'react-native';
import { secureStorage } from './storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockImplementation((key: string) => Promise.resolve(`native_${key}`)),
  setItemAsync: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteItemAsync: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('secureStorage', () => {
  const localStorageMock: { [key: string]: string } = {};

  beforeAll(() => {
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => localStorageMock[key] ?? null,
        setItem: (key: string, val: string) => {
          localStorageMock[key] = val;
        },
        removeItem: (key: string) => {
          delete localStorageMock[key];
        },
        clear: () => {
          Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
        },
      },
    };
  });

  beforeEach(() => {
    (Platform as any).OS = 'web';
    (global as any).window.localStorage.clear();
    jest.clearAllMocks();
  });

  describe('En plataforma Web', () => {
    it('debe guardar, obtener y eliminar valores en localStorage', async () => {
      await secureStorage.setItem('test_key', 'valor_secreto_123');
      const retrieved = await secureStorage.getItem('test_key');
      expect(retrieved).toBe('valor_secreto_123');

      await secureStorage.deleteItem('test_key');
      const afterDelete = await secureStorage.getItem('test_key');
      expect(afterDelete).toBeNull();
    });

    it('debe manejar errores de localStorage de forma segura', async () => {
      const originalGet = (global as any).window.localStorage.getItem;
      (global as any).window.localStorage.getItem = () => {
        throw new Error('QuotaExceeded');
      };
      const res = await secureStorage.getItem('test_key');
      expect(res).toBeNull();
      (global as any).window.localStorage.getItem = originalGet;
    });
  });

  describe('En plataforma Nativa (iOS / Android)', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('debe invocar expo-secure-store getItemAsync', async () => {
      const res = await secureStorage.getItem('token');
      expect(res).toBe('native_token');
    });

    it('debe invocar expo-secure-store setItemAsync', async () => {
      await secureStorage.setItem('token', 'jwt123');
      const SecureStore = require('expo-secure-store');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'jwt123');
    });

    it('debe invocar expo-secure-store deleteItemAsync', async () => {
      await secureStorage.deleteItem('token');
      const SecureStore = require('expo-secure-store');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token');
    });
  });
});
