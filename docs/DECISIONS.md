# Decisiones de diseño — TerraVid Mobile

Registro de las decisiones propias de la app móvil. Usan el prefijo **M-** para
no confundirse con las del Backend (**D-**) ni con las de Web (**W-**). Cuando el
código cita una decisión del backend (por ejemplo D-009, fechas locales) se
refiere al `docs/DECISIONS.md` del repositorio Backend.

| # | Decisión | Estado |
|---|---|---|
| M-001 | SQLite real en la PWA con sql.js | ✅ Implementada |
| M-002 | Migraciones versionadas del esquema local | ✅ Implementada |
| M-003 | Reintento automático: lo que no sube queda pendiente | ✅ Implementada |
| M-004 | Sesión con refresh token que sobrevive al trabajo offline | ✅ Implementada |
| M-005 | La app la usa quien tiene permiso, no un rol fijo | ✅ Implementada |
| M-006 | Correcciones para que la PWA y las notificaciones funcionen | ✅ Implementada |
| M-007 | Desbloqueo biométrico local de la sesión guardada | ✅ Implementada |
| M-008 | Modo solar y respaldo a archivo | ✅ Implementada |
| M-009 | Ubicación GPS opcional de cada registro | ✅ Implementada |
| M-010 | Avance de cosecha contra la meta de la campaña | ✅ Implementada |
| M-011 | PWA instalable que abre sin señal | ✅ Implementada |
| M-012 | Distribución por APK y PWA, sin tiendas | ✅ Implementada |

---

## M-001 — SQLite real en la PWA con sql.js

**Contexto.** La versión web de la app no es una demo: es el canal para
instalar TerraVid sin pasar por las tiendas (PWA). Hasta ahora la web usaba un
"emulador de SQL" escrito con expresiones regulares sobre `localStorage`. Solo
entendía las consultas que alguien había previsto: ignoraba `ORDER BY`,
`LIMIT` y `OFFSET`, y una sentencia nueva podía no hacer nada sin avisar. Como
los tests corren con `Platform.OS = 'web'`, **los tests de base de datos
probaban el emulador y no SQLite**.

**Decisión.** En web se usa SQLite compilado a WebAssembly (`sql.js`).

- La base vive en memoria y se guarda completa en IndexedDB después de cada
  escritura (dentro de una transacción, al confirmarla). Con el volumen de un
  capataz pesa unos cientos de KB.
- El navegador carga `sql-wasm-browser.js` (no referencia módulos de Node) y
  pide el `.wasm` a `/sqljs/`. El `postinstall` (`scripts/copiar-sqljs-wasm.mjs`)
  lo copia a `public/sqljs/`, así coincide siempre con la versión instalada;
  esa carpeta no se versiona.
- La elección del cargador es por plataforma: `sqljs-loader.web.ts` (Metro
  web), `sqljs-loader.native.ts` (no se usa; evita meter sql.js en el bundle
  nativo) y `sqljs-loader.ts` (Jest, que no resuelve extensiones por
  plataforma).
- Al primer arranque se importan los datos del emulador anterior
  (`localStorage['terravid_web_db']`) y se borra la clave. Un capataz que ya
  usaba la PWA puede tener registros sin sincronizar ahí: no se pierden.
- Las transacciones anidadas fallan, igual que en expo-sqlite nativo.

**Consecuencias.**
- La PWA ejecuta exactamente las mismas consultas que Android.
- Los tests de repositorios y de sincronización usan SQL real.
- Sin IndexedDB (modo privado de algunos navegadores) la base funciona en
  memoria y se pierde al cerrar la pestaña.
- El bundle web suma el `.wasm` (~650 KB), que se descarga una vez y queda en
  caché.

## M-002 — Migraciones versionadas del esquema local

**Contexto.** El esquema tenía una fila `schema_version` pero ningún mecanismo
para cambiarlo: la app nativa además la reescribía con `1` en cada arranque.
Las funcionalidades que vienen (reintentos, GPS) agregan columnas, y un
teléfono en campo puede tener registros sin sincronizar que no se pueden
perder.

**Decisión.**
- `CREATE_TABLES` (`schema.ts`) queda congelado como versión 1.
- Los cambios se agregan en `src/db/migrations.ts`. Cada migración tiene un
  número de versión, se aplica una sola vez, en orden y dentro de una
  transacción, y actualiza `sync_meta.schema_version`.
- Una instalación nueva crea la versión 1 y recorre las migraciones igual que
  una existente: hay un único camino al esquema actual.
- Una migración publicada no se edita; se agrega otra.

