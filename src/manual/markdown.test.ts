import { buscar, fragmentar, parsearManual, seccionesPara } from './markdown';

const MANUAL = `
Texto antes de la primera sección: se ignora.

## Ingresar a la app

Abrí la app y escribí tu **email**.

1. Escribí el email.
2. Tocá **Iniciar sesión**.

![Pantalla de ingreso](img/movil-login.jpg)

> **Importante:** la primera vez necesitás señal.
> Después podés trabajar sin ella.

## Registrar un pesaje {pesajesRegistro}

### Antes de empezar

- Elegí la cuadrilla.
- Cargá los kilos.
`;

describe('parsearManual', () => {
  const secciones = parsearManual(MANUAL);

  it('separa las secciones por ## y lee el permiso entre llaves', () => {
    expect(secciones.map((s) => [s.id, s.titulo, s.permiso])).toEqual([
      ['ingresar-a-la-app', 'Ingresar a la app', null],
      ['registrar-un-pesaje', 'Registrar un pesaje', 'pesajesRegistro'],
    ]);
  });

  it('arma párrafos, listas, imágenes y notas', () => {
    const tipos = secciones[0].bloques.map((b) => b.tipo);
    expect(tipos).toEqual(['parrafo', 'lista', 'imagen', 'nota']);
    expect(secciones[0].bloques[1]).toMatchObject({ numerada: true });
    expect(secciones[0].bloques[2]).toEqual({
      tipo: 'imagen',
      archivo: 'movil-login.jpg',
      texto: 'Pantalla de ingreso',
    });
  });

  it('une en una sola nota las líneas > seguidas', () => {
    const nota = secciones[0].bloques[3];
    expect(nota.tipo).toBe('nota');
    const texto = nota.tipo === 'nota' ? nota.fragmentos.map((f) => f.texto).join('') : '';
    expect(texto).toBe('Importante: la primera vez necesitás señal. Después podés trabajar sin ella.');
  });

  it('reconoce subtítulos y listas con guion', () => {
    expect(secciones[1].bloques.map((b) => b.tipo)).toEqual(['subtitulo', 'lista']);
    expect(secciones[1].bloques[1]).toMatchObject({ numerada: false });
  });
});

describe('fragmentar', () => {
  it('marca la negrita', () => {
    expect(fragmentar('Tocá **Guardar** y listo')).toEqual([
      { texto: 'Tocá ', negrita: false },
      { texto: 'Guardar', negrita: true },
      { texto: ' y listo', negrita: false },
    ]);
  });

  it('deja el texto tal cual si un ** quedó sin cerrar', () => {
    expect(fragmentar('5 ** 2')).toEqual([{ texto: '5 ** 2', negrita: false }]);
  });
});

describe('seccionesPara y buscar', () => {
  const secciones = parsearManual(MANUAL);

  it('oculta lo que el rol no puede hacer', () => {
    expect(seccionesPara(secciones, ['laboresRegistro']).map((s) => s.id)).toEqual(['ingresar-a-la-app']);
    expect(seccionesPara(secciones, ['pesajesRegistro'])).toHaveLength(2);
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(buscar(secciones, 'CUADRILLA').map((s) => s.id)).toEqual(['registrar-un-pesaje']);
    expect(buscar(secciones, 'senal').map((s) => s.id)).toEqual(['ingresar-a-la-app']);
    expect(buscar(secciones, '  ')).toHaveLength(2);
  });
});
