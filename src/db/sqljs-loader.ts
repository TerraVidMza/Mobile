/**
 * Carga de sql.js para Node (tests con Jest).
 *
 * Jest no resuelve extensiones por plataforma, así que este archivo es el que
 * usan los tests: el build de Node de sql.js encuentra el `.wasm` solo dentro de
 * `node_modules`. El navegador usa `sqljs-loader.web.ts` y la app nativa
 * `sqljs-loader.native.ts` (M-001).
 */

import type { SqlJsStatic } from 'sql.js';

let _sqlJs: Promise<SqlJsStatic> | null = null;

export function cargarSqlJs(): Promise<SqlJsStatic> {
  if (!_sqlJs) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const initSqlJs = require('sql.js') as (config?: object) => Promise<SqlJsStatic>;
    _sqlJs = initSqlJs();
  }
  return _sqlJs;
}