| Versión | Cambio |
|---|---|
| 1 | Esquema base |
| 2 | `intentos_sync` en labores y pesajes; los registros en `error` pasan a `pendiente` (M-003) |

## M-003 — Reintento automático: lo que no sube queda pendiente

**Contexto.** Había tres problemas que, juntos, hacían perder trabajo:

1. **El contrato con el backend no coincidía.** Mobile enviaba `pesoKg` y el
   backend espera `kgTotales`; con `forbidNonWhitelisted` el lote entero
   volvía con 400. Mobile leía `{error, serverId}` y el backend responde
   `{estado, errorMessage, registroId | pesajeId}`, así que una labor
   rechazada se marcaba como **sincronizada**. Los tests no lo detectaban
   porque los mocks repetían la forma equivocada.
2. Un corte de red marcaba el lote como `error`, y el motor solo enviaba
   registros `pendiente`: **un registro en error no se volvía a enviar nunca**.
3. La estrategia de reintentos (30/60/120 s) existía pero nadie la llamaba.

**Decisión** (pedida por el product owner: "reintento automático y, si falla
nuevamente, debe quedar como pendiente de sincronizar").

- Localmente un registro está `pendiente` o `sincronizado`. Un intento fallido
  lo deja pendiente con `error_message` y suma `intentos_sync`. Editarlo
  reinicia ambos.
- Si una ronda deja pendientes, el motor programa otra a los 30, 60 y 120 s
  (jitter ±10 %). Después deja de insistir hasta el próximo disparador:
  reconexión, apertura de la app, inicio de sesión, registro nuevo, botón
  "sincronizar" o pull-to-refresh. Esos disparadores reinician la cuenta.
- Sin conexión no se programan reintentos, y perder la señal cancela el que
  estaba programado. Cerrar sesión también lo cancela.
- Fallos transitorios (sin red, 5xx, 401, 429): se corta la ronda y el lote
  queda pendiente con el motivo.
- Rechazo del lote entero (400/403/404/409/422): se reenvía de a uno con el
  `POST` individual, que el backend responde con el mismo formato. Así un
  cuartel dado de baja en un registro no frena a los otros nueve.
- Un registro que no aparece en la respuesta no se da por sincronizado.
- Dentro de una ronda los registros que fallan se saltean con `OFFSET`, por eso
  el motor no los vuelve a pedir en un ciclo infinito.

**En la interfaz.** El chip "Reintentando" marca los registros con intentos
fallidos, y el detalle muestra el motivo y la cantidad de intentos. La barra de
estado sigue mostrando el total de pendientes.

**Consecuencias.**
- Un registro que el backend nunca va a aceptar (por ejemplo, un cuartel que ya
  no existe) se reintenta en cada disparador hasta que el capataz lo edite o lo
  elimine. Es preferible a perderlo en silencio.
- `src/types/api.types.ts` es el espejo del backend: si cambia un DTO allá, hay
  que cambiarlo acá y en los tests de `src/sync/`, que usan la forma real de la
  respuesta.

## M-004 — Sesión con refresh token que sobrevive al trabajo offline

**Contexto.** El backend pasó a sesiones con access token corto (15 minutos por
defecto) y refresh token rotativo (D-023 del Backend). La app guardaba un solo
token y, ante cualquier 401, cerraba la sesión. Con un access de 15 minutos eso
expulsaría al capataz cada vez que vuelve a tener señal.

**Decisión.**
- SecureStore (localStorage en la PWA) guarda `accessToken`, `refreshToken`,
  `refreshExpiresAt` y `user`. `sesion.service.ts` centraliza guardar, borrar y
  renovar.
- **Renovación anticipada:** si al access le queda menos de un minuto, el
  interceptor de request renueva antes de mandar.
- **Renovación ante 401:** se renueva y se reintenta la request una sola vez.
  Si el token recién renovado también da 401, se cierra la sesión (sin bucle).
- **Un único `/auth/refresh` en vuelo.** La sincronización manda varias
  requests a la vez, y el backend trata el segundo uso del mismo refresh token
  como robo.
- **Sin señal no se cierra la sesión.** Si la renovación falla por red, la
  request falla con su error (la sincronización la reintenta, M-003) y la
  sesión queda intacta. Solo un 401 del propio `/auth/refresh` la termina.
- **Arranque sin señal.** `restore()` deja entrar con el access vencido
  mientras el refresh siga vigente: el capataz carga registros offline y la
  primera request al volver la conexión renueva. Si los dos vencieron, pide
  login.
- Cada renovación trae el usuario actualizado y el store lo toma (un cambio
  de rol se ve sin volver a entrar).

**Consecuencias.**
- Un capataz puede trabajar sin señal tanto tiempo como dure el refresh token
  de su empresa (7 días por defecto, configurable hasta 30 en la Web).
- Las sesiones guardadas antes de esta versión no tienen refresh token: duran
  lo que les queda al access y después piden login.

## M-005 — La app la usa quien tiene permiso, no un rol fijo

**Contexto.** Cualquier rol podía iniciar sesión en la app, aunque solo sirve
para registrar labores y pesajes. Un Auditor entraba y veía formularios que el
backend le iba a rechazar. El product owner pidió que la app sea para quien
tenga permiso de hacer lo que permite, manejado como permiso y no como una
lista de roles en la app.

**Decisión** (D-024 del backend).
- El login manda `cliente: 'movil'`. El backend responde **403** si el rol no
  tiene `appMovil` (la unión de `laboresRegistro` y `pesajesRegistro`), y la
  app muestra ese mensaje.
- La app lo verifica también con `user.permisos`, por si el backend es
  anterior a D-024 y no conoce `cliente`.
- Una sesión guardada sin `permisos` (anterior a este cambio) o sin
  `appMovil` pide iniciar sesión de nuevo.
- Las pestañas *Labores* y *Pesaje*, y sus accesos rápidos del inicio, se
  muestran según `laboresRegistro` y `pesajesRegistro`. Hoy los tres roles con
  acceso tienen los dos permisos, pero la app no asume la tabla de roles:
  sigue lo que manda el backend.

## M-006 — Correcciones para que la PWA y las notificaciones funcionen

Errores que impedían usar partes de la app, encontrados en la revisión del
2026-10-05:

- **`Alert.alert` no hace nada en react-native-web.** En la PWA, guardar una
  labor o un pesaje no volvía a la lista (el `router.back()` estaba en el botón
  del alerta) y "Eliminar registro" no eliminaba nada. `src/utils/dialogos.ts`
  ofrece `avisar()` y `confirmar()`, que devuelven promesas y en web usan
  `window.alert` / `window.confirm`.
- **Notificaciones: nunca cargaban.** El servicio mandaba `?limit=20` y el
  backend rechaza con 400 cualquier parámetro que no conoce (espera
  `pageSize`). El `catch` vacío escondía el error. Además la paginación no
  avanzaba nunca. Ahora pide `pageSize`, trae la página siguiente al llegar al
  final (`onEndReached`), muestra el error si falla y, al tocar una
  notificación, la marca leída y abre la pantalla de su `urlAccion` cuando la
  app la tiene (labores o pesaje).
- **Cambio de contraseña obligatorio.** La pantalla mutaba el objeto `user` en
  el lugar: el store no se enteraba y lo guardado seguía diciendo que la
  contraseña era temporal. Además el control solo redirigía al salir del login,
  así que una sesión restaurada con contraseña temporal entraba a las
  pestañas. Ahora `marcarPasswordCambiada()` actualiza el store y lo guardado,
  y el control redirige desde cualquier pantalla.

## M-007 — Desbloqueo biométrico local de la sesión guardada

**Contexto.** `BiometricsService.autenticar()` devolvía `true` sin pedir nada
cuando el navegador conocía `PublicKeyCredential`, y nadie lo usaba.

**Decisión.** Es un **desbloqueo local**: la sesión (M-004) ya está en el
teléfono y la huella solo decide si se puede usar al abrir la app. No
reemplaza la contraseña en el servidor.

- **Android / iOS:** `expo-local-authentication` (huella, rostro o PIN del
  dispositivo como respaldo).
- **PWA:** WebAuthn con autenticador de plataforma. Al activarlo se crea una
  credencial; al desbloquear se pide esa credencial con
  `userVerification: 'required'`. No hay servidor que verifique la firma: es el
  mismo nivel de confianza que la verificación local de Android.
- Se activa en *Inicio → Ajustes* y pide la verificación en el momento: no se
  activa algo que no se probó.
- Con el desbloqueo activo, `restore()` deja la sesión **bloqueada** y el
  layout muestra `PantallaBloqueo`, que pide la huella sola. *Ingresar con
  contraseña* cierra la sesión.
- Cerrar sesión desactiva el desbloqueo: otra persona que entre en el mismo
  teléfono no lo hereda.

## M-008 — Modo solar y respaldo a archivo

- **Modo solar:** el store existía pero el layout lo ignoraba y el modo no se
  restauraba. Ahora el layout usa el tema solar cuando está elegido y
  `restaurar()` lo recupera al abrir. Se activa en *Ajustes*.
- **Respaldo:** antes armaba el JSON en memoria y no lo guardaba. Ahora exporta
  **todos** los registros del teléfono (no solo los de hoy), sincronizados o
  no, con la cantidad de pendientes. En Android escribe el archivo y abre el
  menú de compartir (`expo-file-system` + `expo-sharing`); en la PWA lo
  descarga. El nombre usa la fecha local (D-009); antes usaba UTC.

## M-009 — Ubicación GPS opcional de cada registro

- Al guardar una labor o un pesaje se pide la ubicación: `expo-location` en
  nativo (pide permiso la primera vez) y `navigator.geolocation` en la PWA. La
  versión anterior usaba `navigator.geolocation` también en nativo, donde no
  existe.
- **Opcional:** sin permiso, sin señal o si tarda más de 8 s, el registro se
  guarda sin coordenadas. Nunca frena la carga.
- Migración local 3: `latitud` y `longitud` en `registro_labor` y
  `pesaje_vendimia`. Viajan al backend solo si existen (D-027 del backend).

## M-010 — Avance de cosecha contra la meta de la campaña

- El indicador tenía una meta fija de 10.000 kg en el código. Ahora usa
  `GET /campanias/actual/avance` (D-027 del backend): la meta que el
  Propietario carga por cuartel y los kilos pesados en la campaña.
- La respuesta se guarda en `sync_meta`: sin señal se muestra el último avance
  conocido, más los kilos pesados en el teléfono que todavía no se
  sincronizaron (y se aclara).
- Sin metas cargadas, se muestran los kilos sin inventar un porcentaje.

## M-011 — PWA instalable que abre sin señal

La versión web es el canal para instalar TerraVid sin tiendas.

- `public/manifest.json` con íconos de 192 y 512 px (uno *maskable*) para
  "Agregar a la pantalla de inicio".
- `public/sw.js`: la navegación va primero a la red y sin red usa el index
  guardado; los bundles y estáticos con hash se sirven del caché. La API nunca
  se cachea. Los datos ya funcionaban offline (M-001).
- `public/index.html` es la plantilla del export SPA (con `output: single` el
  `+html.tsx` de expo-router no se usa) y registra el service worker.
- El servidor no puede cachear `sw.js` ni `index.html`: si no, una versión nueva
  no llegaría nunca. Se corrigió `nginx.conf` (los cacheaba un año como
  *immutable*) y el bloque de Caddy en el repo Backend.

**Limitación:** el comportamiento offline del service worker no tiene test
automatizado (necesita un navegador). Se verificó que el export incluya el
manifest, el service worker y su registro.

## M-012 — Distribución por APK y PWA, sin tiendas

**Contexto.** El product owner decidió no pagar las cuentas de Google Play ni de
Apple: la app se distribuye como APK y como PWA. La configuración de build no
servía para generar nada:

- `eas.json` no definía la URL de la API en ningún perfil: el APK habría
  apuntado al emulador (`10.0.2.2`). El perfil `production` generaba un `.aab`
  (formato de tienda) y había una sección `submit` sin uso.
- `app.json` tenía `projectId: "your-eas-project-id"` y apuntaba a un
  `notification-icon.png` que no existía (el build fallaba).
- El `Dockerfile` tampoco pasaba la URL de la API.

**Decisión.**
- Todos los perfiles de `eas.json` definen `EXPO_PUBLIC_API_BASE_URL`;
  `production` genera **APK** con `versionCode` automático.
- `app.config.js` agrega lo que depende del entorno sin versionarlo:
  `google-services.json` (de la variable de archivo `GOOGLE_SERVICES_JSON` de
  EAS, o del disco si existe) y el `projectId` (de `EAS_PROJECT_ID`). Sin ellos
  el build igual funciona, sin push.
- `notification-icon.png` generado como silueta blanca de 96 px (lo que pide
  Android) a partir del ícono monocromo. Se configuró la pantalla de splash.
- Se quitó `NSAllowsArbitraryLoads` (no hay build de iOS y la API es HTTPS).
- `Dockerfile` recibe la URL como `ARG` y usa Node 24, igual que el CI.
- CI: permisos 755/644 en vez de 777, Jest corre una sola vez y el resumen
  informa el estado real del job.

**Pendiente del lado del equipo:** crear la cuenta de Expo, correr
`eas init`, subir `google-services.json` a EAS y cargar los secretos del CI.
El procedimiento está en [`DEPLOYMENT.md`](../DEPLOYMENT.md).
