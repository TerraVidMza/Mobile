/**
 * Pruebas unitarias para el componente ResumenKPIs.
 */

import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { ResumenKPIs } from './ResumenKPIs';
import { useThemeStore } from '../../stores/theme.store';
import { generarBackupJson } from '../../utils/backup';

jest.mock('../../utils/backup');

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node.children) return getText(node.children);
  return '';
}

describe('ResumenKPIs Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useThemeStore.setState({ mode: 'default' });
  });

  it('debe renderizar los KPIs diarios y el progreso de cosecha', () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <ResumenKPIs kilosHoy={4500} metaKilos={10000} laboresHoy={6} pendientesSync={0} />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('Resumen Diario de Cosecha');
    expect(text).toMatch(/4[.,]500 kg/);
    expect(text).toContain('6');
    expect(text).toContain('45%');
    expect(text).toContain('Todo sincronizado');
  });

  it('debe mostrar advertencia de pendientes de sincronización cuando corresponda', () => {
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <ResumenKPIs kilosHoy={1200} metaKilos={5000} laboresHoy={2} pendientesSync={3} />
        </PaperProvider>,
      );
    });

    const text = getText(component.toJSON());
    expect(text).toContain('3 pendientes de sincronizar');
  });

  it('debe disparar la generación de backup local al presionar el botón', async () => {
    (generarBackupJson as jest.Mock).mockResolvedValue({
      totalLabores: 4,
      totalPesajes: 8,
    });

    const onExportSuccess = jest.fn();
    let component: any;
    act(() => {
      component = renderer.create(
        <PaperProvider>
          <ResumenKPIs onExportSuccess={onExportSuccess} />
        </PaperProvider>,
      );
    });

    const buttons = component.root.findAll((n: any) => typeof n.props?.onPress === 'function');
    const backupBtn = buttons.find((b: any) => b.props?.accessibilityLabel === 'Generar Respaldo Local');
    expect(backupBtn).toBeDefined();

    await act(async () => {
      await backupBtn.props.onPress();
    });

    expect(generarBackupJson).toHaveBeenCalled();
    expect(onExportSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Respaldo generado con 4 labores y 8 pesajes'),
    );
  });
});
