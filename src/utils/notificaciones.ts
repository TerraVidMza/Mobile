/**
 * A qué pantalla de la app lleva una notificación (HU-35, M-006).
 *
 * `urlAccion` la arma el backend pensando en la Web (`/remitos/:id`,
 * `/telemetria/alertas`, …). La app solo tiene labores, pesajes y avisos: lo
 * que no tiene equivalente queda en la lista de avisos.
 */
export function rutaDeAccion(urlAccion: string | null | undefined): string | null {
  if (!urlAccion) return null;
  const ruta = urlAccion.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (ruta.startsWith('/labores') || ruta.includes('/registro-labor')) return '/(tabs)/labores';
  if (ruta.startsWith('/pesaje') || ruta.includes('/pesajes')) return '/(tabs)/pesaje';
  return null;
}
