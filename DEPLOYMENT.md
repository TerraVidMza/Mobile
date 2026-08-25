# 🚀 Plan Completo de Despliegue — TerraVid Mobile (Android, iOS y Web)

Este documento detalla la arquitectura, prerrequisitos, comandos y procesos paso a paso para compilar, firmar, distribuir y publicar la aplicación **TerraVid Mobile** en sus tres plataformas de destino: **Android**, **iOS** y **Web**.

---

## 1. Estrategia de Ambientes y Variables

| Ambiente | Propósito | Backend URL | Distribución |
|---|---|---|---|
| **Development** | Desarrollo local y emuladores | `http://<IP-LOCAL>:3000/api` | Expo Go / Expo Dev Client |
| **Preview (Staging)** | Pruebas de campo con capataces | `https://staging-api.terravid.com/api` | **Android**: APK directo<br>**iOS**: TestFlight Interno<br>**Web**: Vercel / Netlify Staging |
| **Production** | Operación real de cosecha y labores | `https://api.terravid.com/api` | **Android**: Google Play Store (AAB)<br>**iOS**: Apple App Store (IPA)<br>**Web**: Nginx / CDN CloudFront |

### Configuración de Variables de Entorno
Crea los archivos de entorno correspondientes o configúralos en **EAS Secrets**:
- `.env.development`: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000/api`
- `.env.staging`: `EXPO_PUBLIC_API_BASE_URL=https://staging-api.terravid.com/api`
- `.env.production`: `EXPO_PUBLIC_API_BASE_URL=https://api.terravid.com/api`

---

## 2. Prerrequisitos Globales

1. **Instalar EAS CLI globalmente**:
   ```bash
   npm install -g eas-cli
   ```
2. **Iniciar sesión en Expo**:
   ```bash
   eas login
   ```
3. **Vincular el proyecto a EAS**:
   ```bash
   eas project:init
   ```
   *(Esto generará el `projectId` en `app.json`).*

---

## 3. Despliegue en Android

