/**
 * Capturas del manual — M-022.
 *
 * Metro necesita un `require` literal por archivo, así que no se puede
 * armar la ruta en tiempo de ejecución. El ancho y el alto dan la proporción
 * con la que se dibuja cada una. Si se agrega una captura al manual, va acá.
 */

import type { ImageSourcePropType } from 'react-native';

export const IMAGENES: Record<string, { fuente: ImageSourcePropType; ancho: number; alto: number }> = {
  'movil-avisos.jpg': { fuente: require('./img/movil-avisos.jpg'), ancho: 412, alto: 915 },
  'movil-inicio.jpg': { fuente: require('./img/movil-inicio.jpg'), ancho: 412, alto: 915 },
  'movil-labor-detalle.jpg': { fuente: require('./img/movil-labor-detalle.jpg'), ancho: 412, alto: 915 },
  'movil-labores-con-nueva.jpg': { fuente: require('./img/movil-labores-con-nueva.jpg'), ancho: 412, alto: 915 },
  'movil-login.jpg': { fuente: require('./img/movil-login.jpg'), ancho: 412, alto: 915 },
  'movil-nueva-labor-completa.jpg': { fuente: require('./img/movil-nueva-labor-completa.jpg'), ancho: 412, alto: 915 },
  'movil-nueva-labor.jpg': { fuente: require('./img/movil-nueva-labor.jpg'), ancho: 412, alto: 915 },
  'movil-nuevo-pesaje.jpg': { fuente: require('./img/movil-nuevo-pesaje.jpg'), ancho: 412, alto: 915 },
  'movil-pesajes-con-nuevo.jpg': { fuente: require('./img/movil-pesajes-con-nuevo.jpg'), ancho: 412, alto: 915 },
};
