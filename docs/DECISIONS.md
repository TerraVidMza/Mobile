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
| M-013 | Los E2E de Maestro quedan en ejecución manual | ✅ Implementada |
| M-014 | La PWA se publica en Firebase Hosting, junto a la Web | ✅ Implementada |
| M-016 | Permiso de ubicación sin colgar el guardado y catálogos incompletos a la vista | ✅ Implementada |
| M-017 | SonarCloud como analizador estático de la app | ✅ Vigente |
| M-018 | Expo SDK 57, un SDK a la vez | ✅ Implementada |
| M-019 | La fuente de íconos se publica con la PWA | ✅ Implementada |
| M-020 | La barra de pestañas respeta la barra de navegación de Android | ✅ Implementada |
| M-021 | Sin promesas sueltas: hápticos sin espera y cargas que siempre terminan | ✅ Implementada |

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

**Actualización (proyecto de EAS vinculado).** `eas init` creó
`@sergixfarias/terravid-mobile`. El `projectId` queda en `app.json`
(`extra.eas.projectId`) en vez de solo en `EAS_PROJECT_ID`: es un
identificador público, no una credencial, y versionarlo evita que cada
persona del equipo tenga que configurar la variable para compilar.
`EAS_PROJECT_ID` sigue teniendo prioridad. El keystore se generó en los
servidores de Expo en el primer build; `versionCode` lo incrementa EAS y el
cambio en `app.json` se versiona después de cada build. Los secretos
`GCP_VM_SSH_KEY` y `GCP_VM_USER` del CI ya estaban cargados. Se registró la
app Android `com.terravidmza.mobile` en el proyecto de Firebase
`terravid-24041` y su `google-services.json` quedó en EAS como variable de
archivo `GOOGLE_SERVICES_JSON` (secreta, en los tres entornos).
El procedimiento está en [`DEPLOYMENT.md`](../DEPLOYMENT.md).

## M-013 — Los E2E de Maestro quedan en ejecución manual

**Contexto.** Los cuatro flujos de `.maestro/` nunca pudieron pasar: usaban otro
`appId`, buscaban `testID` que no existen, esperaban textos distintos y
necesitaban un backend con datos. El workflow los corría en cada PR y todas las
noches, y fallaba siempre.

**Decisión.** El workflow queda solo con `workflow_dispatch`. Se corrigió el
`appId`. El alcance de E2E acordado para la entrega es Web y Backend
(Playwright y los e2e del backend); completar Maestro requiere agregar `testID`
a las pantallas y un backend de prueba en el job. Detalle en
[`TESTING.md`](../TESTING.md).

**Actualización (testID y flujos reescritos).** Se completó la parte que
dependía de la app:

- Las pantallas declaran `testID` en lo que un flujo toca: login, pestañas
  (`tabBarButtonTestID`), botones flotantes, selectores, campos, guardar y los
  avisos de sincronización.
- Los flujos se reescribieron contra la app real. No traen datos fijos: el
  usuario y los nombres de finca, cuartel, tipo de labor, cuadrilla e insumo
  entran por variables (`-e`), porque cada base tiene los suyos.
- El login y la carga de labor son subflujos (`.maestro/subflows/`) que
  reutilizan los demás.
- `src/maestro-testids.test.ts` falla si un flujo usa un `id` que ninguna
  pantalla declara. Corre con Jest en cada PR, así el desfase que dejó los
  flujos inservibles no se repite sin aviso.
- El workflow sigue manual: pide la URL de la API, toma el usuario de secrets
  y los nombres de variables del repositorio, y compila una APK release (con
  el bundle adentro, sin depender de Metro).

El job no levanta un backend propio: hace falta una API con datos de prueba.
Los flujos no se corrieron todavía en un emulador; queda como verificación
manual antes de la entrega.

**Actualización (primera corrida, 2026-10-08).** Los cuatro flujos pasan en un
emulador Android 14 (API 34) con una APK `preview` de `main`, contra la API de
producción y un capataz de prueba (4/4 en 4 min 18 s). Lo que apareció:

