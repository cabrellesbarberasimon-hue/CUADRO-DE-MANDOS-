// Motor de KPIs: funciones puras (sin base de datos) para calcular valores, agregados y semáforos.
// Regla de oro: si falta un dato o el divisor es 0 → null ("Sin dato"), nunca 0 ni error.

import { INPUT_FIELDS, type NumericFieldKey } from "@/config/fields";
import { KPIS, type KpiDef, type Totals } from "@/config/kpis";
import { weekKey } from "@/lib/calendar";

export type WeekRow = Totals & {
  year: number;
  week: number;
  start_date: string | null;
  end_date: string | null;
  is_closed: boolean;
  owner: string | null;
  comment: string | null;
  weekly_action: string | null;
};

export type Status = "bien" | "alerta" | "mal" | "sin_dato" | "cerrada" | "info";

export const STATUS_LABEL: Record<Status, string> = {
  bien: "Bien",
  alerta: "Alerta",
  mal: "Mal",
  sin_dato: "Sin dato",
  cerrada: "Cerrada",
  info: "Informativo",
};

export type Thresholds = {
  /** Mayor es mejor: Alerta si valor ≥ objetivo × alertLow (por defecto 0,85). */
  alertLow: number;
  /** Menor es mejor: Alerta si valor ≤ objetivo × alertHigh (por defecto 1,2). */
  alertHigh: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = { alertLow: 0.85, alertHigh: 1.2 };

export type TargetRow = {
  kpi_key: string;
  year: number | null;
  month: number | null;
  week: number | null;
  value: number;
  value_max: number | null;
};

export type ResolvedTarget = { value: number | null; max: number | null };

export const NUMERIC_KEYS = INPUT_FIELDS.map((f) => f.key) as NumericFieldKey[];
const STOCK_KEYS = new Set<string>(INPUT_FIELDS.filter((f) => "stock" in f && f.stock).map((f) => f.key));

export function emptyTotals(): Totals {
  return Object.fromEntries(NUMERIC_KEYS.map((k) => [k, null])) as Totals;
}

/** Semana con datos de ventas reportados (las que cuentan para objetivos y medias). */
export const isReported = (r: WeekRow) => !r.is_closed && r.sales_eur != null;

/** ¿Tiene la fila algún dato de entrada? */
export const hasAnyData = (r: Partial<WeekRow>) => NUMERIC_KEYS.some((k) => r[k] != null && k !== "sales_prev_year_eur");

/**
 * Agrega varias semanas en un único "Totals":
 * - campos sumables → suma (null si ninguno tiene dato)
 * - campos de stock (cartera pendiente) → último valor disponible
 * - CPL → media ponderada por leads · % conversión landing → media simple
 * - ventas año anterior → solo de las semanas que ya tienen ventas; "sales_matched_eur" = ventas de las
 *   semanas con ambos datos, para que el % vs año anterior compare lo mismo con lo mismo
 * Las semanas cerradas se excluyen.
 */
export function aggregate(rows: WeekRow[]): Totals {
  const open = rows.filter((r) => !r.is_closed).sort((a, b) => weekKey(a.year, a.week) - weekKey(b.year, b.week));
  const t = emptyTotals();
  for (const key of NUMERIC_KEYS) {
    if (key === "cpl_eur" || key === "landing_conversion_pct") continue;
    if (STOCK_KEYS.has(key)) {
      for (const r of open) if (r[key] != null) t[key] = r[key];
      continue;
    }
    const source = key === "sales_prev_year_eur" ? open.filter((r) => r.sales_eur != null) : open;
    let sum: number | null = null;
    for (const r of source) if (r[key] != null) sum = (sum ?? 0) + (r[key] as number);
    t[key] = sum;
  }
  // Ventas comparables con el año anterior: solo semanas con dato en ambos años
  const matched = open.filter((r) => r.sales_eur != null && r.sales_prev_year_eur != null);
  t.sales_matched_eur = matched.length ? matched.reduce((s, r) => s + (r.sales_eur as number), 0) : null;
  // CPL ponderado por leads
  let spend = 0, leads = 0;
  for (const r of open) if (r.cpl_eur != null && r.leads_generated) { spend += r.cpl_eur * r.leads_generated; leads += r.leads_generated; }
  t.cpl_eur = leads > 0 ? spend / leads : (open.find((r) => r.cpl_eur != null)?.cpl_eur ?? null);
  const landing = open.map((r) => r.landing_conversion_pct).filter((v): v is number => v != null);
  t.landing_conversion_pct = landing.length ? landing.reduce((a, b) => a + b, 0) / landing.length : null;
  return t;
}

/** Busca el objetivo vigente: semana > mes > año > general > valor por defecto del KPI. */
export function makeTargetResolver(rows: TargetRow[], monthOf: (y: number, w: number) => number) {
  const byKpi = new Map<string, TargetRow[]>();
  for (const r of rows) {
    const list = byKpi.get(r.kpi_key) ?? [];
    list.push(r);
    byKpi.set(r.kpi_key, list);
  }
  return (kpi: KpiDef, year: number, week: number): ResolvedTarget => {
    const list = byKpi.get(kpi.key) ?? [];
    const month = monthOf(year, week);
    const pick =
      list.find((r) => r.year === year && r.week === week) ??
      list.find((r) => r.year === year && r.month === month && r.week == null) ??
      list.find((r) => r.year == null && r.month === month && r.week == null) ??
      list.find((r) => r.year === year && r.month == null && r.week == null) ??
      list.find((r) => r.year == null && r.month == null && r.week == null);
    if (kpi.fixedTarget) return { value: kpi.defaultTarget ?? null, max: null };
    if (pick) return { value: Number(pick.value), max: pick.value_max == null ? null : Number(pick.value_max) };
    return { value: kpi.defaultTarget ?? null, max: kpi.defaultTargetMax ?? null };
  };
}

export type TargetResolver = ReturnType<typeof makeTargetResolver>;

export function statusOf(def: KpiDef, value: number | null, target: ResolvedTarget, th: Thresholds = DEFAULT_THRESHOLDS): Status {
  if (def.direction === "none") return "info";
  if (value == null || Number.isNaN(value)) return "sin_dato";
  const t = target.value;
  if (t == null) return "info";
  if (def.direction === "range") {
    const min = t;
    const max = target.max ?? t;
    const band = def.alertBand ?? 1;
    if (value >= min && value <= max) return "bien";
    if (value >= min - band && value <= max + band) return "alerta";
    return "mal";
  }
  if (def.direction === "higher") {
    if (value >= t) return "bien";
    const limit = def.alertBand != null ? t - def.alertBand : t * th.alertLow;
    return value >= limit ? "alerta" : "mal";
  }
  // lower
  if (value <= t) return "bien";
  const limit = def.alertBand != null ? t + def.alertBand : t * th.alertHigh;
  return value <= limit ? "alerta" : "mal";
}

export type KpiResult = {
  key: string;
  def: KpiDef;
  value: number | null;
  target: ResolvedTarget;
  status: Status;
};

export type EvalOptions = {
  capacity: number;
  resolveTarget: TargetResolver;
  thresholds: (kpiKey: string) => Thresholds;
};

/**
 * Evalúa todos los KPIs para un conjunto de semanas (1 semana, un mes, el año...).
 * Los objetivos de KPIs sumables (ventas €, leads...) se suman semana a semana sobre las semanas reportadas.
 */
export function evaluate(rows: WeekRow[], opts: EvalOptions, defs: KpiDef[] = KPIS): KpiResult[] {
  const open = rows.filter((r) => !r.is_closed);
  const reported = open.filter(isReported);
  const allClosed = rows.length > 0 && open.length === 0;
  const totals = aggregate(rows);
  const anchor = [...(reported.length ? reported : open.length ? open : rows)].sort(
    (a, b) => weekKey(a.year, a.week) - weekKey(b.year, b.week),
  ).at(-1);

  const targetFor = (def: KpiDef): ResolvedTarget => {
    if (!anchor) return { value: def.defaultTarget ?? null, max: def.defaultTargetMax ?? null };
    if (def.additive && reported.length > 1) {
      let sum: number | null = null;
      for (const r of reported) {
        const t = opts.resolveTarget(def, r.year, r.week).value;
        if (t != null) sum = (sum ?? 0) + t;
      }
      return { value: sum, max: null };
    }
    return opts.resolveTarget(def, anchor.year, anchor.week);
  };

  const salesDef = KPIS.find((k) => k.key === "sales")!;
  const ctx = { capacity: opts.capacity, salesTarget: targetFor(salesDef).value, openWeeks: Math.max(reported.length, 1) };

  return defs.map((def) => {
    const target = targetFor(def);
    if (allClosed) return { key: def.key, def, value: null, target, status: "cerrada" as Status };
    const value = def.compute(totals, ctx);
    return { key: def.key, def, value, target, status: statusOf(def, value, target, opts.thresholds(def.key)) };
  });
}

/** % de campos de entrada rellenados (0-1). */
export function completeness(row: Partial<WeekRow>, keys: readonly string[] = NUMERIC_KEYS): number {
  const relevant = keys.filter((k) => k !== "leads_contacted_24h" && k !== "sales_prev_year_eur");
  const filled = relevant.filter((k) => row[k as NumericFieldKey] != null).length;
  return relevant.length ? filled / relevant.length : 0;
}

/** Previsión de cierre de año para un KPI sumable. */
export function forecastYear(
  reportedValues: number[],
  weeksRemaining: number,
  prevYearRemaining: number | null,
  prevYearSoFar: number | null,
): { runRate: number | null; seasonal: number | null } {
  if (!reportedValues.length) return { runRate: null, seasonal: null };
  const ytd = reportedValues.reduce((a, b) => a + b, 0);
  const last = reportedValues.slice(-8);
  const avg = last.reduce((a, b) => a + b, 0) / last.length;
  const runRate = ytd + avg * weeksRemaining;
  const seasonal =
    prevYearRemaining != null && prevYearSoFar ? ytd + prevYearRemaining * (ytd / prevYearSoFar) : null;
  return { runRate, seasonal };
}
