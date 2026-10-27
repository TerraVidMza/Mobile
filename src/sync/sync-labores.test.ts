/**
 * Sincronización de labores (HU-14, M-003) contra SQLite real y el servicio
 * simulado con la forma exacta de la respuesta del backend.
 */

import { syncLaboresBatch } from './sync-labores';
import { laboresRepo } from '../db/repositories/labores.repo';
import { laborService } from '../services/labor.service';
import { closeDatabase, getDatabase } from '../db/database';
import { EstadoSync, type CreateRegistroLaborDto } from '../types/api.types';

jest.mock('../services/labor.service');

async function crearLabores(cantidad: number) {
  for (let i = 1; i <= cantidad; i++) {
    await laboresRepo.createLabor(
      {
        localUuid: `l-${String(i).padStart(2, '0')}`,
        cuartelId: 'c-1',
        tipoLaborId: 't-1',
        fecha: '2026-10-05',
        cantidad: i,
        estadoSync: EstadoSync.PENDIENTE,
        errorMessage: null,
        createdAtLocal: `2026-10-05T08:${String(i).padStart(2, '0')}:00-03:00`,
      },
      [{ insumoId: 'i-1', cantidad: 1 }],
    );
  }
}

describe('syncLaboresBatch', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await closeDatabase();
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM detalle_insumo_labor`);
    await db.runAsync(`DELETE FROM registro_labor`);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('envía el DTO del backend, guarda registroId y deja pendiente lo rechazado', async () => {
    await crearLabores(12);
    (laborService.sincronizarLote as jest.Mock).mockImplementation(
      async (registros: CreateRegistroLaborDto[]) =>
        registros.map((r) =>
          r.localUuid === 'l-03'
            ? { localUuid: r.localUuid, estado: 'error', errorMessage: 'No hay costo vigente' }
            : { localUuid: r.localUuid, estado: 'sincronizado', registroId: `srv-${r.localUuid}` },
        ),
    );

    const res = await syncLaboresBatch();

    expect(res).toEqual({ totalSynced: 11, errorsCount: 1, interrumpido: false });

    const primerLote = (laborService.sincronizarLote as jest.Mock).mock.calls[0][0];
    expect(primerLote).toHaveLength(10);
    expect(primerLote[0]).toEqual({
      localUuid: 'l-01',
      cuartelId: 'c-1',
      tipoLaborId: 't-1',
      fecha: '2026-10-05',
      cantidad: 1,
      createdAtLocal: '2026-10-05T08:01:00-03:00',
      // `cantidadUsada`, como lo valida el backend (M-023).
      insumos: [{ insumoId: 'i-1', cantidadUsada: 1 }],
    });

    const sincronizada = await laboresRepo.getLaborByUuid('l-01');
    expect(sincronizada).toMatchObject({ estadoSync: EstadoSync.SINCRONIZADO, serverId: 'srv-l-01' });

    const rechazada = await laboresRepo.getLaborByUuid('l-03');
    expect(rechazada).toMatchObject({
      estadoSync: EstadoSync.PENDIENTE,
      errorMessage: 'No hay costo vigente',
      intentosSync: 1,
    });
    expect(await laboresRepo.countPendientes()).toBe(1);
  });

  it('un corte de red deja el lote pendiente y se reintenta en la ronda siguiente', async () => {
    await crearLabores(2);
    (laborService.sincronizarLote as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    const primera = await syncLaboresBatch();
    expect(primera).toEqual({ totalSynced: 0, errorsCount: 2, interrumpido: true });
    expect(await laboresRepo.countPendientes()).toBe(2);

    (laborService.sincronizarLote as jest.Mock).mockImplementation(
      async (registros: CreateRegistroLaborDto[]) =>
        registros.map((r) => ({ localUuid: r.localUuid, estado: 'sincronizado', registroId: 'x' })),
    );
    const segunda = await syncLaboresBatch();

    expect(segunda.totalSynced).toBe(2);
    expect(await laboresRepo.countPendientes()).toBe(0);
  });

  it('editar una labor reinicia los intentos y borra el motivo', async () => {
    await crearLabores(1);
    await laboresRepo.registrarIntentoFallido('l-01', 'Cuartel dado de baja');

    await laboresRepo.updateLabor(
      'l-01',
      { cuartelId: 'c-2', tipoLaborId: 't-1', fecha: '2026-10-05', cantidad: 2 },
      [],
    );

    expect(await laboresRepo.getLaborByUuid('l-01')).toMatchObject({
      cuartelId: 'c-2',
      errorMessage: null,
      intentosSync: 0,
      estadoSync: EstadoSync.PENDIENTE,
    });
  });
});
