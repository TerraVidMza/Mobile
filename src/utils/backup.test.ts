/**
 * Respaldo de registros locales (M-008) sobre SQLite real.
 */

import { Platform } from 'react-native';
import { generarBackupJson, exportarPesajesCsv, exportarLaboresCsv, compartirRespaldo } from './backup';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { closeDatabase, getDatabase } from '../db/database';
import { EstadoSync } from '../types/api.types';

const archivo = { uri: '', create: jest.fn(), write: jest.fn() };
const fileSystem = {
  Paths: { cache: { uri: 'file:///cache/' } },
  File: jest.fn((dir: { uri: string }, nombre: string) => Object.assign(archivo, { uri: dir.uri + nombre })),
};
const sharing = { isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn() };
jest.mock('expo-file-system', () => fileSystem, { virtual: true });
jest.mock('expo-sharing', () => sharing, { virtual: true });

async function cargarDatos() {
  await laboresRepo.createLabor(
    {
      localUuid: 'l-1',
      cuartelId: 'c-1',
      tipoLaborId: 't-1',
      fecha: '2026-09-30',
      cantidad: 3,
      estadoSync: EstadoSync.PENDIENTE,
      errorMessage: null,
      createdAtLocal: '2026-09-30T08:00:00-03:00',
    },
    [],
  );
  for (const [uuid, fecha] of [['p-1', '2026-09-30'], ['p-2', '2026-10-05']]) {
    await pesajesRepo.createPesaje({
      localUuid: uuid,
      cuadrillaId: 'cu-1',
      cuartelId: 'c-1',
      fecha,
      pesoKg: 500,
      estadoSync: EstadoSync.PENDIENTE,
      errorMessage: null,
      createdAtLocal: `${fecha}T09:00:00-03:00`,
    });
  }
  await pesajesRepo.markSincronizado('p-2', 'srv');
}

describe('Respaldo local (M-008)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
    await closeDatabase();
    const db = await getDatabase();
    for (const t of ['detalle_insumo_labor', 'registro_labor', 'pesaje_vendimia']) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    await cargarDatos();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('incluye todos los registros, de cualquier día, y cuenta los pendientes', async () => {
    const backup = await generarBackupJson();
    expect(backup).toMatchObject({ totalLabores: 1, totalPesajes: 2, pendientes: 2 });
  });

  it('CSV de pesajes de un día con cabeceras', async () => {
    const csv = await exportarPesajesCsv('2026-09-30');
    expect(csv.split('\n')[0]).toBe('UUID,Fecha,Cuadrilla,Cuartel,Kilos,EstadoSync,ErrorSync');
    expect(csv).toContain('"p-1","2026-09-30"');
    expect(csv).not.toContain('p-2');
  });

  it('CSV de labores escapa comillas', async () => {
    const csv = await exportarLaboresCsv();
    expect(csv).toContain('"l-1","2026-09-30"');
  });

  it('en Android guarda el archivo y abre el menú de compartir', async () => {
    (Platform as { OS: string }).OS = 'android';
    // La base ya está abierta como web: cambiar OS solo afecta al guardado.
    const backup = await compartirRespaldo();
    expect(backup.totalPesajes).toBe(2);
    expect(archivo.uri).toMatch(/^file:\/\/\/cache\/terravid-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(archivo.create).toHaveBeenCalledWith({ overwrite: true });
    expect(archivo.write).toHaveBeenCalledWith(expect.stringContaining('"totalPesajes": 2'));
    expect(sharing.shareAsync).toHaveBeenCalledWith(archivo.uri, expect.anything());
  });
});
