// Construcción de "vistas" (datos listos para pintar) a partir del motor de KPIs.

import { KPIS, type KpiDef } from "@/config/kpis";
import { isReported, type KpiResult, type WeekRow } from "@/lib/kpis/engine";
import { MONTHS, monthOfWeek, prevWeek, quarterOfWeek, weekKey, weeksInYear } from "@/lib/calendar";
import type { getKpiContext } from "@/lib/data";

type Ctx = Awaited<ReturnType<typeof getKpiContext>>;

/** Última semana con ventas reportadas (por defecto del dashboard). */
export function latestReportedWeek(rows: WeekRow[]): { year: number; week: number } | null {
  const r = rows.filter(isReported).sort((a, b) => weekKey(a.year, a.week) - weekKey(b.year, b.week)).at(-1);
  return r ? { year: r.year, week: r.week } : null;
}

export function resolveWeekParam(rows: WeekRow[], sp: { y?: string; w?: string }) {
  const latest = latestReportedWeek(rows);
  const now = new Date();
  const year = Number(sp.y) || latest?.year || now.getFullYear();
  const week = Number(sp.w) || (Number(sp.y) ? 1 : latest?.week) || 1;
  return { year, week: Math.min(Math.max(week, 1), weeksInYear(year)) };
}

export type KpiWeekView = KpiResult & {
  prevWeekValue: number | null;
  prevYearValue: number | null;
  spark: { label: string; value: number | null }[];
};

export function weekView(ctx: Ctx, year: number, week: number, defs: KpiDef[] = KPIS): KpiWeekView[] {
  const byKey = new Map(ctx.rows.map((r) => [weekKey(r.year, r.week), r]));
  const evalWeek = (y: number, w: number) => {
    const r = byKey.get(weekKey(y, w));
    return r ? ctx.evalRows([r], defs) : null;
  };
  const current = ctx.evalRows(byKey.has(weekKey(year, week)) ? [byKey.get(weekKey(year, week))!] : [], defs);
  const pw = prevWeek(year, week);
  const prev = evalWeek(pw.year, pw.week);
  const prevYear = evalWeek(year - 1, week);

  // Últimas 12 semanas para sparklines
  const sparkWeeks: { year: number; week: number }[] = [];
  let cur = { year, week };
  for (let i = 0; i < 12; i++) {
    sparkWeeks.unshift(cur);
    cur = prevWeek(cur.year, cur.week);
  }
  const sparkEval = sparkWeeks.map((sw) => ({ label: `S${sw.week}`, res: evalWeek(sw.year, sw.week) }));

  return current.map((res, i) => {
    let prevYearValue = prevYear?.[i]?.value ?? null;
    // Sin datos del año anterior en la app: para ventas usamos el dato introducido en la propia semana.
    if (prevYearValue == null && res.key === "sales") prevYearValue = byKey.get(weekKey(year, week))?.sales_prev_year_eur ?? null;
    return {
      ...res,
      prevWeekValue: prev?.[i]?.value ?? null,
      prevYearValue,
      spark: sparkEval.map((s) => ({ label: s.label, value: s.res?.[i]?.value ?? null })),
    };
  });
}

export type PeriodKind = "semana" | "mes" | "trimestre" | "año";

export type PeriodRow = {
  key: string;
  label: string;
  rows: WeekRow[];
  results: KpiResult[];
  prevYearResults: KpiResult[] | null;
  reportedWeeks: number;
};

/** Agrupa las semanas de un año por mes / trimestre / año y evalúa KPIs de cada grupo. */
export function periodView(ctx: Ctx, year: number, kind: Exclude<PeriodKind, "semana">, defs: KpiDef[] = KPIS): PeriodRow[] {
  const ofYear = (y: number) => ctx.rows.filter((r) => r.year === y);
  const groupOf = (r: WeekRow) =>
    kind === "mes" ? monthOfWeek(r.year, r.week) : kind === "trimestre" ? quarterOfWeek(r.year, r.week) : 1;
  const groups = kind === "mes" ? 12 : kind === "trimestre" ? 4 : 1;
  const cur = ofYear(year);
  const prev = ofYear(year - 1);
  const out: PeriodRow[] = [];
  for (let g = 1; g <= groups; g++) {
    const rows = cur.filter((r) => groupOf(r) === g);
    const prevRows = prev.filter((r) => groupOf(r) === g);
    out.push({
      key: String(g),
      label: kind === "mes" ? MONTHS[g - 1] : kind === "trimestre" ? `T${g}` : String(year),
      rows,
      results: ctx.evalRows(rows, defs),
      prevYearResults: prevRows.some(isReported) ? ctx.evalRows(prevRows, defs) : null,
      reportedWeeks: rows.filter(isReported).length,
    });
  }
  return out;
}

/** Serie semanal de un KPI para un año (para gráficos). */
export function weeklySeries(ctx: Ctx, year: number, def: KpiDef, fromWeek = 1, toWeek?: number) {
  const byKey = new Map(ctx.rows.map((r) => [weekKey(r.year, r.week), r]));
  const last = toWeek ?? weeksInYear(year);
  const points = [];
  for (let w = fromWeek; w <= last; w++) {
    const r = byKey.get(weekKey(year, w));
    const res = r ? ctx.evalRows([r], [def])[0] : null;
    const prevRow = byKey.get(weekKey(year - 1, w));
    let prevYear = prevRow ? ctx.evalRows([prevRow], [def])[0].value : null;
    if (prevYear == null && def.key === "sales") prevYear = r?.sales_prev_year_eur ?? null;
    const target = def.direction === "none" ? null : ctx.opts.resolveTarget(def, year, w).value;
    points.push({ label: `S${w}`, week: w, actual: res?.value ?? null, target, prevYear, closed: r?.is_closed ?? false });
  }
  return points;
}

/** Rango de semanas con datos en un año (para recortar gráficos). */
export function dataWeekRange(rows: WeekRow[], year: number): [number, number] | null {
  const ws = rows.filter((r) => r.year === year && (isReported(r) || r.is_closed)).map((r) => r.week);
  if (!ws.length) return null;
  return [Math.min(...ws), Math.max(...ws)];
}
