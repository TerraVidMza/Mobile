# Pruebas — TerraVid Mobile

## Resumen

| | |
|---|---|
| Suites de Jest | 33 |
| Tests | 180 |
| Cobertura de líneas | 87 % (de `src/` sin `src/app/`, ver "Qué no cubre") |
| Comando | `npm test` (con cobertura: `npm test -- --coverage`) |

Los números de este documento son los de `docs/testing` (2026-10-06). Si
cambian, lo que manda es la salida de `npm test`.

## Cómo corren

- **Jest + ts-jest** en entorno Node, con `react-native` mapeado a
  `react-native-web` (`jest.config.js`). Por eso `Platform.OS` vale `'web'` en
  los tests.
- **La base local es SQLite real.** En web (y por lo tanto en Jest) la app usa
  sql.js, SQLite compilado a WebAssembly (M-001). Los tests de repositorios, de
  sincronización y de migraciones ejecutan SQL de verdad, no un simulacro. Antes
  probaban un emulador de SQL hecho con expresiones regulares.
- Los servicios HTTP se simulan con `jest.mock` y **con la forma exacta de las
  respuestas del backend**. Los mocks anteriores repetían un contrato
  equivocado y por eso no detectaron que los pesajes nunca llegaban al servidor
  (M-003).

## Qué cubre cada carpeta

| Carpeta | Qué se prueba |
|---|---|
| `src/db/` | Apertura en web y nativo, migraciones versionadas (M-002), transacciones, importación del emulador anterior, repositorios y un benchmark de 500 labores / 1000 pesajes |
| `src/sync/` | Envío por lotes con reintento (M-003): rechazos parciales, cortes de red, rechazo del lote entero con envío de a uno, backoff 30/60/120 s, disparadores (reconexión, inicio de sesión, arranque) |
| `src/services/` | Cliente HTTP con renovación de sesión (M-004): renovación anticipada y ante 401, una sola renovación en vuelo, sin expulsar sin señal; biometría nativa y WebAuthn (M-007); avance de cosecha con caché offline (M-010); notificaciones |
| `src/stores/` | Login con `cliente: 'movil'` y permiso `appMovil` (M-005), restauración offline con refresh vigente, bloqueo biométrico, cambio de contraseña |
| `src/utils/` | GPS nativo y web (M-009), respaldo a archivo (M-008), fechas locales (D-009), validadores, mapeo de `urlAccion` |
| `src/components/` | Indicadores de avance, barra de sincronización, banner offline, selector de insumos, accesibilidad |

## Qué no cubre

- **Las pantallas (`src/app/`) están fuera de la cobertura** (`jest.config.js`).
  Su lógica de negocio vive en stores, servicios y repositorios, que sí están
  cubiertos; las pantallas solo los conectan.
- **El service worker de la PWA** (M-011) necesita un navegador; se verifica que
  el export incluya el manifest, el service worker y su registro.
- **APIs nativas reales** (huella, GPS, SQLite nativo): se prueban con dobles.
  Hay que hacer la prueba en un teléfono antes de distribuir (checklist de
  [`DEPLOYMENT.md`](DEPLOYMENT.md)).

## E2E con Maestro

Hay cuatro flujos en `.maestro/` (login, labor, pesaje, offline). **Hoy no
pasan** y el workflow `e2e-mobile.yml` quedó solo con ejecución manual (M-013):

- buscan `testID` (`input-email`, `fab-nueva-labor`, …) que la app no define;
- esperan textos que cambiaron ("Iniciar Sesión", "Labores del Día");
- necesitan un backend con datos de prueba, que el workflow no levanta.

El `appId` ya se corrigió (`com.terravidmza.mobile`). Ponerlos en marcha
requiere agregar los `testID` a las pantallas y un backend de prueba en el job.
Mientras tanto, el camino de punta a punta contra el backend real está
cubierto por los e2e del backend (`test/recorrido-api.e2e-spec.ts`,
sincronización) y por Playwright en la Web.

## CI

[`.github/workflows/deploy-mobile.yml`](.github/workflows/deploy-mobile.yml),
job `validate`: `npm run typecheck`, `npm test -- --coverage` y un
`expo export --platform web` de prueba.
