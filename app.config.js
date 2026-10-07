/**
 * Configuración dinámica de Expo — M-012.
 *
 * Parte de `app.json` y agrega lo que depende del entorno de build:
 *
 * - `google-services.json` (FCM para las notificaciones push). Es una
 *   credencial del proyecto de Firebase y no se versiona. En EAS se sube como
 *   variable de tipo archivo `GOOGLE_SERVICES_JSON`; en local, si existe el
 *   archivo en la raíz se usa. Sin ninguno de los dos el APK se genera igual,
 *   pero sin push.
 * - `projectId` de EAS: está en `app.json` (`extra.eas.projectId`, lo escribió
 *   `eas init`; no es secreto). `EAS_PROJECT_ID` lo reemplaza, por si se
 *   vincula otra cuenta de Expo sin tocar el archivo.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync(path.join(__dirname, 'google-services.json')) ? './google-services.json' : undefined);

  const projectId = process.env.EAS_PROJECT_ID;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
