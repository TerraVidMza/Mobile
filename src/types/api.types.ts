// ─── Roles ────────────────────────────────────────────────────────────────────
// Espejo del enum RolNombre del backend (src/common/enums/rol.enum.ts).

export enum RolNombre {
  PROPIETARIO = 'Propietario',
  CAPATAZ = 'Capataz',
  AGRONOMO = 'Agronomo',
  AUDITOR = 'Auditor',
}

// ─── Estado de sincronización ─────────────────────────────────────────────────

/**
 * Espejo del enum EstadoSync del backend.
 *
 * Localmente un registro solo está `pendiente` o `sincronizado`: un intento
 * fallido lo deja pendiente con el mensaje del error (M-003). `error` solo
 * llega en las respuestas del backend.
 */
export enum EstadoSync {
  PENDIENTE = 'pendiente',
  SINCRONIZADO = 'sincronizado',
  ERROR = 'error',
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  rol: RolNombre;
  empresaId: string;
  debeCambiarPassword: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

export interface Finca {
  id: string;
  nombre: string;
  ubicacion: string | null;
  superficie: number | null;
  activo: boolean;
}

export interface Cuartel {
  id: string;
  fincaId: string;
  nombre: string;
  variedad: string | null;
  superficie: number | null;
  anioPlantacion: number | null;
  estado: string | null;
  activo: boolean;
}

export interface TipoLabor {
  id: string;
  nombre: string;
  unidadMedida: string | null;
  activo: boolean;
}

export interface Insumo {
  id: string;
  nombre: string;
  unidadMedida: string | null;
  activo: boolean;
}

export interface Cuadrilla {
  id: string;
  fincaId: string;
  nombre: string;
  activa: boolean;
}

// ─── Registro de labor (HU-12, HU-13, HU-14) ─────────────────────────────────

export interface DetalleInsumoDto {
  insumoId: string;
  cantidad: number;
}

/** Espejo de CreateRegistroLaborDto del backend. */
export interface CreateRegistroLaborDto {
  localUuid: string;
  cuartelId: string;
  tipoLaborId: string;
  fecha: string;           // ISO date, día local (D-009)
  cantidad: number;        // > 0
  insumos: DetalleInsumoDto[];
  createdAtLocal?: string; // ISO 8601 con timezone
}

/** Espejo de SyncRegistroLaborDto del backend. */
export interface SyncRegistroLaborDto {
  registros: CreateRegistroLaborDto[];
}

// ─── Pesaje de vendimia (HU-24) ───────────────────────────────────────────────

export interface CreatePesajeDto {
  localUuid: string;
  cuadrillaId: string;
  cuartelId: string;
  fecha: string;
  kgTotales: number;       // > 0 (localmente se guarda como peso_kg)
  createdAtLocal?: string;
}

export interface SyncPesajeDto {
  pesajes: CreatePesajeDto[];
}

// ─── Notificaciones (HU-35) ──────────────────────────────────────────────────

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  urlAccion: string | null;
  leida: boolean;
  createdAt: string;
}

export interface NotificacionesResponse {
  data: Notificacion[];
  total: number;
  noLeidas: number;
}

export interface RegistrarDeviceTokenDto {
  token: string;
  plataforma: 'android' | 'ios';
}

// ─── Resultado de sincronización ──────────────────────────────────────────────

/**
 * Resultado por registro de `POST /registro-labor/sync` y `/pesajes-vendimia/sync`
 * (y del POST individual). Espejo de SyncResultItem / SyncPesajeResultItem del
 * backend.
 */
export interface SyncResultItem {
  localUuid: string;
  estado: EstadoSync;
  /** Id en el servidor de una labor. */
  registroId?: string;
  /** Id en el servidor de un pesaje. */
  pesajeId?: string;
  errorMessage?: string;
  /** true cuando ya estaba sincronizado (reintento idempotente). */
  yaExistia?: boolean;
  /** Se guardó, pero usa un ítem de catálogo dado de baja (HU-14). */
  inconsistenciaCatalogo?: boolean;
}

// ─── Registro local en SQLite ─────────────────────────────────────────────────

export interface RegistroLaborLocal {
  localUuid: string;
  cuartelId: string;
  tipoLaborId: string;
  fecha: string;
  cantidad: number;
  estadoSync: EstadoSync;
  /** Mensaje del último intento fallido; null si nunca falló. */
  errorMessage: string | null;
  createdAtLocal: string;
  createdAt: string;
  serverId: string | null;
  /** Intentos de sincronización fallidos (M-003). */
  intentosSync: number;
}

export interface DetalleInsumoLocal {
  id?: number;
  laborLocalUuid: string;
  insumoId: string;
  cantidad: number;
}

export interface PesajeVendimiaLocal {
  localUuid: string;
  cuadrillaId: string;
  cuartelId: string;
  fecha: string;
  pesoKg: number;
  estadoSync: EstadoSync;
  /** Mensaje del último intento fallido; null si nunca falló. */
  errorMessage: string | null;
  createdAtLocal: string;
  createdAt: string;
  serverId: string | null;
  /** Intentos de sincronización fallidos (M-003). */
  intentosSync: number;
}
