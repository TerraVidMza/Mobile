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

Hay cuatro flujos en `.maestro/` (login, labor, pesaje, offline) y dos
subflujos en `.maestro/subflows/` (login y carga de labor). Se corren a mano
(M-013): necesitan un backend con datos que el CI no levanta.

### Qué necesitan

- Un emulador Android 14 (API 34) o un teléfono por USB con la app instalada,
  apuntando a una API con datos (`EXPO_PUBLIC_API_BASE_URL` al compilar; por defecto
  `http://10.0.2.2:3000/api`, el backend local visto desde el emulador).
- Un usuario capataz con `labores:registrar` y `pesajes:registrar`, que no
  tenga que cambiar la contraseña al entrar.
- Una finca con un cuartel, una cuadrilla, un tipo de labor y un insumo
  cargados desde la Web.

### Cómo se corren

```bash
maestro test .maestro/   -e EMAIL=capataz@ejemplo.com -e PASSWORD='...'   -e FINCA='Finca Demo TerraVid' -e CUARTEL='Cuartel 1'   -e TIPO_LABOR='Poda' -e CUADRILLA='Cuadrilla 1' -e INSUMO='Azufre'
```

`CUARTEL`, `TIPO_LABOR` e `INSUMO` son el comienzo del texto del menú (la app
agrega la variedad o la unidad entre paréntesis). `04-offline-sync` usa modo
avión, que Maestro solo maneja en Android.

En GitHub, `e2e-mobile.yml` se dispara a mano con la URL de la API; toma
`MAESTRO_EMAIL` y `MAESTRO_PASSWORD` de los secrets y `MAESTRO_FINCA`,
`MAESTRO_CUARTEL`, `MAESTRO_TIPO_LABOR`, `MAESTRO_CUADRILLA` y
`MAESTRO_INSUMO` de las variables del repositorio.

### testID

Los flujos ubican los elementos por `testID` (`input-email`, `tab-labores`,
`fab-nueva-labor`, `selector-finca`, `boton-guardar-labor`, `sync-pendientes`,
…). `src/maestro-testids.test.ts` corre con Jest y falla si un flujo usa un
`id` que ninguna pantalla declara: si se renombra un `testID`, hay que
actualizar el flujo en el mismo cambio.

### Historia

Hasta M-013 los flujos no pasaban nunca: usaban otro `appId`, buscaban
`testID` que la app no definía, esperaban textos que habían cambiado
("Iniciar Sesión", "Labores del Día") y traían datos fijos de una base que no
existe. Se reescribieron contra la app real.

La primera corrida completa fue el 2026-10-08: 4/4 en un emulador Android 14
con la APK `preview` de `main`, contra producción. En Android 17 (API 37) el
guardado de labores se cuelga, por eso se usa API 34. La APK tiene que traer
los `testID`; una compilada antes de M-013 no los tiene. Detalle en M-013.
El camino de punta a punta contra el backend real también está cubierto por
los e2e del backend (`test/recorrido-api.e2e-spec.ts`, sincronización) y por
Playwright en la Web.

## CI

[`.github/workflows/deploy-mobile.yml`](.github/workflows/deploy-mobile.yml),
job `validate`: `npm run typecheck`, `npm test -- --coverage` y un
`expo export --platform web` de prueba.