- La APK anterior (versionCode 3) se había compilado antes de los `testID`;
  hubo que compilar otra. Antes de correr los flujos conviene confirmar que la
  APK los trae (`input-email` en `assets/index.android.bundle`).
- `04-offline-sync` fallaba porque el login muestra el inicio antes de que
  terminen de bajar los catálogos, y el flujo cortaba la señal en ese momento.
  `catalogos-sync.service.ts` ignora el error de cada finca, así que los
  cuarteles quedaban vacíos sin aviso. El flujo ahora refresca los catálogos
  y confirma que el cuartel está en el teléfono antes de pasar a modo avión.
  En la app el riesgo existe igual: quien pierde la señal justo después de
  entrar se queda sin cuarteles hasta el próximo refresco. *Actualización:* M-016 reintenta
  la descarga al volver la señal y avisa en el formulario.
- En un emulador Android 17 (API 37) el guardado de una labor queda cargando
  sin terminar y no se guarda nada, con o sin permiso de ubicación. En
  Android 14 la misma APK funciona. No se investigó la causa (Expo SDK 52 es
  anterior a Android 17); los flujos se corren en API 34.
  *Actualización:* la causa era el pedido del permiso de ubicación; se
  corrigió en M-016.

---

## M-014 — La PWA se publica en Firebase Hosting, junto a la Web

**Contexto.** La Web estaba en Firebase Hosting y la PWA en la VM (Caddy),
con dos mecanismos de despliegue distintos. La VM es una e2-micro (1 GB) que
además corre el backend, Postgres y Mosquitto. Servir archivos estáticos no
necesita la VM.

**Decisión.** La PWA pasa al sitio `terravid-mobile` del proyecto de Firebase
`terravid-24041` (`https://terravid-mobile.web.app`).

- `firebase.json` define el sitio, el rewrite a `index.html` (Expo Router) y
  la caché: un año solo para `/_expo/**` y `/assets/**` (con hash); el resto,
  `no-cache`. El `.wasm` de SQLite y los íconos no tienen hash.
- El job `deploy-firebase` reemplaza al `deploy-gcp` (SSH a la VM). Usa la
  misma cuenta de servicio que la Web
  (`FIREBASE_SERVICE_ACCOUNT_TERRAVID_24041`).
- La copia de la VM no se borra: sigue sirviendo la última versión. La base
  local de la PWA vive en el navegador y depende del dominio; quien la tenga
  instalada desde `duckdns` debe sincronizar ahí y después instalar la nueva.
  *Actualización:* la copia de la VM se dio de baja y el dominio
  `terravid-mobile.duckdns.org` ya no existe (D-032 del repo Backend).
- El backend tiene que aceptar el origen nuevo en `CORS_ORIGIN`.

**Por qué no todo en Firebase.** El backend mantiene una conexión fija con
Mosquitto (MQTT por TCP, puerto 8883) y usa Postgres. Firebase Hosting y
Cloud Run no aceptan TCP directo, y Cloud SQL cuesta más que la e2-micro, que
entra en la capa gratuita. El backend, Postgres y Mosquitto siguen en la VM.
- *Actualización:* el sitio y el proyecto cambiaron con M-015.

---

## M-015 — La PWA y el push pasan al proyecto `terravid`

**Contexto.** La VM y el backend estaban en el proyecto de Google Cloud
`terravid`, y la Web, la PWA y FCM en el proyecto de Firebase
`terravid-24041`, de otra cuenta. D-033 del repo Backend unifica todo en
`terravid`.

**Decisión.**

- La PWA se publica en el sitio **`terravid-app`** del proyecto `terravid`
  (`https://terravid-app.web.app`). No se pudo reusar el nombre
  `terravid-mobile`: los ID de sitio son únicos en todo Firebase y ese lo
  sigue teniendo el proyecto viejo. `mobile.terravid.web.app` tampoco es
  posible (el ID es una sola etiqueta, sin puntos); una dirección así necesita
  dominio propio.
- El job `deploy-firebase` se autentica con **Workload Identity Federation**
  (cuenta `despliegue-firebase`, solo Hosting) y despliega con
  `firebase-tools`. El secret `FIREBASE_SERVICE_ACCOUNT_TERRAVID_24041` deja de
  usarse.
