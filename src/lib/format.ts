// Formatos en español de España: 1.234,56 €, 12,5 %, dd/mm/aaaa.

import type { Unit } from "@/config/kpis";
import type { FieldType } from "@/config/fields";

// useGrouping "always": en español Intl no separa miles con 4 cifras (5000 → 5.000).
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);
const eur2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);
const int = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);
const num2 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });

export const SIN_DATO = "Sin dato";

export function fmt(value: number | null | undefined, unit: Unit | FieldType): string {
  if (value == null || Number.isNaN(value)) return SIN_DATO;
  switch (unit) {
    case "eur":
      return Math.abs(value) < 100 && !Number.isInteger(value) ? eur2.format(value) : eur0.format(value);
    case "pct":
      return pct1.format(value);
    case "int":
      return int.format(value);
    case "weeks":
      return `${num2.format(value)} sem.`;
    default:
      return num2.format(value);
  }
}

/** Diferencia con signo (para "vs semana anterior"). En % se expresa en puntos porcentuales. */
export function fmtDelta(value: number | null | undefined, unit: Unit): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (unit === "pct") return `${sign}${num2.format(abs * 100)} p.p.`;
  return `${sign}${fmt(abs, unit)}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" });
}

/** Lee un número escrito en español ("1.234,5", "12,5 %", "1234.5"). */
export function parseNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/[€\s]/g, "");
  if (s === "" || s === "-") return null;
  const isPct = s.endsWith("%");
  s = s.replace("%", "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return isPct ? n / 100 : n;
}
