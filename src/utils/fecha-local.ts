/**
 * Equivalente a fechaLocal() / hoyLocal() del backend (D-009).
 *
 * Las columnas `date` del sistema representan "el día de trabajo en la finca",
 * que es local. Se calcula en la zona horaria del dispositivo (que estará en
 * la finca) y se transmite como ISO date (YYYY-MM-DD).
 *
 * NUNCA usar toISOString().slice(0, 10) — eso da la fecha en UTC y puede
 * diferir del día local durante las horas de la noche.
 */

/**
 * Retorna la fecha local del dispositivo en formato ISO (YYYY-MM-DD).
 * Este es el formato que el backend espera para las columnas `date`.
 */
export function hoyLocal(): string {
  return fechaLocal(new Date());
}

/**
 * Formatea una Date como fecha local ISO (YYYY-MM-DD).
 *
 * @param date - La fecha a formatear.
 * @returns String en formato YYYY-MM-DD representando el día local.
 */
export function fechaLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna el timestamp actual en ISO 8601 con timezone offset.
 * Usado para `createdAtLocal` de los registros offline (HU-14).
 *
 * Ejemplo: "2026-08-25T14:30:00-03:00"
 */
export function timestampLocal(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${h}:${m}:${s}${sign}${hours}:${minutes}`;
}
