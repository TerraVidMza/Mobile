# Capturas del manual de la app

El manual de la app está en `src/manual/contenido.ts` y sus capturas en `src/manual/img/`, registradas en `src/manual/imagenes.ts` (M-022).

Las capturas salen de la exportación web (PWA) con viewport de teléfono, contra la API local con datos de demostración. Para preparar la base aislada y los datos, ver `Web/scripts/manual/README.md`.

```bash
# En Mobile/
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api npx expo export --platform web --output-dir <carpeta>
# Servir <carpeta> en http://localhost:8081, devolviendo index.html para las rutas que no son archivos.

node scripts/manual/capturas-manual.mjs
```

Playwright se toma de `../Web` (o de la carpeta que diga `PLAYWRIGHT_DESDE`). Con `MANUAL_TEXTOS=<carpeta>` además se guarda el texto de cada pantalla.

En la PWA los avisos («Labor guardada», «Pesaje guardado») son `window.alert` del navegador y no salen en una captura: el script los acepta y muestra su texto en consola.

Si se agrega una captura al manual, hay que registrarla en `src/manual/imagenes.ts`; el test `contenido.test.ts` falla si falta. Después, copiá las `movil-*.jpg` a `Web/src/features/ayuda/manual/img/` para el manual del Capataz en la Web.
