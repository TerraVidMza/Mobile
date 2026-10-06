/**
 * Carga de sql.js en el navegador (PWA).
 *
 * Usa el build `sql-wasm-browser`, que no referencia módulos de Node (`fs`,
 * `path`) y Metro lo empaqueta sin configuración extra. El `.wasm` se sirve
 * desde `public/sqljs/`, adonde lo copia `scripts/copiar-sqljs-wasm.mjs` en el
 * `postinstall` (M-001).
 */

import type { SqlJsStatic } from 'sql.js';

let _sqlJs: Promise<SqlJsStatic> | null = null;

export function cargarSqlJs(): Promise<SqlJsStatic> {
  if (!_sqlJs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const initSqlJs = require('sql.js/dist/sql-wasm-browser.js') as (config?: object) => Promise<SqlJsStatic>;
    _sqlJs = initSqlJs({ locateFile: (archivo: string) => `/sqljs/${archivo}` });
  }
  return _sqlJs;
}
