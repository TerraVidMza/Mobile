/**
 * Esquema SQLite local — TerraVid Mobile.
 *
 * Espeja los catálogos del backend para funcionamiento offline-first
 * y almacena los registros creados en campo pendientes de sincronización.
 */

/** Versión actual del esquema. Incrementar al agregar migraciones. */
export const SCHEMA_VERSION = 1;

/** Sentencias DDL para crear todas las tablas del esquema local. */
export const CREATE_TABLES = [
  // ─── Catálogos (descargados desde el backend al login) ────────────────────

  `CREATE TABLE IF NOT EXISTS fincas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    ubicacion TEXT,
    superficie REAL,
    activo INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS cuarteles (
    id TEXT PRIMARY KEY,
    finca_id TEXT NOT NULL REFERENCES fincas(id),
    nombre TEXT NOT NULL,
    variedad TEXT,
    superficie REAL,
    anio_plantacion INTEGER,
    estado TEXT,
    activo INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS tipos_labor (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad_medida TEXT,
    activo INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS insumos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad_medida TEXT,
    activo INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS cuadrillas (
    id TEXT PRIMARY KEY,
    finca_id TEXT NOT NULL REFERENCES fincas(id),
    nombre TEXT NOT NULL,
    activa INTEGER NOT NULL DEFAULT 1
  )`,

  // ─── Registros offline (creados en campo, sincronizados al backend) ───────

  `CREATE TABLE IF NOT EXISTS registro_labor (
    local_uuid TEXT PRIMARY KEY,
    cuartel_id TEXT NOT NULL,
    tipo_labor_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    cantidad REAL NOT NULL CHECK(cantidad > 0),
    estado_sync TEXT NOT NULL DEFAULT 'pendiente',
    error_message TEXT,
    created_at_local TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    server_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS detalle_insumo_labor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    labor_local_uuid TEXT NOT NULL REFERENCES registro_labor(local_uuid) ON DELETE CASCADE,
    insumo_id TEXT NOT NULL,
    cantidad REAL NOT NULL CHECK(cantidad > 0),
    UNIQUE(labor_local_uuid, insumo_id)
  )`,

  `CREATE TABLE IF NOT EXISTS pesaje_vendimia (
    local_uuid TEXT PRIMARY KEY,
    cuadrilla_id TEXT NOT NULL,
    cuartel_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    peso_kg REAL NOT NULL CHECK(peso_kg > 0),
    estado_sync TEXT NOT NULL DEFAULT 'pendiente',
    error_message TEXT,
    created_at_local TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    server_id TEXT
  )`,

  // ─── Metadata de sincronización ───────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,

  // ─── Índices para consultas frecuentes ────────────────────────────────────

  `CREATE INDEX IF NOT EXISTS idx_labor_estado_sync
    ON registro_labor(estado_sync)`,

  `CREATE INDEX IF NOT EXISTS idx_labor_fecha
    ON registro_labor(fecha)`,

  `CREATE INDEX IF NOT EXISTS idx_pesaje_estado_sync
    ON pesaje_vendimia(estado_sync)`,

  `CREATE INDEX IF NOT EXISTS idx_cuarteles_finca
    ON cuarteles(finca_id)`,

  `CREATE INDEX IF NOT EXISTS idx_cuadrillas_finca
    ON cuadrillas(finca_id)`,
];
