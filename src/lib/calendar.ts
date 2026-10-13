// Semanas ISO (lunes a domingo; la semana 1 es la que contiene el primer jueves del año).
// El mes de una semana es el mes de su JUEVES (convención ISO). Así las semanas que caen entre
// dos meses se asignan siempre a uno solo y el resumen mensual no se descuadra.

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY = 86_400_000;

/** Lunes de la semana ISO (fecha UTC). */
export function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const week1Monday = jan4.getTime() - (dow - 1) * DAY;
  return new Date(week1Monday + (week - 1) * 7 * DAY);
}

export function isoWeekEnd(year: number, week: number): Date {
  return new Date(isoWeekStart(year, week).getTime() + 6 * DAY);
}

export function isoWeekThursday(year: number, week: number): Date {
  return new Date(isoWeekStart(year, week).getTime() + 3 * DAY);
}

/** Mes (1-12) al que pertenece la semana. */
export function monthOfWeek(year: number, week: number): number {
  return isoWeekThursday(year, week).getUTCMonth() + 1;
}

export function quarterOfWeek(year: number, week: number): number {
  return Math.ceil(monthOfWeek(year, week) / 3);
}

export function weeksInYear(year: number): number {
  // Un año tiene 53 semanas si el 28 de diciembre cae en la semana 53.
  return isoWeekOf(new Date(Date.UTC(year, 11, 28))).week;
}

export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart) / DAY + 1) / 7) };
}

export function currentIsoWeek(): { year: number; week: number } {
  return isoWeekOf(new Date());
}

/** Semana anterior (cruza de año si hace falta). */
export function prevWeek(year: number, week: number): { year: number; week: number } {
  if (week > 1) return { year, week: week - 1 };
  return { year: year - 1, week: weeksInYear(year - 1) };
}

export function nextWeek(year: number, week: number): { year: number; week: number } {
  if (week < weeksInYear(year)) return { year, week: week + 1 };
  return { year: year + 1, week: 1 };
}

export const weekKey = (year: number, week: number) => year * 100 + week;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
