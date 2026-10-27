/**
 * Markdown del manual — M-022.
 *
 * El manual de la app viaja dentro del APK para leerse sin señal. Se escribe
 * en Markdown, igual que el de la Web, pero se interpreta acá con un
 * subconjunto chico: una librería de Markdown para React Native sumaba una
 * dependencia nativa al build por cuatro elementos que se resuelven en
 * cien líneas.
 *
 * Admite: `## sección {permiso}`, `### subtítulo`, párrafos, listas con `-` o
 * `1.`, citas `>` (notas destacadas), imágenes `![texto](archivo.jpg)` en una
 * línea propia y **negrita** dentro del texto.
 */

export type Fragmento = { texto: string; negrita: boolean };

export type Bloque =
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; fragmentos: Fragmento[] }
  | { tipo: 'lista'; numerada: boolean; items: Fragmento[][] }
  | { tipo: 'nota'; fragmentos: Fragmento[] }
  | { tipo: 'imagen'; archivo: string; texto: string };

export interface SeccionManual {
  id: string;
  titulo: string;
  /** Si la sección solo le sirve a quien tiene ese permiso; `null` = a todos. */
  permiso: string | null;
  bloques: Bloque[];
  /** Texto plano en minúsculas y sin tildes, para la búsqueda. */
  buscable: string;
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** `**negrita**` → fragmentos. Un `**` sin cerrar se deja como texto. */
export function fragmentar(linea: string): Fragmento[] {
  const partes = linea.split('**');
  if (partes.length % 2 === 0) return [{ texto: linea, negrita: false }];
  return partes.map((texto, i) => ({ texto, negrita: i % 2 === 1 })).filter((f) => f.texto);
}

const IMAGEN = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const ITEM = /^(-|\d+\.)\s+(.*)$/;
const SECCION = /^##\s+(.+?)(?:\s+\{(\w+)\})?$/;

export function parsearManual(markdown: string): SeccionManual[] {
  const secciones: SeccionManual[] = [];
  let actual: SeccionManual | null = null;
  let parrafo: string[] = [];
  let lista: { numerada: boolean; items: Fragmento[][] } | null = null;
  let crudo: string[] = [];

  const cerrarParrafo = () => {
    if (actual && parrafo.length) {
      actual.bloques.push({ tipo: 'parrafo', fragmentos: fragmentar(parrafo.join(' ')) });
    }
    parrafo = [];
  };
  const cerrarLista = () => {
    if (actual && lista) actual.bloques.push({ tipo: 'lista', ...lista });
    lista = null;
  };
  const cerrarSeccion = () => {
    cerrarParrafo();
    cerrarLista();
    if (actual) {
      actual.buscable = normalizar(`${actual.titulo}\n${crudo.join('\n')}`.replace(/[*#>!\[\]()]/g, ' '));
      secciones.push(actual);
    }
    crudo = [];
  };

  for (const original of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const linea = original.trim();
    const seccion = SECCION.exec(linea);
    if (seccion && !linea.startsWith('###')) {
      cerrarSeccion();
      actual = {
        id: normalizar(seccion[1]).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        titulo: seccion[1].trim(),
        permiso: seccion[2] ?? null,
        bloques: [],
        buscable: '',
      };
      continue;
    }
    if (!actual) continue;
    crudo.push(linea);

    if (!linea) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    if (linea.startsWith('### ')) {
      cerrarParrafo();
      cerrarLista();
      actual.bloques.push({ tipo: 'subtitulo', texto: linea.slice(4).trim() });
      continue;
    }
    const imagen = IMAGEN.exec(linea);
    if (imagen) {
      cerrarParrafo();
      cerrarLista();
      actual.bloques.push({ tipo: 'imagen', texto: imagen[1], archivo: imagen[2].split('/').pop() ?? '' });
      continue;
    }
    if (linea.startsWith('>')) {
      cerrarParrafo();
      cerrarLista();
      const texto = linea.replace(/^>\s?/, '');
      const anterior = actual.bloques[actual.bloques.length - 1];
      // Varias líneas `>` seguidas son una sola nota.
      if (anterior?.tipo === 'nota' && crudo[crudo.length - 2]?.startsWith('>')) {
        anterior.fragmentos.push({ texto: ' ', negrita: false }, ...fragmentar(texto));
      } else {
        actual.bloques.push({ tipo: 'nota', fragmentos: fragmentar(texto) });
      }
      continue;
    }
    const item = ITEM.exec(linea);
    if (item) {
      cerrarParrafo();
      const numerada = item[1] !== '-';
      if (lista && lista.numerada !== numerada) cerrarLista();
      lista ??= { numerada, items: [] };
      lista.items.push(fragmentar(item[2]));
      continue;
    }
    cerrarLista();
    parrafo.push(linea);
  }
  cerrarSeccion();
  return secciones;
}

/** Las secciones que le sirven a quien tiene estos permisos. */
export function seccionesPara(secciones: SeccionManual[], permisos: readonly string[]): SeccionManual[] {
  return secciones.filter((s) => s.permiso === null || permisos.includes(s.permiso));
}

export function buscar(secciones: SeccionManual[], consulta: string): SeccionManual[] {
  const texto = normalizar(consulta);
  if (!texto) return secciones;
  return secciones.filter((s) => s.buscable.includes(texto));
}
