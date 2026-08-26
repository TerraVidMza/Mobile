/**
 * Utilidad de Respaldo y Exportación Local de Emergencia — TerraVid Mobile.
 * Permite a los capataces exportar sus registros a JSON y CSV en campo.
 */

import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';

export interface BackupData {
  version: string;
  fechaExportacion: string;
  totalLabores: number;
  totalPesajes: number;
  labores: any[];
  pesajes: any[];
}

export async function generarBackupJson(fecha?: string): Promise<BackupData> {
  const hoy = fecha ?? new Date().toISOString().split('T')[0];
  const [labores, pesajes] = await Promise.all([
    laboresRepo.getLaboresFiltered(fecha ? { fecha } : undefined),
    pesajesRepo.getPesajesByFecha(hoy),
  ]);

  return {
    version: '1.0.0',
    fechaExportacion: new Date().toISOString(),
    totalLabores: labores.length,
    totalPesajes: pesajes.length,
    labores,
    pesajes,
  };
}

export async function exportarPesajesCsv(fecha?: string): Promise<string> {
  const hoy = fecha ?? new Date().toISOString().split('T')[0];
  const pesajes = await pesajesRepo.getPesajesByFecha(hoy);
  const headers = ['UUID', 'Fecha', 'Cuadrilla', 'Cuartel', 'Kilos', 'EstadoSync', 'ErrorSync'];
  const rows = pesajes.map((p) => [
    p.localUuid,
    p.fecha,
    p.cuadrillaNombre ?? p.cuadrillaId,
    p.cuartelNombre ?? p.cuartelId,
    p.pesoKg,
    p.estadoSync,
    p.errorMessage ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export async function exportarLaboresCsv(fecha?: string): Promise<string> {
  const labores = await laboresRepo.getLaboresFiltered(fecha ? { fecha } : undefined);
  const headers = ['UUID', 'Fecha', 'Finca', 'Cuartel', 'Labor', 'Cantidad', 'EstadoSync', 'ErrorSync'];
  const rows = labores.map((l) => [
    l.localUuid,
    l.fecha,
    l.fincaNombre ?? '',
    l.cuartelNombre ?? '',
    l.tipoLaborNombre ?? '',
    l.cantidad,
    l.estadoSync,
    l.errorMessage ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}