- La app Android `com.terravidmza.mobile` se registró en `terravid`; el
  `google-services.json` nuevo reemplaza al anterior en la variable
  `GOOGLE_SERVICES_JSON` de EAS. Los APK compilados antes siguen registrando
  sus tokens en `terravid-24041`, así que **hay que instalar un APK nuevo** en
  cada teléfono para seguir recibiendo push.
- `terravid-mobile.web.app` responde con un 301 a `terravid-app.web.app`
  durante 7 días y después se borra el proyecto viejo.

**Costo asumido.** La base local de la PWA vive en el navegador y depende del
origen: cambiar de dirección es empezar con una base vacía. **Antes del corte,
cada PWA instalada tiene que sincronizar sus pendientes** (o sacar un respaldo,
M-008) y después instalarse desde la dirección nueva.

---

## M-016 — Permiso de ubicación sin colgar el guardado y catálogos incompletos a la vista

**Contexto.** La primera corrida de Maestro (M-013) mostró dos fallas de la
app.

1. En Android 17 (API 37), "Guardar" de una labor o un pesaje quedaba
   cargando para siempre y no se guardaba nada. `capturarCoordenadasGPS`
   llamaba a `requestForegroundPermissionsAsync` en cada guardado. Expo le pasa
   el pedido a Android aunque el permiso ya esté concedido
   (`PermissionsService.kt` de `expo-modules-core`). Android 17 registra
   `No requestable permission in the request` y no contesta, así que la
   promesa no termina. El tope de 8 s cubría solo la lectura de la posición,
   no el pedido de permiso.
2. `catalogosSyncService.syncAll` ignoraba el error de cada finca y devolvía
   `success: true`. Además nunca lanza, así que el `catch` del login no se
   ejecutaba nunca. Si la señal se cortaba justo después de entrar, una finca
   quedaba sin cuarteles en el teléfono, sin aviso y sin reintento: al volver
   la señal, `runSync` solo baja catálogos si subió algún registro.

**Decisión.**

- `location.ts` consulta el permiso con `getForegroundPermissionsAsync` y solo
  lo pide si falta y se puede volver a preguntar. El pedido tiene su propio
  tope (30 s, porque lo contesta una persona) y la consulta el de 8 s. El
  guardado nunca espera más que eso.
- `syncAll` sigue con las demás fincas y guarda lo que llegó, pero devuelve
  `success: false` con los nombres de las fincas que fallaron.
- `useCatalogosStore.syncWithServer` recarga la base local aunque la descarga
  falle y deja `catalogosIncompletos`. El login usa el store y, si algo falla,
  no lo convierte en "Error de conexión".
- Al volver la señal, el monitor de conectividad repite la descarga si
  `catalogosIncompletos` está activo.
- "Nueva labor" y "Nuevo pesaje" muestran un aviso (`aviso-sin-cuarteles`)
  cuando la finca elegida no tiene cuarteles (o cuadrillas, en el pesaje) en
  el teléfono, con la indicación de actualizar con señal.

**Fuera de alcance.** Expo SDK 52 no declara soporte para Android 17; esta
corrección evita el pedido innecesario, pero no reemplaza actualizar el SDK. *Actualización:* el SDK se actualizó en M-018.

---

## M-017 — SonarCloud como analizador estático de la app

**Contexto:** la app no tenía linter, solo `tsc` en modo estricto, que da 0 errores. La Etapa 6 pide un analizador estático aplicado sobre el repositorio.

**Decisión:** se agrega `.sonarcloud.properties` comentado, en modo *Automatic Analysis*:

- Fuentes: `src`.
- Tests: Jest, `__mocks__` y los flujos de Maestro.

Sumar oxlint con la configuración de la Web queda como mejora posterior.

**`npm audit` sin `fix`:** el `npm audit fix` sobre el lockfile eliminaba `query-string`, dependencia de `expo-router`. Jest pasaba, pero `expo export --platform web` fallaba. Por eso se descartó: las vulnerabilidades del árbol de Expo y React Native se corrigen con la actualización del SDK, planificada después de la entrega.

