/**
 * Pruebas de ContenidoManual (M-022).
 */

import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { ContenidoManual } from './ContenidoManual';
import { parsearManual } from '../../manual/markdown';

// El `Image` de react-native-web carga la imagen con `window`, que el entorno
// node de Jest no tiene. Para estos tests alcanza con un componente nativo.
jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), Image: 'Image' }));

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node.children) return getText(node.children);
  return '';
}

function dibujar(markdown: string) {
  const [seccion] = parsearManual(markdown);
  let componente!: ReactTestRenderer;
  act(() => {
    componente = renderer.create(
      <PaperProvider>
        <ContenidoManual bloques={seccion.bloques} />
      </PaperProvider>,
    );
  });
  return componente;
}

describe('ContenidoManual', () => {
  it('muestra párrafos, pasos numerados y notas', () => {
    const texto = getText(
      dibujar(`## Prueba
Tocá **Guardar**.

1. Primero.
2. Segundo.

> Queda en el teléfono.`).toJSON(),
    );

    expect(texto).toContain('Tocá Guardar.');
    expect(texto).toContain('1.Primero.');
    expect(texto).toContain('2.Segundo.');
    expect(texto).toContain('Queda en el teléfono.');
  });

  it('dibuja las capturas registradas y omite las que no existen', () => {
    const arbol = dibujar(`## Prueba
![Ingreso](movil-login.jpg)

![No existe](no-esta.jpg)`);

    // La imagen se dibuja recién cuando se conoce el ancho disponible.
    const marcos = arbol.root.findAll((n) => typeof n.props.onLayout === 'function');
    act(() => {
      marcos.forEach((m) => m.props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
    });

    const imagenes = arbol.root.findAll(
      (n) => n.props.accessibilityLabel !== undefined && n.props.source !== undefined,
    );
    expect(imagenes.map((n) => n.props.accessibilityLabel)).toEqual(
      expect.arrayContaining(['Ingreso']),
    );
    expect(imagenes.some((n) => n.props.accessibilityLabel === 'No existe')).toBe(false);
    // 200 de ancho a la proporción de la captura (412 × 915).
    const estilo = Object.assign({}, ...[imagenes[0].props.style].flat(2));
    expect(estilo).toMatchObject({ width: 200, height: (200 * 915) / 412 });
  });
});
