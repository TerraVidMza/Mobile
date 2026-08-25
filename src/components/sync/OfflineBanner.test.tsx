/**
 * Pruebas unitarias para OfflineBanner.
 */

import renderer from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { OfflineBanner } from './OfflineBanner';
import { useSyncStore } from '../../stores/sync.store';

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node.children) return getText(node.children);
  return '';
}

describe('OfflineBanner Component', () => {
  beforeEach(() => {
    useSyncStore.setState({ isConnected: true });
  });

  it('no debe renderizar nada cuando el dispositivo está online', () => {
    useSyncStore.setState({ isConnected: true });
    const component = renderer.create(
      <PaperProvider>
        <OfflineBanner />
      </PaperProvider>,
    );

    expect(getText(component.toJSON())).toBe('');
  });

  it('debe renderizar el banner de advertencia cuando el dispositivo pasa a offline', () => {
    useSyncStore.setState({ isConnected: false });
    const component = renderer.create(
      <PaperProvider>
        <OfflineBanner />
      </PaperProvider>,
    );

    const text = getText(component.toJSON());
    expect(text).toContain('Sin conexión a internet');
    expect(text).toContain('Los registros se guardarán en tu dispositivo');
  });
});