**Estado:** ✅ Vigente.

---

## M-018 — Expo SDK 57, un SDK a la vez

**Contexto.** La app estaba en Expo SDK 52 (React Native 0.76, React 18), que
no declara soporte para Android 17. M-016 corrigió el guardado colgado, pero
cualquier otro módulo nativo podía fallar igual. El último SDK estable es el 57.

**Decisión.** Se subió de a un SDK (53, 54, 55, 56, 57), con un commit por
salto, typecheck y los 189 tests de Jest en cada uno. Las versiones de cada
paquete las fija `expo install --check`, no a mano. Cambios de código que
hicieron falta:

- **SDK 53** (React 19): `expo-notifications` 0.31 reemplaza `shouldShowAlert`
  por `shouldShowBanner` y `shouldShowList`. Con `react-test-renderer` 19, el
  test del banner offline renderiza dentro de `act()`.
- **SDK 54**: `expo-file-system` 19 cambia de API. El respaldo (M-008) usa
  `File` y `Paths.cache` en lugar de `writeAsStringAsync`, que quedó en
  `expo-file-system/legacy` y puede desaparecer.
- **SDK 55 y 56**: sin cambios de código.
- **SDK 57** (React Native 0.86, TypeScript 6): la splash pasa al plugin
  `expo-splash-screen` y se quita `newArchEnabled` (la nueva arquitectura es
  la única desde SDK 55). TypeScript 6 depreca `baseUrl` y ya no incluye
  todos los `@types` instalados: `tsconfig` declara `jest` y `node`.
- **Íconos.** Hasta SDK 52, `expo` traía `@expo/vector-icons` como
  dependencia; después no. Paper y las pantallas caían en
  `react-native-vector-icons`, que no empaqueta sus fuentes en el APK, y los
  íconos salían como cuadros vacíos. Los tests no lo detectan porque el ícono
  está simulado; apareció al mirar el emulador. Se instaló `@expo/vector-icons`
  y se quitó `react-native-vector-icons`.
- **Barra de estado.** Desde SDK 54 la app se dibuja detrás de la barra de
  estado también en Android 14 (edge-to-edge). El header de las pestañas se
  corría solo, pero los avisos de sin conexión y de pendientes quedaban
  debajo de la hora; Maestro falló en `04-offline-sync` en Android 14 por eso.
  El layout raíz reserva el margen superior una sola vez y les pasa `top: 0`
  a las pantallas, y la barra de estado toma el color del tema.

`.npmrc` activa `legacy-peer-deps`: `expo-router` declara
`@react-navigation/drawer` como dependencia opcional, y su última versión
arrastra `react-native-reanimated`, que pide un React Native más nuevo que el
del SDK. La app no usa drawer. Sin esto, `npm ci` falla en el CI y en EAS.

**Verificación.** `expo-doctor` 21/21, `expo export --platform web` sin
errores, y la suite de Maestro sobre una APK `preview` en Android 14 y 17
(ver la descripción del PR).

**Costo asumido.** Es un cambio grande a días de la entrega. Por eso quedó
en una rama aparte: si algo falla en un teléfono real, la APK versionCode 5
(SDK 52 con M-016) sigue siendo la de distribución.

---

## M-019 — La fuente de íconos se publica con la PWA

**Contexto.** En la PWA los íconos salían como cuadros vacíos. `expo export`
deja la fuente en `dist/assets/node_modules/@expo/vector-icons/...`, y
`firebase.json` excluía `**/node_modules/**` al publicar: el archivo nunca
se subía. Firebase respondía a esa URL con `index.html` (200, `text/html`),
con la cabecera de un año e inmutable de `/assets/**`, y el service worker
lo guardaba como si fuera la fuente. Pasaba desde M-014; la app Android no
se veía afectada porque lleva las fuentes adentro del APK.

**Decisión.**

- `firebase.json` deja de excluir `node_modules`. Dentro de `dist` no hay
  dependencias, solo recursos que Expo copió con esa ruta.
