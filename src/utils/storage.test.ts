/**
 * Pruebas unitarias para almacenamiento seguro multiplataforma (storage.ts).
 */

import { secureStorage } from './storage';

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
    (global as any).window.localStorage.clear();
  });

  it('debe guardar, obtener y eliminar valores correctamente en Web / localStorage', async () => {
    await secureStorage.setItem('test_key', 'valor_secreto_123');

    const retrieved = await secureStorage.getItem('test_key');
    expect(retrieved).toBe('valor_secreto_123');

    await secureStorage.deleteItem('test_key');
    const afterDelete = await secureStorage.getItem('test_key');
    expect(afterDelete).toBeNull();
  });

  it('debe retornar null para claves inexistentes', async () => {
    const value = await secureStorage.getItem('clave_que_no_existe');
    expect(value).toBeNull();
  });
});
