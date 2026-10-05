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
