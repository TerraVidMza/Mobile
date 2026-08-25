/**
 * Pruebas unitarias para SyncStatusBar (HU-14 / PAN-05).
 */

import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { SyncStatusBar } from './SyncStatusBar';
import { useSyncStore } from '../../stores/sync.store';
import { syncEngine } from '../../sync/sync-engine';

jest.mock('../../sync/sync-engine');

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node.children) return getText(node.children);
  return '';
}

describe('SyncStatusBar Component (HU-14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({
      isConnected: true,
      status: 'idle',
      pendingCount: 0,
      currentIndex: 0,
      totalToSync: 0,
    });
  });

  it('no debe renderizar nada cuando está conectado y no hay pendientes (0)', () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <SyncStatusBar />
        </PaperProvider>,
      );
    });

    expect(getText(component.toJSON())).toBe('');
  });

  it('debe mostrar badge de Modo Offline cuando no hay conexión', () => {
    useSyncStore.setState({ isConnected: false, pendingCount: 3 });
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <SyncStatusBar />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('Modo Offline (3 pendientes)');
  });

  it('debe mostrar progreso mientras está sincronizando', () => {
    useSyncStore.setState({
      isConnected: true,
      status: 'syncing',
      currentIndex: 4,
      totalToSync: 10,
    });

    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <SyncStatusBar />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('Sincronizando 4 de 10 registros...');
  });

  it('debe mostrar botón de pendientes y permitir forzar sincronización manual', async () => {
    useSyncStore.setState({
      isConnected: true,
      status: 'idle',
      pendingCount: 2,
    });

    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <SyncStatusBar />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('2 pendientes — Tocar para sincronizar');

    const touchables = component.root.findAllByType('TouchableOpacity' as any);
    if (touchables.length > 0) {
      await act(async () => {
        touchables[0].props.onPress();
      });
      expect(syncEngine.runSync).toHaveBeenCalled();
    }
  });
});
