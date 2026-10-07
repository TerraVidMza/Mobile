/**
 * Contrato entre los flujos de Maestro y las pantallas — M-013.
 *
 * Los flujos de `.maestro/` dejaron de servir porque buscaban `testID` que no
 * existían. Este test falla si un flujo usa un `id` que ninguna pantalla
 * declara, así un renombre en la app no rompe los E2E sin que nadie se entere.
 */

import * as fs from 'fs';
import * as path from 'path';

const RAIZ = path.resolve(__dirname, '..');

function archivos(dir: string, extensiones: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta, extensiones);
    return extensiones.some((ext) => entrada.name.endsWith(ext)) ? [ruta] : [];
  });
}

function idsDeMaestro(): Map<string, string> {
  const ids = new Map<string, string>();
  for (const flujo of archivos(path.join(RAIZ, '.maestro'), ['.yaml'])) {
    const contenido = fs.readFileSync(flujo, 'utf8');
    for (const [, id] of contenido.matchAll(/^\s*id:\s*"([^"]+)"/gm)) {
      ids.set(id, path.relative(RAIZ, flujo));
    }
  }
  return ids;
}

function testIdsDeLaApp(): Set<string> {
  const ids = new Set<string>();
  for (const fuente of archivos(path.join(RAIZ, 'src'), ['.tsx'])) {
    if (fuente.endsWith('.test.tsx')) continue;
    const contenido = fs.readFileSync(fuente, 'utf8');
    for (const [, id] of contenido.matchAll(/(?:testID|tabBarButtonTestID)[=:]\s*["']([^"']+)["']/g)) {
      ids.add(id);
    }
  }
  return ids;
}

describe('Flujos de Maestro (M-013)', () => {
  it('cada id que usa un flujo existe como testID en la app', () => {
    const declarados = testIdsDeLaApp();
    const faltantes = [...idsDeMaestro()]
      .filter(([id]) => !declarados.has(id))
      .map(([id, flujo]) => `${id} (${flujo})`);

    expect(faltantes).toEqual([]);
  });

  it('los flujos usan ids (si no encuentra ninguno, el test no prueba nada)', () => {
    expect(idsDeMaestro().size).toBeGreaterThan(10);
  });
});
