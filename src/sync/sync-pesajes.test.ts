/**
 * Sincronización de pesajes (HU-24, M-003) contra SQLite real y el servicio
 * simulado con la forma exacta de la respuesta del backend.
 */

import { syncPesajesBatch } from './sync-pesajes';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { pesajeService } from '../services/pesaje.service';
import { closeDatabase, getDatabase } from '../db/database';
import { EstadoSync, type CreatePesajeDto } from '../types/api.types';

jest.mock('../services/pesaje.service');

async function crearPesaje(localUuid: string, pesoKg: number) {
  await pesajesRepo.createPesaje({
    localUuid,
    cuadrillaId: 'cu-1',
    cuartelId: 'c-1',
    fecha: '2026-10-05',
    pesoKg,
    estadoSync: EstadoSync.PENDIENTE,
    errorMessage: null,
    createdAtLocal: `2026-10-05T09:00:00-03:00`,
  });
}

describe('syncPesajesBatch', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await closeDatabase();
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM pesaje_vendimia`);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('no envía nada si no hay pendientes', async () => {
    expect(await syncPesajesBatch()).toEqual({ totalSynced: 0, errorsCount: 0, interrumpido: false });
    expect(pesajeService.sincronizarLote).not.toHaveBeenCalled();
  });

  it('envía kgTotales (no pesoKg) y guarda el pesajeId', async () => {
    await crearPesaje('p-1', 1250.5);
    (pesajeService.sincronizarLote as jest.Mock).mockImplementation(async (pesajes: CreatePesajeDto[]) =>
      pesajes.map((p) => ({ localUuid: p.localUuid, estado: 'sincronizado', pesajeId: 'srv-p-1' })),
    );

    const res = await syncPesajesBatch();

    expect(res).toEqual({ totalSynced: 1, errorsCount: 0, interrumpido: false });
    expect((pesajeService.sincronizarLote as jest.Mock).mock.calls[0][0]).toEqual([
      {
        localUuid: 'p-1',
        cuadrillaId: 'cu-1',
        cuartelId: 'c-1',
        fecha: '2026-10-05',
        kgTotales: 1250.5,
        createdAtLocal: '2026-10-05T09:00:00-03:00',
      },
    ]);
    expect(await pesajesRepo.getPesajeByUuid('p-1')).toMatchObject({
      estadoSync: EstadoSync.SINCRONIZADO,
      serverId: 'srv-p-1',
    });
  });

  it('un pesaje rechazado queda pendiente con el motivo', async () => {
    await crearPesaje('p-1', 10);
    (pesajeService.sincronizarLote as jest.Mock).mockResolvedValue([
      { localUuid: 'p-1', estado: 'error', errorMessage: 'Cuadrilla dada de baja' },
    ]);

    const res = await syncPesajesBatch();

    expect(res.errorsCount).toBe(1);
    expect(await pesajesRepo.getPesajeByUuid('p-1')).toMatchObject({
      estadoSync: EstadoSync.PENDIENTE,
      errorMessage: 'Cuadrilla dada de baja',
      intentosSync: 1,
    });
    expect(await pesajesRepo.countPendientes()).toBe(1);
  });

  it('manda la ubicación solo si se capturó (M-009)', async () => {
    await crearPesaje('p-sin', 10);
    await pesajesRepo.createPesaje({
      localUuid: 'p-con',
      cuadrillaId: 'cu-1',
      cuartelId: 'c-1',
      fecha: '2026-10-05',
      pesoKg: 20,
      estadoSync: EstadoSync.PENDIENTE,
      errorMessage: null,
      createdAtLocal: '2026-10-05T09:01:00-03:00',
      latitud: -33.1,
      longitud: -68.2,
    });
    (pesajeService.sincronizarLote as jest.Mock).mockImplementation(async (pesajes: CreatePesajeDto[]) =>
      pesajes.map((p) => ({ localUuid: p.localUuid, estado: 'sincronizado', pesajeId: 'x' })),
    );

    await syncPesajesBatch();

    const enviados = (pesajeService.sincronizarLote as jest.Mock).mock.calls[0][0] as CreatePesajeDto[];
    expect(enviados.find((p) => p.localUuid === 'p-sin')).not.toHaveProperty('latitud');
    expect(enviados.find((p) => p.localUuid === 'p-con')).toMatchObject({ latitud: -33.1, longitud: -68.2 });
  });
});
