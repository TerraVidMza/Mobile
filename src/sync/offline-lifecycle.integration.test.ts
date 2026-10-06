/**
 * Prueba de Integración E2E del Ciclo Offline-First (HU-12, HU-13, HU-14, HU-24, HU-27).
 *
 * Simula:
 * 1. Trabajo en viñedo sin conexión: Guardado local en SQLite de 5 labores y 3 pesajes.
 * 2. Transición y persistencia en estado 'pendiente'.
 * 3. Recuperación de señal (evento NetInfo) y disparo reactivo de sincronización en lotes.
 * 4. Manejo de respuesta mixta del backend (éxitos 201 y conflicto 400).
 * 5. Lo rechazado queda 'pendiente' con el motivo y se programa un reintento (M-003).
 */

import { laboresRepo } from '../db/repositories/labores.repo';
import { pesajesRepo } from '../db/repositories/pesajes.repo';
import { catalogosRepo } from '../db/repositories/catalogos.repo';
import { syncEngine } from './sync-engine';
import { laborService } from '../services/labor.service';
import { pesajeService } from '../services/pesaje.service';
import { catalogosSyncService } from '../services/catalogos-sync.service';
import { closeDatabase } from '../db/database';
import { EstadoSync } from '../types/api.types';
import { useSyncStore } from '../stores/sync.store';

jest.mock('../services/labor.service');
jest.mock('../services/pesaje.service');
jest.mock('../services/catalogos-sync.service');

describe('Offline-First Lifecycle Integration Test (HU-14)', () => {
  beforeEach(async () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    await closeDatabase();
    jest.clearAllMocks();

    useSyncStore.setState({
      pendingCount: 0,
      isConnected: false,
      status: 'offline',
      lastSyncAt: null,
      lastError: null,
    });

    // Cargar catálogos maestros iniciales
    await catalogosRepo.saveFincas([{ id: 'f-1', nombre: 'Finca Tupungato', ubicacion: 'Valle de Uco', superficie: 100, activo: true }]);
    await catalogosRepo.saveCuarteles([{ id: 'c-1', fincaId: 'f-1', nombre: 'Cuartel Malbec 01', variedad: 'Malbec', superficie: 25, anioPlantacion: 2015, estado: 'activo', activo: true }]);
    await catalogosRepo.saveTiposLabor([{ id: 't-1', nombre: 'Poda de Invierno', unidadMedida: 'plantas', activo: true }]);
    await catalogosRepo.saveInsumos([{ id: 'i-1', nombre: 'Pasta Cicatrizante', unidadMedida: 'kg', activo: true }]);
    await catalogosRepo.saveCuadrillas([{ id: 'cu-1', fincaId: 'f-1', nombre: 'Cuadrilla Los Andes', activa: true }]);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('debe ejecutar el flujo completo de captura offline, reconexión y resolución de conflictos', async () => {
    // ─── PASO 1: Captura de labores y pesajes en viñedo (Sin Conexión) ─────────

    for (let i = 1; i <= 5; i++) {
      await laboresRepo.createLabor(
        {
          localUuid: `labor-offline-${i}`,
          cuartelId: 'c-1',
          tipoLaborId: 't-1',
          fecha: '2026-08-25',
          cantidad: 50 * i,
          estadoSync: EstadoSync.PENDIENTE,
          errorMessage: null,
          createdAtLocal: `2026-08-25T10:0${i}:00-03:00`,
        },
        [{ insumoId: 'i-1', cantidad: i }],
      );
    }

    for (let j = 1; j <= 3; j++) {
      await pesajesRepo.createPesaje({
        localUuid: `pesaje-offline-${j}`,
        cuadrillaId: 'cu-1',
        cuartelId: 'c-1',
        fecha: '2026-08-25',
        pesoKg: 1000 * j,
        estadoSync: EstadoSync.PENDIENTE,
        errorMessage: null,
        createdAtLocal: `2026-08-25T11:0${j}:00-03:00`,
      });
    }

    // Verificar conteo total de pendientes en DB local
    const pendientesLabores = await laboresRepo.countPendientes();
    const pendientesPesajes = await pesajesRepo.countPendientes();
    expect(pendientesLabores).toBe(5);
    expect(pendientesPesajes).toBe(3);

    const totalPendientes = await syncEngine.updatePendingCount();
    expect(totalPendientes).toBe(8);
    expect(useSyncStore.getState().pendingCount).toBe(8);

    // ─── PASO 2: Simulación de reconexión y respuesta mixta del Backend ────────

    // Mock de sincronización: 4 labores exitosas y 1 con conflicto de validación (400)
    (laborService.sincronizarLote as jest.Mock).mockResolvedValueOnce([
      { localUuid: 'labor-offline-1', estado: 'sincronizado', registroId: 'srv-l1' },
      { localUuid: 'labor-offline-2', estado: 'sincronizado', registroId: 'srv-l2' },
      { localUuid: 'labor-offline-3', estado: 'sincronizado', registroId: 'srv-l3' },
      { localUuid: 'labor-offline-4', estado: 'sincronizado', registroId: 'srv-l4' },
      { localUuid: 'labor-offline-5', estado: 'error', errorMessage: 'Insumo sin stock disponible' },
    ]);

    // Mock de sincronización de pesajes: 3 exitosos
    (pesajeService.sincronizarLote as jest.Mock).mockResolvedValueOnce([
      { localUuid: 'pesaje-offline-1', estado: 'sincronizado', pesajeId: 'srv-p1' },
      { localUuid: 'pesaje-offline-2', estado: 'sincronizado', pesajeId: 'srv-p2' },
      { localUuid: 'pesaje-offline-3', estado: 'sincronizado', pesajeId: 'srv-p3' },
    ]);

    (catalogosSyncService.syncAll as jest.Mock).mockResolvedValue({ success: true });

    // ─── PASO 3: Ejecución de la sincronización ────────────────────────────────

    useSyncStore.getState().setConnected(true);
    const syncResult = await syncEngine.runSync();

    expect(syncResult.totalSynced).toBe(7); // 4 labores + 3 pesajes
    expect(syncResult.errors).toBe(1);      // 1 labor rechazada

    // ─── PASO 4: Verificación del estado en la base de datos local SQLite ───────

    // Las 4 labores exitosas deben estar 'sincronizado'
    const labor1 = await laboresRepo.getLaborByUuid('labor-offline-1');
    expect(labor1?.estadoSync).toBe(EstadoSync.SINCRONIZADO);
    expect(labor1?.serverId).toBe('srv-l1');

    // La 5ta labor sigue pendiente con el motivo del rechazo (M-003)
    const labor5 = await laboresRepo.getLaborByUuid('labor-offline-5');
    expect(labor5?.estadoSync).toBe(EstadoSync.PENDIENTE);
    expect(labor5?.errorMessage).toBe('Insumo sin stock disponible');
    expect(labor5?.intentosSync).toBe(1);

    // Todos los pesajes deben estar 'sincronizado'
    const pesaje1 = await pesajesRepo.getPesajeByUuid('pesaje-offline-1');
    expect(pesaje1?.estadoSync).toBe(EstadoSync.SINCRONIZADO);
    expect(pesaje1?.serverId).toBe('srv-p1');

    // Queda 1 pendiente (la rechazada) y un reintento automático programado
    const pendientesFinal = await syncEngine.updatePendingCount();
    expect(pendientesFinal).toBe(1);
    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().proximoReintentoAt).not.toBeNull();

    syncEngine.cancelarReintento();
  });
});
