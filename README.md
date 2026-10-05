# TerraVid — Mobile

App móvil offline-first para uso en campo del ERP agrícola TerraVid: registro de labores, utilización de insumos y pesaje de vendimia por el Capataz, diseñada para operar sin conexión en el viñedo y sincronizar automáticamente al recuperar señal.

---

## Repositorios del proyecto

| Repo | Contenido |
|---|---|
| [`Backend`](https://github.com/TerraVidMza/Backend) | API REST — NestJS + TypeORM + PostgreSQL/PostGIS |
| [`Web`](https://github.com/TerraVidMza/Web) | Frontend web de oficina (Propietario / Agrónomo) |
| [`Mobile`](https://github.com/TerraVidMza/Mobile) (este repo) | App móvil offline-first para campo (Capataz) |
| [`IoTSensor`](https://github.com/TerraVidMza/IoTSensor) | Firmware de los nodos de telemetría (ESP32) |

---

## Stack Tecnológico

- **React Native 0.86+ / Expo SDK 57+**
- **Expo Router**: Navegación file-based con grupos `(auth)` y `(tabs)`
- **SQLite (`expo-sqlite`)**: Persistencia local offline-first
- **Zustand**: Gestión de estado global (auth, sync, catálogos)
- **Axios**: Cliente HTTP con interceptors que inyectan el JWT y lo renuevan con el refresh token (M-004)
- **NetInfo (`@react-native-community/netinfo`)**: Detección reactiva de reconexión (≤5s)
- **Expo Notifications + FCM**: Notificaciones push
- **React Native Paper**: Sistema de diseño con modo claro/oscuro y alto contraste solar

---

## Historias de Usuario Implementadas

| HU | Funcionalidad | Pantalla / Módulo | Estado |
|---|---|---|---|
| **HU-01** | Iniciar sesión (JWT + refresh token, M-004; acceso por permiso `appMovil`, M-005) | `(auth)/login` | Completa |
| **HU-02** | Cerrar sesión (revocación de token) | `(tabs)/index` (Logout) | Completa |
| **HU-03** | Recuperar contraseña | `(auth)/forgot-password`, `(auth)/reset-password` | Completa |
| **HU-04** | Cambiar contraseña | `cambiar-password` | Completa |
| **HU-12** | Registrar labor realizada en campo | `(tabs)/labores/nueva` | Completa |
| **HU-13** | Registrar utilización de insumos | `InsumoSelector` en labores | Completa |
| **HU-14** | Sincronización offline-first | `SyncEngine` + `SyncStatusBar` | Completa |
| **HU-17** | Historial de labores del día | `(tabs)/labores` | Completa |
| **HU-24** | Registro de pesaje diario de vendimia | `(tabs)/pesaje/nuevo`, `(tabs)/pesaje` | Completa |
| **HU-35** | Notificaciones in-app y push FCM | `(tabs)/notificaciones`, `useNotificaciones` | Completa |

### Funcionalidades de campo (mobile-v2)

| Funcionalidad | Dónde | Decisión |
|---|---|---|
| Desbloqueo con huella (Android) o con el autenticador del sistema (PWA, WebAuthn) | Inicio → Ajustes, `PantallaBloqueo` | M-007 |
| Modo solar (alto contraste) | Inicio → Ajustes | M-008 |
| Respaldo de todos los registros a un archivo (compartir / descargar) | Inicio → Ajustes | M-008 |
| Ubicación GPS opcional en labores y pesajes | Al guardar | M-009 |
| Avance de la cosecha contra la meta de la campaña | Inicio → Resumen del día | M-010 |
| PWA instalable que abre sin señal | `public/manifest.json`, `public/sw.js` | M-011 |

---

## Arquitectura y Protocolo Offline-First

1. **Idempotencia con `local_uuid`**: Cada registro de labor o pesaje genera un UUID v4 en el dispositivo antes de guardarse en SQLite. Al sincronizar con el Backend, un registro repetido devuelve `200 OK` sin duplicar filas.
2. **Lotes de 10 registros**: Según HU-14, la sincronización se realiza en lotes de máximo 10 registros por request (`POST /api/registro-labor/sync` y `POST /api/pesajes-vendimia/sync`), ordenados por `createdAtLocal` ascendente.
3. **Cuándo se sincroniza**: al recuperar conexión (≤5s), al abrir la app con conexión, al iniciar sesión, al guardar un registro nuevo y con el botón "sincronizar" o el pull-to-refresh.
4. **Reintento automático (M-003)**: un registro que no sube **sigue pendiente**, con el motivo y la cantidad de intentos. El motor reintenta a los 30s, 60s y 120s (jitter ±10%); después espera al próximo disparador. Si el backend rechaza el lote entero, se envían de a uno para que un registro con problemas no frene al resto.
5. **Contrato con el backend**: los tipos de `src/types/api.types.ts` espejan los DTO del backend. El pesaje se guarda localmente como `peso_kg` y viaja como `kgTotales`; el resultado de `/sync` trae `estado`, `registroId`/`pesajeId` y `errorMessage`.
6. **Base local**: SQLite nativo en Android/iOS y SQLite compilado a WebAssembly (sql.js, persistido en IndexedDB) en la PWA (M-001). El esquema evoluciona con migraciones versionadas (M-002).
7. **Fechas locales (D-009)**: Se utiliza el día local de la finca (`YYYY-MM-DD`), sin conversiones UTC intermedias.

Las decisiones de diseño propias de Mobile están en [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Estructura del Código

```
src/
├── app/                          # Rutas Expo Router
│   ├── _layout.tsx               # Root layout con AuthGate y Theme
│   ├── (auth)/                   # Rutas públicas (login, forgot, reset)
│   ├── (tabs)/                   # Rutas protegidas (inicio, labores, pesaje, avisos)
│   ├── cambiar-password.tsx      # Cambio de contraseña obligatorio
│   └── +not-found.tsx            # Fallback 404
├── components/
│   ├── forms/InsumoSelector.tsx  # Selector multi-insumo (HU-13)
│   └── sync/                     # SyncStatusBar y OfflineBanner
├── config/env.ts                 # Variables de entorno y constantes de sync
├── db/
│   ├── database.ts               # Apertura: expo-sqlite (nativo) o sql.js (web) — M-001
│   ├── schema.ts                 # DDL base (versión 1) de catálogos y registros offline
│   ├── migrations.ts             # Migraciones versionadas del esquema — M-002
│   ├── web-database.ts           # Adaptador sql.js + IndexedDB para la PWA
│   └── repositories/             # CRUD tipado (labores, pesajes, catálogos)
├── hooks/useNotificaciones.ts    # Registro de tokens FCM
├── services/                     # Clientes API tipados (auth, labores, pesajes, catálogos, notificaciones)
├── stores/                       # Zustand stores (auth, sync, catálogos)
├── sync/                         # Motor de sincronización (engine, lotes, monitor, reintentos)
├── types/api.types.ts            # DTOs y tipos espejo del Backend
└── utils/                        # fecha-local (D-009), validadores Zod
```

---

## Puesta en Marcha

### Prerrequisitos
- Node.js v20+ / v24+
- npm v10+

### Instalación
```bash
npm install
```

### Configurar variables de entorno
```bash
cp .env.example .env
```
Editar `.env` indicando la URL del Backend:
- En emulador Android: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api`
- En simulador iOS: `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api`
- En dispositivo físico / staging: `EXPO_PUBLIC_API_BASE_URL=https://staging.terravid.com/api`

### Ejecución
```bash
# Iniciar servidor Metro
npm start

# Ejecutar en Android
npm run android

# Ejecutar en iOS
npm run ios

# Ejecutar en Web
npm run web
```

---

## Pruebas y Cobertura

La aplicación cuenta con una suite integral de 30 test suites y 125 pruebas automatizadas (unitarias, integración, rendimiento, accesibilidad A11y, PWA, georreferenciación GPS, biometría, respaldo local y componentes UI).

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar con reporte de cobertura
npm test -- --coverage

# Ejecutar smoke test de producción web
npm run test:smoke
```

Para más detalles sobre la arquitectura de testing, consultar [`TESTING.md`](TESTING.md).

---

## Despliegue y CI/CD

El pipeline de CI/CD en GitHub Actions valida tipos, ejecuta todas las pruebas y genera artefactos de producción web. Para consultar el plan detallado para Android, iOS y Web, ver [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Contribuir

Consultar [`CONTRIBUTING.md`](CONTRIBUTING.md) para la política de branching (Gitflow) y convenciones de código.
