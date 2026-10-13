/*
 * Service worker de la PWA de TerraVid — M-011.
 *
 * Objetivo: que la app abra sin señal. Los datos ya funcionan offline
 * (SQLite en IndexedDB, M-001); lo que faltaba era el código de la app.
 *
 * - Navegación (HTML): red primero; sin red, el index guardado. Así una
 *   versión nueva se ve apenas hay señal, y sin señal la app igual abre.
 * - Bundles y recursos estáticos (/_expo/static, /assets, /sqljs, /icons):
 *   caché primero. Tienen hash en el nombre: un archivo nuevo es otra URL.
 * - Llamadas a la API: nunca se cachean (otro origen; además son datos
 *   del usuario).
 *
 * Cambiar VERSION invalida los cachés anteriores al activarse.
 *
 * v2 (M-019): un recurso que no estaba publicado volvía como index.html con
 * 200, y quedaba guardado en lugar del archivo (la fuente de íconos). Ahora
 * no se guarda HTML bajo una ruta de recurso, y el cambio de versión borra
 * lo que ya había quedado mal.
 */
const VERSION = 'terravid-v2';
const SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/sqljs/sql-wasm-browser.wasm'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const ESTATICO = /^\/(_expo\/static|assets|sqljs|icons)\//;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((c) => c.put('/', copia));
          return respuesta;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (ESTATICO.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ||
          fetch(request).then((respuesta) => {
            const esHtml = (respuesta.headers.get('content-type') || '').includes('text/html');
            if (respuesta.ok && !esHtml) {
              const copia = respuesta.clone();
              caches.open(VERSION).then((c) => c.put(request, copia));
            }
            return respuesta;
          }),
      ),
    );
  }
});
