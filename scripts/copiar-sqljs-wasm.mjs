// Copia el binario WebAssembly de sql.js a `public/sqljs/` para que la PWA lo
// sirva como archivo estático (M-001). Corre en `postinstall`, así la versión del
// `.wasm` siempre coincide con la del JS instalado.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');
const destino = join(raiz, 'public', 'sqljs');

mkdirSync(destino, { recursive: true });
copyFileSync(origen, join(destino, 'sql-wasm-browser.wasm'));
