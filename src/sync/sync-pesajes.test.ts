/**
 * Pruebas unitarias para el motor de sincronización de pesajes (HU-24).
 */

import { syncPesajesBatch } from './sync-pesajes';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { pesajeService } from '../services/pesaje.service';

jest.mock('../db/repositories/pesajes.repo');
jest.mock('../services/pesaje.service');

describe('syncPesajesBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe retornar totalSynced: 0 si no hay pesajes pendientes', async () => {
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(0);

    const result = await syncPesajesBatch();

    expect(result).toEqual({ totalSynced: 0, errorsCount: 0 });
    expect(pesajeService.sincronizarLote).not.toHaveBeenCalled();
  });

  it('debe sincronizar lote de pesajes y marcar sincronizados', async () => {
    const mockPendientes = [
      {
        localUuid: 'pesaje-1',
        cuadrillaId: 'cuad-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 1250.5,
        createdAtLocal: '2026-08-25T11:00:00-03:00',
      },
    ];

    const progressMock = jest.fn();
    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (pesajesRepo.getPendientes as jest.Mock)
      .mockResolvedValueOnce(mockPendientes)
      .mockResolvedValueOnce([]);

    (pesajeService.sincronizarLote as jest.Mock).mockResolvedValue([
      { localUuid: 'pesaje-1', serverId: 'srv-p1', status: 'created' },
    ]);

    const result = await syncPesajesBatch(progressMock);

    expect(result).toEqual({ totalSynced: 1, errorsCount: 0 });
    expect(pesajesRepo.markSincronizado).toHaveBeenCalledWith('pesaje-1', 'srv-p1');
    expect(progressMock).toHaveBeenCalledWith(1, 1);
  });

  it('debe marcar error si el backend reporta error en pesaje', async () => {
    const mockPendientes = [
      {
        localUuid: 'pesaje-err',
        cuadrillaId: 'cuad-invalid',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 500,
        createdAtLocal: '2026-08-25T11:00:00-03:00',
      },
    ];

    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (pesajesRepo.getPendientes as jest.Mock)
      .mockResolvedValueOnce(mockPendientes)
      .mockResolvedValueOnce([]);

    (pesajeService.sincronizarLote as jest.Mock).mockResolvedValue([
      { localUuid: 'pesaje-err', status: 'error', error: 'Cuadrilla inactiva' },
    ]);

    const result = await syncPesajesBatch();

    expect(result).toEqual({ totalSynced: 0, errorsCount: 1 });
    expect(pesajesRepo.markError).toHaveBeenCalledWith('pesaje-err', 'Cuadrilla inactiva');
  });

  it('debe manejar excepción de red (Error object) y marcar error en pesajes', async () => {
    const mockPendientes = [
      {
        localUuid: 'pesaje-net',
        cuadrillaId: 'cuad-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 500,
        createdAtLocal: '2026-08-25T11:00:00-03:00',
      },
    ];

    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (pesajesRepo.getPendientes as jest.Mock).mockResolvedValueOnce(mockPendientes);
    (pesajeService.sincronizarLote as jest.Mock).mockRejectedValue(new Error('Connection reset'));

    const result = await syncPesajesBatch();
    expect(result.errorsCount).toBe(1);
    expect(pesajesRepo.markError).toHaveBeenCalledWith('pesaje-net', 'Connection reset');
  });

  it('debe manejar excepción no-Error y marcar mensaje por defecto', async () => {
    const mockPendientes = [
      {
        localUuid: 'pesaje-str-err',
        cuadrillaId: 'cuad-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 500,
        createdAtLocal: '2026-08-25T11:00:00-03:00',
      },
    ];

    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (pesajesRepo.getPendientes as jest.Mock).mockResolvedValueOnce(mockPendientes);
    (pesajeService.sincronizarLote as jest.Mock).mockRejectedValue('Fatal network crash');

    const result = await syncPesajesBatch();
    expect(result.errorsCount).toBe(1);
    expect(pesajesRepo.markError).toHaveBeenCalledWith(
      'pesaje-str-err',
      'Error al sincronizar pesajes',
    );
  });
});
