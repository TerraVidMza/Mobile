/**
 * Pruebas unitarias para el motor de sincronización de labores (HU-14).
 */

import { syncLaboresBatch } from './sync-labores';
import { laboresRepo } from '../db/repositories/labores.repo';
import { laborService } from '../services/labor.service';

jest.mock('../db/repositories/labores.repo');
jest.mock('../services/labor.service');

describe('syncLaboresBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe retornar totalSynced: 0 si no hay pendientes', async () => {
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(0);

    const result = await syncLaboresBatch();

    expect(result).toEqual({ totalSynced: 0, errorsCount: 0 });
    expect(laborService.sincronizarLote).not.toHaveBeenCalled();
  });

  it('debe enviar lote de 10 y marcar sincronizados según respuesta del backend', async () => {
    const mockPendientes = [
      {
        localUuid: 'uuid-1',
        cuartelId: 'c-1',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        createdAtLocal: '2026-08-25T10:00:00-03:00',
        insumos: [],
      },
      {
        localUuid: 'uuid-2',
        cuartelId: 'c-2',
        tipoLaborId: 'tl-2',
        fecha: '2026-08-25',
        cantidad: 5,
        createdAtLocal: '2026-08-25T10:05:00-03:00',
        insumos: [],
      },
    ];

    const progressMock = jest.fn();
    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(2);
    (laboresRepo.getPendientes as jest.Mock)
      .mockResolvedValueOnce(mockPendientes)
      .mockResolvedValueOnce([]);

    (laborService.sincronizarLote as jest.Mock).mockResolvedValue([
      { localUuid: 'uuid-1', serverId: 'srv-1', status: 'created' },
      { localUuid: 'uuid-2', serverId: 'srv-2', status: 'already_synced' },
    ]);

    const result = await syncLaboresBatch(progressMock);

    expect(result).toEqual({ totalSynced: 2, errorsCount: 0 });
    expect(laboresRepo.markSincronizado).toHaveBeenCalledWith('uuid-1', 'srv-1');
    expect(laboresRepo.markSincronizado).toHaveBeenCalledWith('uuid-2', 'srv-2');
    expect(progressMock).toHaveBeenCalledWith(2, 2);
  });

  it('debe marcar error en SQLite si el backend reporta error para un registro', async () => {
    const mockPendientes = [
      {
        localUuid: 'uuid-err',
        cuartelId: 'c-invalid',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        createdAtLocal: '2026-08-25T10:00:00-03:00',
        insumos: [],
      },
    ];

    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (laboresRepo.getPendientes as jest.Mock)
      .mockResolvedValueOnce(mockPendientes)
      .mockResolvedValueOnce([]);

    (laborService.sincronizarLote as jest.Mock).mockResolvedValue([
      {
        localUuid: 'uuid-err',
        status: 'error',
        error: 'El cuartel no existe o fue dado de baja',
      },
    ]);

    const result = await syncLaboresBatch();

    expect(result).toEqual({ totalSynced: 0, errorsCount: 1 });
    expect(laboresRepo.markError).toHaveBeenCalledWith(
      'uuid-err',
      'El cuartel no existe o fue dado de baja',
    );
  });

  it('debe manejar excepción de red (Error object) y marcar error en los registros', async () => {
    const mockPendientes = [
      {
        localUuid: 'uuid-net',
        cuartelId: 'c-1',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        createdAtLocal: '2026-08-25T10:00:00-03:00',
        insumos: [],
      },
    ];

    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (laboresRepo.getPendientes as jest.Mock).mockResolvedValueOnce(mockPendientes);
    (laborService.sincronizarLote as jest.Mock).mockRejectedValue(new Error('Network Timeout'));

    const result = await syncLaboresBatch();
    expect(result.errorsCount).toBe(1);
    expect(laboresRepo.markError).toHaveBeenCalledWith('uuid-net', 'Network Timeout');
  });

  it('debe manejar excepción de red no estándar (string o null)', async () => {
    const mockPendientes = [
      {
        localUuid: 'uuid-net-unknown',
        cuartelId: 'c-1',
        tipoLaborId: 'tl-1',
        fecha: '2026-08-25',
        cantidad: 10,
        createdAtLocal: '2026-08-25T10:00:00-03:00',
        insumos: [],
      },
    ];

    (laboresRepo.countPendientes as jest.Mock).mockResolvedValue(1);
    (laboresRepo.getPendientes as jest.Mock).mockResolvedValueOnce(mockPendientes);
    (laborService.sincronizarLote as jest.Mock).mockRejectedValue('Unknown network failure');

    const result = await syncLaboresBatch();
    expect(result.errorsCount).toBe(1);
    expect(laboresRepo.markError).toHaveBeenCalledWith(
      'uuid-net-unknown',
      'Error al sincronizar con el servidor',
    );
  });
});
