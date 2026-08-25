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
- **Axios**: Cliente HTTP con interceptors para inyección de JWT y manejo 401
- **NetInfo (`@react-native-community/netinfo`)**: Detección reactiva de reconexión (≤5s)
- **Expo Notifications + FCM**: Notificaciones push
- **React Native Paper**: Sistema de diseño con modo claro/oscuro y alto contraste solar

---

## Historias de Usuario Implementadas

| HU | Funcionalidad | Pantalla / Módulo | Estado |
|---|---|---|---|
| **HU-01** | Iniciar sesión (JWT, rate limiting) | `(auth)/login` | Completa |
| **HU-02** | Cerrar sesión (revocación de token) | `(tabs)/index` (Logout) | Completa |
| **HU-03** | Recuperar contraseña | `(auth)/forgot-password`, `(auth)/reset-password` | Completa |
| **HU-04** | Cambiar contraseña | `cambiar-password` | Completa |
| **HU-12** | Registrar labor realizada en campo | `(tabs)/labores/nueva` | Completa |
| **HU-13** | Registrar utilización de insumos | `InsumoSelector` en labores | Completa |
| **HU-14** | Sincronización offline-first | `SyncEngine` + `SyncStatusBar` | Completa |
| **HU-17** | Historial de labores del día | `(tabs)/labores` | Completa |
| **HU-24** | Registro de pesaje diario de vendimia | `(tabs)/pesaje/nuevo`, `(tabs)/pesaje` | Completa |
| **HU-35** | Notificaciones in-app y push FCM | `(tabs)/notificaciones`, `useNotificaciones` | Completa |

---

## Arquitectura y Protocolo Offline-First

1. **Idempotencia con `local_uuid`**: Cada registro de labor o pesaje genera un UUID v4 en el dispositivo antes de guardarse en SQLite. Al sincronizar con el Backend, un registro repetido devuelve `200 OK` sin duplicar filas.
2. **Lotes de 10 registros**: Según HU-14, la sincronización se realiza en lotes de máximo 10 registros por request (`POST /api/registro-labor/sync` y `POST /api/pesajes-vendimia/sync`), ordenados por `createdAtLocal` ascendente.
3. **Reconexión en ≤5s**: El listener de NetInfo detecta la disponibilidad de internet y dispara automáticamente la sincronización en segundo plano.
4. **Backoff exponencial**: En caso de fallo de red, reintentos a los 30s, 60s y 120s con jitter de ±10%.
5. **Fechas locales (D-009)**: Se utiliza el día local de la finca (`YYYY-MM-DD`), sin conversiones UTC intermedias.

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
│   ├── database.ts               # Singleton SQLite con WAL mode y FKs
│   ├── schema.ts                 # DDL de catálogos y registros offline
│   └── repositories/             # CRUD tipado (labores, pesajes, catálogos)
├── hooks/useNotificaciones.ts    # Registro de tokens FCM
├── services/                     # Clientes API tipados (auth, labores, pesajes, catálogos, notificaciones)
├── stores/                       # Zustand stores (auth, sync, catálogos)
├── sync/                         # Motor de sincronización (engine, batches, monitor, retry)
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

La aplicación cuenta con una suite integral de 24 test suites y 104 pruebas automatizadas (unitarias, integración, rendimiento, accesibilidad A11y y componentes UI).

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
