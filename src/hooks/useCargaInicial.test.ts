/**
 * Pruebas unitarias para useCargaInicial (M-021).
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useCargaInicial } from './useCargaInicial';

describe('useCargaInicial', () => {
  it('queda cargando hasta que termina la carga', async () => {
    const cargar = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCargaInicial(cargar));

    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('sale del estado de carga aunque la carga falle', async () => {
    const cargar = jest.fn().mockRejectedValue(new Error('SQLite no disponible'));
    const { result } = renderHook(() => useCargaInicial(cargar));

    await waitFor(() => expect(result.current).toBe(false));
  });
});
