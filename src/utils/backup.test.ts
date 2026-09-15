/**
 * Pruebas unitarias para la utilidad de Respaldo y Exportación CSV/JSON.
 */

import { generarBackupJson, exportarPesajesCsv, exportarLaboresCsv } from './backup';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';

jest.mock('../db/repositories/labores.repo');
jest.mock('../db/repositories/pesajes.repo');

describe('Local Database Backup & CSV Export Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe generar backup completo en formato JSON con labores y pesajes', async () => {
    (laboresRepo.getLaboresFiltered as jest.Mock).mockResolvedValue([
      { localUuid: 'l-1', fecha: '2026-08-25', fincaId: 'f-1', estadoSync: 'sincronizado' },
    ]);
    (pesajesRepo.getPesajesByFecha as jest.Mock).mockResolvedValue([
      { localUuid: 'p-1', fecha: '2026-08-25', pesoKg: 500, estadoSync: 'pendiente' },
    ]);

    const backup = await generarBackupJson('2026-08-25');
    expect(backup.version).toBe('1.0.0');
    expect(backup.totalLabores).toBe(1);
    expect(backup.totalPesajes).toBe(1);
    expect(backup.labores[0].localUuid).toBe('l-1');
    expect(backup.pesajes[0].pesoKg).toBe(500);
  });

  it('debe generar archivo CSV de pesajes con cabeceras correctas', async () => {
    (pesajesRepo.getPesajesByFecha as jest.Mock).mockResolvedValue([
      {
        localUuid: 'p-1',
        fecha: '2026-08-25',
        cuadrillaId: 'c-1',
        cuadrillaNombre: 'Cuadrilla Los Andes',
        cuartelId: 'cu-1',
        cuartelNombre: 'Cuartel 01',
        pesoKg: 1250,
        estadoSync: 'pendiente',
        errorMessage: null,
      },
    ]);

    const csv = await exportarPesajesCsv('2026-08-25');
    expect(csv).toContain('UUID,Fecha,Cuadrilla,Cuartel,Kilos,EstadoSync,ErrorSync');
    expect(csv).toContain('"p-1","2026-08-25","Cuadrilla Los Andes","Cuartel 01","1250","pendiente",""');
  });

  it('debe generar archivo CSV de labores con cabeceras correctas', async () => {
    (laboresRepo.getLaboresFiltered as jest.Mock).mockResolvedValue([
      {
        localUuid: 'l-1',
        fecha: '2026-08-25',
        fincaNombre: 'Finca Tupungato',
        cuartelNombre: 'Cuartel 01',
        tipoLaborNombre: 'Poda de Invierno',
        cantidad: 150,
        estadoSync: 'sincronizado',
        errorMessage: null,
      },
    ]);

    const csv = await exportarLaboresCsv('2026-08-25');
    expect(csv).toContain('UUID,Fecha,Finca,Cuartel,Labor,Cantidad,EstadoSync,ErrorSync');
    expect(csv).toContain('"l-1","2026-08-25","Finca Tupungato","Cuartel 01","Poda de Invierno","150","sincronizado",""');
  });
});
