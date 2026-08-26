/**
 * Utilidad de Geolocalización y Auditoría GPS en Campo — TerraVid Mobile.
 * Permite registrar las coordenadas satelitales al capturar labores o pesajes.
 */

export interface CoordenadasGPS {
  latitud: number;
  longitud: number;
  precisionMetros?: number;
  timestamp: string;
}

export async function capturarCoordenadasGPS(): Promise<CoordenadasGPS | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitud: Number(position.coords.latitude.toFixed(6)),
            longitud: Number(position.coords.longitude.toFixed(6)),
            precisionMetros: position.coords.accuracy ? Math.round(position.coords.accuracy) : undefined,
            timestamp: new Date().toISOString(),
          });
        },
        () => {
          // Si el usuario deniega el permiso o no hay señal GPS disponible
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        },
      );
    } catch {
      resolve(null);
    }
  });
}

export function formatearCoordenadas(coords: CoordenadasGPS | null): string {
  if (!coords) return 'Sin datos GPS';
  const precisionStr = coords.precisionMetros ? ` (±${coords.precisionMetros}m)` : '';
  return `${coords.latitud}, ${coords.longitud}${precisionStr}`;
}
