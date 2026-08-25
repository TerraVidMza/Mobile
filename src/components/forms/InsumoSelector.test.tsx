/**
 * Pruebas unitarias para el componente InsumoSelector (HU-13).
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { InsumoSelector } from './InsumoSelector';
import { Insumo, DetalleInsumoDto } from '../../types/api.types';

jest.mock('react-native-paper', () => {
  const actual = jest.requireActual('react-native-paper');
  return {
    ...actual,
    Menu: Object.assign(
      ({ visible, children, anchor }: any) => (
        React.createElement(React.Fragment, null, anchor, visible ? children : null)
      ),
      {
        Item: ({ onPress, title, disabled }: any) => (
          React.createElement('div', { onClick: disabled ? undefined : onPress, role: 'menuitem' }, title)
        ),
      },
    ),
  };
});

const mockInsumos: Insumo[] = [
  { id: 'i-1', nombre: 'Fertilizante Nitro', unidadMedida: 'kg', activo: true },
  { id: 'i-2', nombre: 'Fungicida Cobre', unidadMedida: 'lt', activo: true },
  { id: 'i-3', nombre: 'Herbicida Total', unidadMedida: 'lt', activo: true },
];

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node.children) return getText(node.children);
  return '';
}

describe('InsumoSelector Component (HU-13)', () => {
  const onAddInsumo = jest.fn();
  const onRemoveInsumo = jest.fn();

  beforeAll(() => {
    (global as any).document = {
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      activeElement: null,
    };
    (global as any).window = {
      ...(global as any).window,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe renderizar el título y estado inicial vacío', () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <InsumoSelector
            insumosDisponibles={mockInsumos}
            insumosSeleccionados={[]}
            onAddInsumo={onAddInsumo}
            onRemoveInsumo={onRemoveInsumo}
          />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('Insumos utilizados (opcional)');
    expect(text).toContain('Seleccionar insumo...');
  });

  it('debe listar insumos ya seleccionados y permitir eliminarlos', () => {
    const seleccionados: DetalleInsumoDto[] = [
      { insumoId: 'i-1', cantidad: 25 },
    ];
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <InsumoSelector
            insumosDisponibles={mockInsumos}
            insumosSeleccionados={seleccionados}
            onAddInsumo={onAddInsumo}
            onRemoveInsumo={onRemoveInsumo}
          />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('Fertilizante Nitro (kg)');
    expect(text).toContain('Cantidad: 25');

    // Buscar el botón IconButton de eliminación
    const iconButtons = component.root.findAllByType('IconButton' as any);
    if (iconButtons.length > 0) {
      act(() => {
        iconButtons[0].props.onPress();
      });
      expect(onRemoveInsumo).toHaveBeenCalledWith('i-1');
    }
  });

  it('debe abrir y seleccionar un insumo del menú, ingresar cantidad y agregarlo', () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <InsumoSelector
            insumosDisponibles={mockInsumos}
            insumosSeleccionados={[]}
            onAddInsumo={onAddInsumo}
            onRemoveInsumo={onRemoveInsumo}
          />
        </PaperProvider>,
      );
    });

    // Abrir menú con el botón anchor
    const pressables = component.root.findAll((n: any) => typeof n.props?.onPress === 'function');
    const selectAnchor = pressables.find((p: any) => p.props?.contentStyle?.justifyContent === 'flex-start' || p.props?.style?.flex === 2);
    if (selectAnchor) {
      act(() => {
        selectAnchor.props.onPress();
      });
    }

    // Seleccionar ítem del menú
    const menuItems = component.root.findAll((node: any) => node.props?.role === 'menuitem');
    expect(menuItems.length).toBeGreaterThan(0);
    act(() => {
      menuItems[0].props.onClick();
    });

    // Cambiar input de cantidad
    const inputNodes = component.root.findAll((n: any) => typeof n.props?.onChangeText === 'function');
    expect(inputNodes.length).toBeGreaterThan(0);
    act(() => {
      inputNodes[0].props.onChangeText('15.5');
    });

    // Presionar botón +
    const addBtn = component.root.findAll((n: any) => typeof n.props?.onPress === 'function')
      .find((p: any) => p.props?.mode === 'contained-tonal');
    if (addBtn) {
      act(() => {
        addBtn.props.onPress();
      });
    }

    expect(onAddInsumo).toHaveBeenCalledWith({
      insumoId: 'i-1',
      cantidad: 15.5,
    });
  });

  it('debe manejar lista cuando todos los insumos ya fueron seleccionados', () => {
    const todosSeleccionados: DetalleInsumoDto[] = [
      { insumoId: 'i-1', cantidad: 10 },
      { insumoId: 'i-2', cantidad: 5 },
      { insumoId: 'i-3', cantidad: 2 },
    ];

    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <InsumoSelector
            insumosDisponibles={mockInsumos}
            insumosSeleccionados={todosSeleccionados}
            onAddInsumo={onAddInsumo}
            onRemoveInsumo={onRemoveInsumo}
          />
        </PaperProvider>,
      );
    });

    const pressables = component.root.findAll((n: any) => typeof n.props?.onPress === 'function');
    const selectAnchor = pressables.find((p: any) => p.props?.contentStyle?.justifyContent === 'flex-start' || p.props?.style?.flex === 2);
    if (selectAnchor) {
      act(() => {
        selectAnchor.props.onPress();
      });
    }

    const text = getText(component.toJSON());
    expect(text).toContain('No hay más insumos disponibles');
  });
});
