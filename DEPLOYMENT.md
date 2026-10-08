# Despliegue — TerraVid Mobile

TerraVid Mobile se distribuye de dos formas, **sin tiendas oficiales**
(decisión del product owner, M-012):

| Canal | Para quién | Cómo se instala |
|---|---|---|
| **APK de Android** | Capataces con teléfono Android | Se descarga el `.apk` y se instala (permitiendo "orígenes desconocidos") |
| **PWA** | Cualquier teléfono o tablet con navegador | Se abre `https://terravid-mobile.web.app` y se elige "Agregar a la pantalla de inicio" |

Las dos usan el mismo código, funcionan sin señal y sincronizan solas al
volver la conexión (M-001, M-003, M-011).

---

## 1. Ambientes y URL de la API

La URL de la API queda **dentro del bundle** al compilar. Se toma de
`EXPO_PUBLIC_API_BASE_URL`:

| Dónde | De dónde sale |
|---|---|
| Desarrollo local (`npm start`) | `.env` (copiar `.env.example`) |
| APK (EAS Build) | `env` del perfil en [`eas.json`](eas.json) |
| PWA (CI) | secreto `EXPO_PUBLIC_API_BASE_URL` del repositorio |
| PWA (Docker) | `--build-arg EXPO_PUBLIC_API_BASE_URL=...` |

Producción hoy: `https://terravid-api.duckdns.org/api`. El dominio definitivo
será `terravid.com`; al migrar hay que cambiarlo en `eas.json`, en el secreto
del CI y volver a generar el APK.

---

## 2. Generar el APK (EAS Build)

### 2.1. Una sola vez

1. Cuenta gratuita en [expo.dev](https://expo.dev) e instalar la CLI:
   `npm install -g eas-cli` y `eas login`.
2. Vincular el proyecto: **ya está hecho**. `eas init` creó
   `@sergixfarias/terravid-mobile` y escribió el `projectId` y el `owner` en
   `app.json` (no son secretos). Para usar otra cuenta de Expo: cambiar
   `owner` y correr `eas init` de nuevo, o definir `EAS_PROJECT_ID`, que
   tiene prioridad.
3. **Notificaciones push (FCM): ya está hecho.** La app Android
   `com.terravidmza.mobile` está registrada en el proyecto de Firebase
   `terravid-24041` y su `google-services.json` está en EAS como variable
   secreta **de tipo archivo** `GOOGLE_SERVICES_JSON`. No se versiona (está en
   `.gitignore`). Si hay que regenerarlo: consola de Firebase → Configuración →
   app Android → descargar, y `eas env:create --name GOOGLE_SERVICES_JSON
   --type file --visibility secret`. Sin él el APK funciona igual, pero sin
   push.
4. Claves de firma: **ya generadas**. El primer build creó el keystore en
   los servidores de Expo (*expo.dev → proyecto → Credentials*). Bajar una
   copia de respaldo desde ahí (`eas credentials`). **Hay que firmar siempre con la misma clave**: si cambia, los
   teléfonos no pueden actualizar sin desinstalar (y perder los registros sin
   sincronizar).

### 2.2. Cada versión

```bash
# Subir la versión visible en app.json ("version": "1.1.0").
# versionCode lo incrementa EAS (autoIncrement en el perfil production).
eas build --platform android --profile production
```

EAS compila en la nube (el plan gratuito alcanza) y deja un enlace al `.apk`.
Ese enlace es lo que se comparte con los capataces.

| Perfil | Para qué | API |
|---|---|---|
| `development` | Cliente de desarrollo con recarga en caliente | `10.0.2.2:3000` (emulador) |
| `preview` | APK de prueba interna | producción |
| `production` | APK para distribuir | producción |

### 2.3. Instalar y actualizar en el teléfono

- **Instalar:** abrir el enlace desde el teléfono, descargar el `.apk` y
  permitir la instalación de orígenes desconocidos para el navegador.
- **Actualizar:** instalar el APK nuevo encima. Los registros sin sincronizar
  se conservan (la base local migra sola, M-002).
- **Antes de cambiar de teléfono:** sincronizar, o usar *Inicio → Ajustes →
  Respaldo* para sacar los registros (M-008).

---

## 3. PWA (versión web)

### 3.1. Compilar

```bash
EXPO_PUBLIC_API_BASE_URL=https://terravid-api.duckdns.org/api npx expo export --platform web
```

Genera `dist/` con el manifest, el service worker (`sw.js`), los íconos y el
`.wasm` de SQLite.

### 3.2. Servir

En producción la sirve **Firebase Hosting**: sitio `terravid-mobile` del
proyecto `terravid-24041`, el mismo de la Web (M-014). La configuración está
en [`firebase.json`](firebase.json) y [`.firebaserc`](.firebaserc). A mano:

```bash
npx firebase-tools deploy --only hosting:terravid-mobile --project terravid-24041
```

**Caché:** todo sale con `no-cache` salvo `/_expo/**` y `/assets/**`, que
tienen hash en el nombre y se cachean un año. `sw.js`, `index.html` y
`manifest.json` no se pueden cachear (si no, una versión nueva no llega
nunca); el `.wasm` de SQLite y los íconos no tienen hash, así que tampoco.
[`nginx.conf`](nginx.conf) (imagen Docker alternativa) sigue las mismas reglas
para los archivos clave.

La PWA vieja de la VM (`terravid-mobile.duckdns.org`) está dada de baja: Caddy
redirige ese dominio a `https://terravid-mobile.web.app` y desinstala el
service worker viejo (D-032 del repo Backend).

Con Docker:

```bash
docker build --build-arg EXPO_PUBLIC_API_BASE_URL=https://terravid-api.duckdns.org/api -t terravid-mobile .
docker run -p 8080:80 terravid-mobile
```

---

## 4. Despliegue automático de la PWA (GitHub Actions)

[`.github/workflows/deploy-mobile.yml`](.github/workflows/deploy-mobile.yml),
en cada push a `main`:

1. **validate:** `tsc`, Jest con cobertura y un export web de prueba.
2. **build-web:** `expo export` con la URL de producción.
3. **deploy-firebase:** publica `dist/` en el sitio `terravid-mobile` de
   Firebase Hosting y verifica que responda.

El resumen del job informa el estado real (antes decía "200 OK" aunque
hubiera fallado).

**Secretos del repositorio** (*Settings → Secrets and variables → Actions*):

| Secreto | Contenido |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_TERRAVID_24041` | JSON de la cuenta de servicio de Firebase (el mismo que usa el repo Web) |
| `EXPO_PUBLIC_API_BASE_URL` | URL de la API |

> El workflow todavía tiene la IP y el usuario como valores por defecto si
> faltan los secretos. Conviene cargar los secretos y quitar esos valores.

---

## 5. Checklist antes de distribuir

- [ ] `EXPO_PUBLIC_API_BASE_URL` de `eas.json` y del secreto del CI apuntan a la API de producción.
- [ ] `CORS_ORIGIN` del backend incluye `https://terravid-mobile.web.app` (la PWA lo necesita; el APK no).
- [ ] `version` de `app.json` incrementada.
- [x] Proyecto de EAS vinculado (`projectId` en `app.json`) y `GOOGLE_SERVICES_JSON` cargado en EAS.
- [ ] Prueba en un teléfono real: registrar en modo avión, volver a tener señal y verificar que suba solo.
- [ ] Prueba de la PWA: instalarla, cortar la red y verificar que abra.
