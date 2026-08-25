/**
 * Store de estado de sincronización — Zustand.
 *
 * Trackea el conteo de pendientes, el estado de la sincronización en curso,
 * y el progreso ("Sincronizando X de N").
 */

import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  /** Estado actual del motor de sincronización. */
  status: SyncStatus;
  /** Cantidad de registros pendientes de sincronización (labores + pesajes). */
  pendingCount: number;
  /** Progreso actual: "Sincronizando X de N". */
  currentIndex: number;
  totalToSync: number;
  /** True si el dispositivo tiene conectividad. */
  isConnected: boolean;
  /** Último error ocurrido durante la sincronización. */
  lastError: string | null;
  /** Timestamp de la última sincronización exitosa. */
  lastSyncAt: string | null;

  // ─── Actions ──────────────────────────────────────────────────────────────

  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  setProgress: (current: number, total: number) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  markSyncComplete: () => void;
  incrementPending: (by?: number) => void;
  decrementPending: (by?: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  currentIndex: 0,
  totalToSync: 0,
  isConnected: true,
  lastError: null,
  lastSyncAt: null,

  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setProgress: (current, total) => set({ currentIndex: current, totalToSync: total }),
  setConnected: (connected) =>
    set({ isConnected: connected, status: connected ? 'idle' : 'offline' }),
  setError: (error) => set({ lastError: error }),

  markSyncComplete: () =>
    set({
      status: 'idle',
      currentIndex: 0,
      totalToSync: 0,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    }),

  incrementPending: (by = 1) =>
    set((state) => ({ pendingCount: state.pendingCount + by })),
  decrementPending: (by = 1) =>
    set((state) => ({ pendingCount: Math.max(0, state.pendingCount - by) })),
}));
