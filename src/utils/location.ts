/**
 * Ubicación del teléfono al registrar una labor o un pesaje — M-009 (D-027).
 *
 * Opcional por diseño: si el usuario no da permiso, no hay señal o tarda más
 * de lo razonable, el registro se guarda igual sin coordenadas. Nunca frena la
 * carga en campo.
 *
 * - Android / iOS: `expo-location` (pide el permiso la primera vez).
 * - PWA: `navigator.geolocation`.
 *
 * La versión anterior usaba `navigator.geolocation` también en nativo, donde no
 * existe, y nadie la llamaba.
 *
 * En nativo primero se consulta el permiso y solo se pide si falta (M-016).
 * `requestForegroundPermissionsAsync` le pasa el pedido a Android aunque ya
 * esté concedido; Android 17 no contesta un pedido sin nada que preguntar y la
 * promesa no terminaba nunca, con lo que "Guardar" quedaba cargando.
 */

import { Platform } from 'react-native';

export interface CoordenadasGPS {
  latitud: number;
  longitud: number;
  precisionMetros?: number;
}

const TIEMPO_MAXIMO_MS = 8_000;
/** El diálogo de permiso lo contesta una persona: se le da más tiempo. */
const TIEMPO_MAXIMO_PERMISO_MS = 30_000;

function conTiempoMaximo<T>(promesa: Promise<T>, ms = TIEMPO_MAXIMO_MS): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promesa,
    new Promise<null>((resolve) => {
      temporizador = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(temporizador));
}

const redondear = (n: number) => Number(n.toFixed(7));

async function capturarNativo(): Promise<CoordenadasGPS | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Location = require('expo-location') as typeof import('expo-location');
  const actual = await conTiempoMaximo(Location.getForegroundPermissionsAsync());
  if (!actual) return null;
  if (actual.status !== 'granted') {
    if (!actual.canAskAgain) return null;
    const pedido = await conTiempoMaximo(
      Location.requestForegroundPermissionsAsync(),
      TIEMPO_MAXIMO_PERMISO_MS,
    );
    if (pedido?.status !== 'granted') return null;
  }
  const pos = await conTiempoMaximo(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  );
  if (!pos) return null;
  return {
    latitud: redondear(pos.coords.latitude),
    longitud: redondear(pos.coords.longitude),
    precisionMetros: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
  };
}

function capturarWeb(): Promise<CoordenadasGPS | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitud: redondear(p.coords.latitude),
          longitud: redondear(p.coords.longitude),
          precisionMetros: p.coords.accuracy ? Math.round(p.coords.accuracy) : undefined,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: TIEMPO_MAXIMO_MS, maximumAge: 60_000 },
    );
  });
}

export async function capturarCoordenadasGPS(): Promise<CoordenadasGPS | null> {
  try {
    return Platform.OS === 'web' ? await capturarWeb() : await capturarNativo();
  } catch {
    return null;
  }
}

export function formatearCoordenadas(coords: CoordenadasGPS | null): string {
  if (!coords) return 'Sin datos GPS';
  const precision = coords.precisionMetros ? ` (±${coords.precisionMetros} m)` : '';
  return `${coords.latitud}, ${coords.longitud}${precision}`;
}
