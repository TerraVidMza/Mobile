# Despliegue — TerraVid Mobile

TerraVid Mobile se distribuye de dos formas, **sin tiendas oficiales**
(decisión del product owner, M-012):

| Canal | Para quién | Cómo se instala |
|---|---|---|
| **APK de Android** | Capataces con teléfono Android | Se descarga el `.apk` y se instala (permitiendo "orígenes desconocidos") |
| **PWA** | Cualquier teléfono o tablet con navegador | Se abre `https://terravid-mobile.duckdns.org` y se elige "Agregar a la pantalla de inicio" |

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
2. Vincular el proyecto: `eas init`. Crea el proyecto en Expo y muestra su
   `projectId`; guardarlo como variable `EAS_PROJECT_ID` (en el entorno local
   y en *expo.dev → proyecto → Environment variables*). `app.config.js` lo toma
   de ahí.
3. **Notificaciones push (FCM):** descargar `google-services.json` desde la
   consola de Firebase (proyecto → Configuración → app Android
   `com.terravidmza.mobile`) y subirlo a EAS como variable **de tipo archivo**
   llamada `GOOGLE_SERVICES_JSON`. No se versiona (está en `.gitignore`). Sin
   él el APK funciona igual, pero sin push.
4. Claves de firma: en el primer build EAS ofrece generarlas y guardarlas.
   Aceptar. **Hay que firmar siempre con la misma clave**: si cambia, los
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

En producción la sirve el Caddy de la VM (bloque `terravid-mobile.duckdns.org`
en `Backend/deploy/Caddyfile`), desde `/opt/terravid/mobile`, montado en el
contenedor como `/srv/mobile`.

**Caché:** `sw.js`, `index.html` y `manifest.json` no se pueden cachear (si
no, una versión nueva no llega nunca); los bundles con hash, sí. Ya está
configurado en el Caddyfile y en [`nginx.conf`](nginx.conf) (imagen Docker
alternativa).

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
3. **deploy-gcp:** copia `dist/` a la VM por SSH, lo extrae en
   `/opt/terravid/mobile` (directorios 755, archivos 644), reinicia Caddy y
   verifica que responda.

El resumen del job informa el estado real (antes decía "200 OK" aunque
hubiera fallado).

**Secretos del repositorio** (*Settings → Secrets and variables → Actions*):

| Secreto | Contenido |
|---|---|
| `GCP_VM_HOST` | IP o dominio de la VM |
| `GCP_VM_USER` | Usuario SSH |
| `GCP_VM_SSH_KEY` | Clave privada SSH de despliegue |
| `EXPO_PUBLIC_API_BASE_URL` | URL de la API |

> El workflow todavía tiene la IP y el usuario como valores por defecto si
> faltan los secretos. Conviene cargar los secretos y quitar esos valores.

---

## 5. Checklist antes de distribuir

- [ ] `EXPO_PUBLIC_API_BASE_URL` de `eas.json` y del secreto del CI apuntan a la API de producción.
- [ ] `CORS_ORIGIN` del backend incluye `https://terravid-mobile.duckdns.org` (la PWA lo necesita; el APK no).
- [ ] `version` de `app.json` incrementada.
- [ ] `EAS_PROJECT_ID` y `GOOGLE_SERVICES_JSON` cargados en EAS.
- [ ] Prueba en un teléfono real: registrar en modo avión, volver a tener señal y verificar que suba solo.
- [ ] Prueba de la PWA: instalarla, cortar la red y verificar que abra.
