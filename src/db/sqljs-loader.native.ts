/**
 * En Android / iOS se usa expo-sqlite: sql.js no debe entrar al bundle nativo.
 */

import type { SqlJsStatic } from 'sql.js';

export function cargarSqlJs(): Promise<SqlJsStatic> {
  return Promise.reject(new Error('sql.js solo se usa en la versión web'));
}