### 3.1. Prerrequisitos
- **Google Play Developer Account** (pago único de $25 USD en [play.google.com/console](https://play.google.com/console)).
- Archivo `google-services.json` (descargado de Firebase Console para Push Notifications FCM).

---

### 3.2. Ambiente Preview (APK para pruebas directas en viñedo)
Permite generar un archivo `.apk` instalable directamente en cualquier celular Android sin pasar por Google Play Store:

```bash
# Compilar APK de preview en la nube de EAS
eas build --platform android --profile preview
```
* **Resultado**: Al finalizar, la terminal te dará un enlace y un código QR para descargar el `.apk` directamente en los celulares de los capataces.

---

### 3.3. Ambiente Producción (Google Play Store)

#### Paso 1: Generar el Android App Bundle (.aab)
```bash
eas build --platform android --profile production
```
*EAS gestionará automáticamente la clave criptográfica de firma (Keystore) de forma segura en la nube.*

#### Paso 2: Subir a Google Play Console (Track Interno / Producción)
1. **Configurar Google Service Account**:
   - En Google Cloud Console, crea una cuenta de servicio con permisos en Google Play Android Developer.
   - Descarga la clave en formato JSON (ej. `pc-api-key.json`).
2. **Enviar el binario automáticamente**:
   ```bash
   eas submit --platform android --profile production --key pc-api-key.json
   ```
3. **Completar ficha en Google Play Console**:
   - Capturas de pantalla para teléfonos y tablets.
   - Declaración de políticas de privacidad y permisos (`INTERNET`, `VIBRATE`).
   - Promover de *Pruebas Internas* $\to$ *Producción*.

---

## 4. Despliegue en iOS

### 4.1. Prerrequisitos
- **Apple Developer Program** ($99 USD/año en [developer.apple.com](https://developer.apple.com)).
- Acceso a **App Store Connect**.

---

### 4.2. Ambiente Preview / TestFlight
Apple no permite instalar archivos sueltos sin firmar. La forma oficial y más rápida es a través de **TestFlight**:

```bash
# Compilar binario para TestFlight
eas build --platform ios --profile preview
```
*EAS solicitará tus credenciales de Apple Developer una única vez para generar el Certificado de Distribución y el Provisioning Profile automáticamente.*

---

### 4.3. Ambiente Producción (Apple App Store)

#### Paso 1: Compilar para Producción
```bash
eas build --platform ios --profile production
```

#### Paso 2: Enviar a App Store Connect
```bash
eas submit --platform ios --profile production
```

#### Paso 3: Ficha en App Store Connect
- Subir capturas de pantalla de iPhone (6.7" y 6.5").
- Completar descripción, URL de soporte y política de privacidad.
- Enviar a Revisión de Apple (*App Review*).

---

## 5. Despliegue en Web

La versión Web de TerraVid Mobile permite a supervisores y administrativos acceder a la misma interfaz desde cualquier navegador de escritorio o tablet.

### 5.1. Compilación del Bundle Estático
Para generar los archivos estáticos optimizados (HTML, JS, CSS, Assets):

```bash
npx expo export --platform web
```
*Esto generará la carpeta **`dist/`** lista para ser servida.*

---

### 5.2. Opciones de Hosting para Producción

#### Opción A: Despliegue en Nginx / Docker (Recomendado On-Premise / Servidor Propio)

**Dockerfile**:
```dockerfile
# Etapa 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npx expo export --platform web

# Etapa 2: Servidor Nginx liviano
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf** (Con soporte para SPA routing de Expo Router):
```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Compresión Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # Soporte para rutas de Expo Router (SPA Fallback)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache agresivo para assets estáticos con hash
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

#### Opción B: Despliegue en Vercel (Recomendado Serverless / Cloud)

1. Crear el archivo `vercel.json` en la raíz de `Mobile/`:
   ```json
   {
     "buildCommand": "npx expo export --platform web",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
2. Ejecutar:
   ```bash
   vercel --prod
   ```

---

## 6. Actualizaciones Inmediatas en Caliente (EAS Update / OTA)

Para corregir bugs de JavaScript, lógica de negocio o interfaz sin tener que pasar por la revisión de Google Play o Apple App Store (demoras de 24 a 48 hs):

```bash
# Publicar actualización inmediata al canal de producción
eas update --channel production --message "Corrección en cálculo de pesaje y filtro de cuarteles"
```
*Los dispositivos de los capataces descargarán la nueva versión de forma transparente al abrir la aplicación.*

---

## 7. Pipeline de CI/CD Automatizado (GitHub Actions)

Crea el archivo `.github/workflows/deploy-mobile.yml`:

```yaml
name: TerraVid Mobile CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Typecheck & Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: Mobile/package-lock.json

      - name: Install Dependencies
        working-directory: Mobile
        run: npm ci

      - name: TypeScript Check
        working-directory: Mobile
        run: npx tsc --noEmit

      - name: Run Unit Tests
        working-directory: Mobile
        run: npm test

  build-web:
    name: Build & Deploy Web
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install & Export Web
        working-directory: Mobile
        run: |
          npm ci
          npx expo export --platform web
        env:
          EXPO_PUBLIC_API_BASE_URL: ${{ secrets.PROD_API_BASE_URL }}

      # Aquí se puede conectar con AWS S3, Vercel o Docker Registry
```

---

## 8. Checklist Pre-Lanzamiento (Go-Live)

- [ ] **Backend URL**: Verificar que `EXPO_PUBLIC_API_BASE_URL` apunte al dominio HTTPS de producción.
- [ ] **CORS**: En el backend (`Platform/src/main.ts`), confirmar que el dominio Web de producción esté en `allowedOrigins`.
- [ ] **Iconos y Splash**: Assets de alta resolución ubicados en `assets/`.
- [ ] **Versionado**: Incrementar `version` (ej. `1.0.1`) y `versionCode` / `buildNumber` en `app.json`.
- [ ] **Credenciales EAS**: Ejecutar `eas credentials` para validar certificados activos de Android e iOS.
- [ ] **Batería de Pruebas Offline**: Realizar una prueba física de carga de labor y pesaje en modo avión y verificar auto-sincronización al reactivar la conexión.
