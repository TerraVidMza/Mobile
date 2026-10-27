import { MANUAL_APP } from './contenido';
import { IMAGENES } from './imagenes';
import { parsearManual } from './markdown';
import type { PermisoMovil } from '../utils/permisos';

const PERMISOS: PermisoMovil[] = ['appMovil', 'laboresRegistro', 'pesajesRegistro'];

describe('Manual de la app (M-022)', () => {
  const secciones = parsearManual(MANUAL_APP);

  it('tiene secciones', () => {
    expect(secciones.length).toBeGreaterThan(5);
  });

  it('cada captura que nombra está registrada en IMAGENES', () => {
    const faltan = secciones
      .flatMap((s) => s.bloques)
      .flatMap((b) => (b.tipo === 'imagen' ? [b.archivo] : []))
      .filter((archivo) => !IMAGENES[archivo]);
    expect(faltan).toEqual([]);
  });

  it('solo usa permisos que la app conoce', () => {
    const usados = secciones.flatMap((s) => (s.permiso ? [s.permiso] : []));
    expect(usados.filter((p) => !PERMISOS.includes(p as PermisoMovil))).toEqual([]);
  });
});
