/**
 * Indicadores del día y avance de campaña (M-010).
 */

import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { ResumenKPIs } from './ResumenKPIs';
import { avanceService } from '../../services/avance.service';
import { pesajesRepo } from '../../db/repositories/pesajes.repo';
import { laboresRepo } from '../../db/repositories/labores.repo';

jest.mock('../../services/avance.service');
jest.mock('../../db/repositories/pesajes.repo');
jest.mock('../../db/repositories/labores.repo');
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, []);
  },
}));

function texto(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(texto).join('');
  return texto((node as { children?: unknown }).children);
}

async function render() {
  let componente!: renderer.ReactTestRenderer;
  await act(async () => {
    componente = renderer.create(
      <PaperProvider>
        <ResumenKPIs />
      </PaperProvider>,
    );
  });
  return texto(componente.toJSON());
}

const campania = { id: 'c', nombre: '2026', fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' };

describe('ResumenKPIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pesajesRepo.getPesajesByFecha as jest.Mock).mockResolvedValue([{ pesoKg: 1500 }, { pesoKg: 3000 }]);
    (laboresRepo.getLaboresFiltered as jest.Mock).mockResolvedValue([{}, {}]);
    (avanceService.kilosPendientes as jest.Mock).mockResolvedValue(0);
  });

  it('muestra lo pesado hoy y el avance contra la meta de la campaña', async () => {
    (avanceService.obtener as jest.Mock).mockResolvedValue({
      avance: { campania, metaKg: 10000, kgCosechados: 4000, cuarteles: [] },
      actualizadoAt: '2026-10-05T12:00:00Z',
    });

    const t = await render();

    expect(t).toMatch(/4[.,]500 kg/);
    expect(t).toContain('Labores hoy');
    expect(t).toContain('Campaña 2026');
    expect(t).toContain('40%');
  });

  it('suma lo pesado sin sincronizar y lo aclara', async () => {
    (avanceService.obtener as jest.Mock).mockResolvedValue({
      avance: { campania, metaKg: 10000, kgCosechados: 4000, cuarteles: [] },
      actualizadoAt: null,
    });
    (avanceService.kilosPendientes as jest.Mock).mockResolvedValue(1000);

    const t = await render();

    expect(t).toContain('50%');
    expect(t).toMatch(/sin sincronizar/);
  });

  it('sin metas cargadas no inventa un porcentaje', async () => {
    (avanceService.obtener as jest.Mock).mockResolvedValue({
      avance: { campania, metaKg: null, kgCosechados: 4000, cuarteles: [] },
      actualizadoAt: '2026-10-05T12:00:00Z',
    });

    const t = await render();

    expect(t).toMatch(/todavía no cargó las metas/);
    expect(t).not.toContain('%');
  });

  it('sin señal y sin dato previo lo dice', async () => {
    (avanceService.obtener as jest.Mock).mockResolvedValue({ avance: null, actualizadoAt: null });
    expect(await render()).toMatch(/se ve con señal/);
  });
});
