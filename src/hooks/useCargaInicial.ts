/**
 * Hook de carga inicial de una pantalla (M-021).
 *
 * Ejecuta `cargar` al montar y devuelve `true` mientras corre. Aunque la
 * carga falle (por ejemplo, la base local), la pantalla sale del estado de
 * carga en lugar de quedar con el indicador para siempre.
 */

import { useEffect, useState } from 'react';

export function useCargaInicial(cargar: () => Promise<unknown>): boolean {
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        await cargar();
      } catch {
        // La pantalla sigue con lo que haya; el aviso de catálogos
        // incompletos (M-016) le indica al usuario que falta sincronizar.
      } finally {
        setCargando(false);
      }
    }
    void init();
  }, [cargar]);

  return cargando;
}
