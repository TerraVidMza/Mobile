/**
 * Avance de cosecha con caché offline (M-010), sobre SQLite real.
 */

import { avanceService } from './avance.service';
import api from './api';
import { closeDatabase, getDatabase } from '../db/database';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { EstadoSync } from '../types/api.types';

jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const avance = {
  campania: { id: 'c', nombre: '2026', fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' },
  metaKg: 1000,
  kgCosechados: 200,
  cuarteles: [],
};

describe('avanceService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await closeDatabase();
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM sync_meta WHERE key = 'avance_cosecha'`);
    await db.runAsync(`DELETE FROM pesaje_vendimia`);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('con señal devuelve el del servidor y lo guarda', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: avance });
    const r = await avanceService.obtener();
    expect(r.avance).toEqual(avance);
    expect(api.get).toHaveBeenCalledWith('/campanias/actual/avance');
  });

  it('sin señal devuelve el último guardado', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: avance });
    await avanceService.obtener();
    (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    const r = await avanceService.obtener();

    expect(r.avance).toEqual(avance);
    expect(r.actualizadoAt).not.toBeNull();
  });

  it('sin señal y sin nada guardado devuelve null', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    expect(await avanceService.obtener()).toEqual({ avance: null, actualizadoAt: null });
  });

  it('suma solo los kilos pendientes de sincronizar', async () => {
    for (const [uuid, kg] of [['a', 100], ['b', 250]] as const) {
      await pesajesRepo.createPesaje({
        localUuid: uuid,
        cuadrillaId: 'cu',
        cuartelId: 'c',
        fecha: '2026-10-05',
        pesoKg: kg,
        estadoSync: EstadoSync.PENDIENTE,
        errorMessage: null,
        createdAtLocal: '2026-10-05T09:00:00-03:00',
      });
    }
    await pesajesRepo.markSincronizado('a', 'srv');
    expect(await avanceService.kilosPendientes()).toBe(250);
  });
});
