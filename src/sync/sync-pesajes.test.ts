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

  it('debe enviar lote de pesajes y marcar sincronizados', async () => {
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

    (pesajesRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (pesajesRepo.getPendientes as jest.Mock)
      .mockResolvedValueOnce(mockPendientes)
      .mockResolvedValueOnce([]);

    (pesajeService.sincronizarLote as jest.Mock).mockResolvedValue([
      { localUuid: 'pesaje-1', serverId: 'srv-p1', status: 'created' },
    ]);

    const result = await syncPesajesBatch();

    expect(result).toEqual({ totalSynced: 1, errorsCount: 0 });
    expect(pesajesRepo.markSincronizado).toHaveBeenCalledWith('pesaje-1', 'srv-p1');
  });

  it('debe marcar error en SQLite si el backend reporta error para un pesaje', async () => {
    const mockPendientes = [
      {
        localUuid: 'pesaje-err',
        cuadrillaId: 'cuad-inactive',
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
      {
        localUuid: 'pesaje-err',
        status: 'error',
        error: 'La cuadrilla está inactiva',
      },
    ]);

    const result = await syncPesajesBatch();

    expect(result).toEqual({ totalSynced: 0, errorsCount: 1 });
    expect(pesajesRepo.markError).toHaveBeenCalledWith(
      'pesaje-err',
      'La cuadrilla está inactiva',
    );
  });
});