- El service worker no guarda una respuesta HTML bajo una ruta de recurso.
- `VERSION` pasa a `terravid-v2`: al activarse borra los cachés anteriores,
  donde quedó guardado el HTML en lugar de la fuente.

**Verificación.** Con el emulador de Firebase Hosting y la configuración
nueva, la fuente vuelve como `font/ttf` y el login muestra los íconos.

**Costo asumido.** Un navegador que abrió la PWA después del deploy de M-018
y antes de este puede tener el HTML guardado en su caché HTTP, por la
cabecera inmutable. El service worker nuevo no lo guarda, pero el navegador
puede seguir usándolo: en ese caso, borrar los datos del sitio. El margen
fue de minutos.

---

## M-020 — La barra de pestañas respeta la barra de navegación de Android

**Contexto.** En un teléfono real con navegación de 3 botones, los botones de
Android tapaban la barra de pestañas. Con edge-to-edge (M-018) la app se
dibuja también detrás de la barra de navegación, y `tabBarStyle` fijaba
`height: 60` y `paddingBottom: 8`, lo que reemplaza el cálculo de React
Navigation que suma ese margen. En los emuladores no se vio porque usaban
navegación por gestos, cuya barra es fina.

**Decisión.** La barra de pestañas suma el margen inferior real
(`useSafeAreaInsets().bottom`) a su altura y a su relleno. Las pantallas
fuera de las pestañas (login, recuperar contraseña, bloqueo) tienen el
contenido centrado y no se ven afectadas; los botones flotantes van dentro de
cada pestaña, encima de la barra.

**Verificación.** Emulador Android 17 con navegación de 3 botones
(`cmd overlay enable com.android.internal.systemui.navbar.threebutton`),
antes y después del cambio. Conviene sumar ese modo a las corridas de Maestro.

---

## M-021 — Sin promesas sueltas: hápticos sin espera y cargas que siempre terminan

**Contexto.** SonarCloud (M-017) dejaba la app en C de confiabilidad y de
seguridad: 29 promesas sin `await` ni `.catch` (regla S9383), un `http` y un
`Math.random`. Veintidós de las promesas eran llamadas a `haptics.*`, que
eran `async` aunque nadie necesita esperar una vibración. Al revisar el resto
aparecieron dos fallas reales:

- En los formularios de labor y pesaje, si `loadFromLocalDb()` fallaba, nunca
  se llamaba a `setLoading(false)` y la pantalla quedaba cargando.
- En el layout raíz, si `restore()` fallaba, `isMounted` no pasaba a `true`
  y la app quedaba trabada en la splash.

**Decisión.**

- `haptics.success/error/selection` devuelven `void` y absorben el rechazo
  de `expo-haptics`. Las pantallas los llaman sin `await`, así la vibración
  no demora el guardado ni la navegación.
- Los formularios usan el hook `useCargaInicial`, y el layout raíz el mismo
  patrón (`try/catch/finally`): la pantalla sale del estado de carga y la app
  arranca (sin sesión) aunque falle la lectura local. El `catch` evita que el
  error vuelva a salir como promesa sin manejar después del `finally`.
- Al elegir una finca, la carga de cuarteles y cuadrillas lleva `.catch`: si
  falla la lectura local quedan las listas vacías y se ve el aviso de
  catálogos incompletos (M-016), en lugar de un rechazo sin manejar.
- `updatePendingCount()` lleva `.catch`: si falla, el contador de pendientes
  queda con el último valor. `registerForPush()` ya atrapaba sus errores y
  se marca con `void`.
- El fallback `http://10.0.2.2` de `env.ts` (backend local desde el emulador)
  y el `Math.random` del jitter de reintentos (M-003) quedan con `NOSONAR` y
  el motivo al lado, como en el Backend: ninguno es un valor de seguridad.

**Verificación.** `tsc` sin errores y 191 tests de Jest. Los dos nuevos
cubren `useCargaInicial`, incluida la carga que falla. El test del monitor de
conectividad ahora simula `updatePendingCount` como `async`, igual que la
función real.

**Estado:** ✅ Implementada.
