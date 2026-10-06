/**
 * Respaldo de los registros del teléfono — M-008.
 *
 * Para cuando un capataz necesita sacar sus datos del teléfono sin sincronizar
 * (el teléfono se rompe, se cambia, o el backend está caído el día de la
 * cosecha). Exporta **todos** los registros locales, sincronizados o no, en un
 * archivo que el capataz comparte (WhatsApp, mail, Drive) o descarga en la PWA.
 *
 * Antes generaba el JSON en memoria y no lo guardaba en ningún lado, y tomaba
 * el día con `toISOString()` (UTC), lo que después de las 21 h en Mendoza ya es
 * el día siguiente (D-009).
 */

import { Platform } from 'react-native';
import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { getDatabase } from '../db/database';
import { hoyLocal } from './fecha-local';

export interface BackupData {
  version: string;
  fechaExportacion: string;
  totalLabores: number;
  totalPesajes: number;
  pendientes: number;
  labores: unknown[];
  pesajes: unknown[];
}

async function todosLosPesajes() {
  const db = await getDatabase();
  const fechas = await db.getAllAsync<{ fecha: string }>(
    `SELECT DISTINCT fecha FROM pesaje_vendimia ORDER BY fecha`,
  );
  const porFecha = await Promise.all(fechas.map((f) => pesajesRepo.getPesajesByFecha(f.fecha)));
  return porFecha.flat();
}

export async function generarBackupJson(): Promise<BackupData> {
  const [labores, pesajes] = await Promise.all([
    laboresRepo.getLaboresFiltered(),
    todosLosPesajes(),
  ]);
  const pendientes =
    labores.filter((l) => l.estadoSync !== 'sincronizado').length +
    pesajes.filter((p) => p.estadoSync !== 'sincronizado').length;

  return {
    version: '2.0.0',
    fechaExportacion: new Date().toISOString(),
    totalLabores: labores.length,
    totalPesajes: pesajes.length,
    pendientes,
    labores,
    pesajes,
  };
}

function aCsv(encabezados: string[], filas: unknown[][]): string {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [encabezados.join(','), ...filas.map((f) => f.map(celda).join(','))].join('\n');
}

export async function exportarPesajesCsv(fecha?: string): Promise<string> {
  const pesajes = fecha ? await pesajesRepo.getPesajesByFecha(fecha) : await todosLosPesajes();
  return aCsv(
    ['UUID', 'Fecha', 'Cuadrilla', 'Cuartel', 'Kilos', 'EstadoSync', 'ErrorSync'],
    pesajes.map((p) => [
      p.localUuid,
      p.fecha,
      p.cuadrillaNombre ?? p.cuadrillaId,
      p.cuartelNombre ?? p.cuartelId,
      p.pesoKg,
      p.estadoSync,
      p.errorMessage ?? '',
    ]),
  );
}

export async function exportarLaboresCsv(fecha?: string): Promise<string> {
  const labores = await laboresRepo.getLaboresFiltered(fecha ? { fecha } : undefined);
  return aCsv(
    ['UUID', 'Fecha', 'Finca', 'Cuartel', 'Labor', 'Cantidad', 'EstadoSync', 'ErrorSync'],
    labores.map((l) => [
      l.localUuid,
      l.fecha,
      l.fincaNombre ?? '',
      l.cuartelNombre ?? '',
      l.tipoLaborNombre ?? '',
      l.cantidad,
      l.estadoSync,
      l.errorMessage ?? '',
    ]),
  );
}

/**
 * Guarda el respaldo en un archivo y abre el menú de compartir (Android/iOS) o
 * lo descarga (PWA). Devuelve el resumen para mostrarlo.
 */
export async function compartirRespaldo(): Promise<BackupData> {
  const backup = await generarBackupJson();
  const nombre = `terravid-respaldo-${hoyLocal()}.json`;
  const contenido = JSON.stringify(backup, null, 2);

  if (Platform.OS === 'web') {
    // Los tipos de React Native y los del DOM no coinciden en las opciones
    // del Blob; en el navegador alcanza con `type`.
    const opciones = { type: 'application/json' } as ConstructorParameters<typeof Blob>[1];
    const url = URL.createObjectURL(new Blob([contenido], opciones));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    return backup;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const ruta = `${FileSystem.cacheDirectory}${nombre}`;
  await FileSystem.writeAsStringAsync(ruta, contenido);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(ruta, { mimeType: 'application/json', dialogTitle: 'Respaldo de TerraVid' });
  }
  return backup;
}
