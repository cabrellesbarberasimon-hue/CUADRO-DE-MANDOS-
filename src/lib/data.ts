// Lectura y escritura de datos de negocio (semanas, objetivos, configuración, auditoría).

import { q, q1 } from "@/lib/db/client";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/db/seed";
import { INPUT_FIELDS, TEXT_FIELDS, type NumericFieldKey } from "@/config/fields";
import { DASHBOARD_KPIS, KPIS } from "@/config/kpis";
import {
  DEFAULT_THRESHOLDS,
  NUMERIC_KEYS,
  evaluate,
  makeTargetResolver,
  type EvalOptions,
  type TargetRow,
  type WeekRow,
} from "@/lib/kpis/engine";
import { isoWeekEnd, isoWeekStart, monthOfWeek, toISODate, weekKey } from "@/lib/calendar";

const WEEK_COLUMNS = ["year", "week", "start_date", "end_date", "is_closed", ...NUMERIC_KEYS, ...TEXT_FIELDS.map((f) => f.key)];

function normalizeRow(r: Record<string, unknown>): WeekRow {
  const row = { ...r } as Record<string, unknown>;
  for (const k of NUMERIC_KEYS) row[k] = row[k] == null ? null : Number(row[k]);
  row.year = Number(row.year);
  row.week = Number(row.week);
  row.is_closed = Boolean(row.is_closed);
  return row as unknown as WeekRow;
}

export async function getWeeks(year?: number): Promise<WeekRow[]> {
  const rows = year
    ? await q(`select ${WEEK_COLUMNS.join(", ")} from weeks where year = $1 order by week`, [year])
    : await q(`select ${WEEK_COLUMNS.join(", ")} from weeks order by year, week`);
  return rows.map(normalizeRow);
}

export async function getWeek(year: number, week: number): Promise<WeekRow | null> {
  const r = await q1(`select ${WEEK_COLUMNS.join(", ")} from weeks where year = $1 and week = $2`, [year, week]);
  return r ? normalizeRow(r) : null;
}

/**
 * Todas las semanas con "ventas año anterior" resuelto automáticamente:
 * si existe la misma semana del año anterior con ventas, se usa ese dato (corrección del Excel).
 */
export async function getAllWeeksResolved(): Promise<WeekRow[]> {
  const rows = await getWeeks();
  const byKey = new Map(rows.map((r) => [weekKey(r.year, r.week), r]));
  return rows.map((r) => {
    const prev = byKey.get(weekKey(r.year - 1, r.week));
    if (prev && prev.sales_eur != null && !prev.is_closed) return { ...r, sales_prev_year_eur: prev.sales_eur };
    return r;
  });
}

export async function getYears(): Promise<number[]> {
  const rows = await q<{ year: number }>(`select distinct year from weeks order by year`);
  return rows.map((r) => Number(r.year));
}

export async function getTargets(): Promise<TargetRow[]> {
  return q<TargetRow>(`select kpi_key, year, month, week, value, value_max from targets`);
}

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ key: string; value: unknown }>(`select key, value from settings`);
  const s = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    let v = r.value;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v); // valores antiguos guardados como texto
      } catch {}
    }
    s[r.key] = v;
  }
  return s as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await q(
    `insert into settings (key, value, updated_at) values ($1, $2::text::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

/** Todo lo necesario para evaluar KPIs. */
export async function getKpiContext() {
  const [rows, targets, settings] = await Promise.all([getAllWeeksResolved(), getTargets(), getSettings()]);
  const resolveTarget = makeTargetResolver(targets, monthOfWeek);
  const opts: EvalOptions = {
    capacity: Number(settings.capacity_eur) || 45000,
    resolveTarget,
    thresholds: (k) => settings.kpi_thresholds?.[k] ?? settings.thresholds ?? DEFAULT_THRESHOLDS,
  };
  const evalRows = (subset: WeekRow[], defs = KPIS) => evaluate(subset, opts, defs);
  return { rows, targets, settings, opts, evalRows };
}

export type WeekInput = Partial<Record<NumericFieldKey, number | null>> & {
  year: number;
  week: number;
  is_closed?: boolean;
  owner?: string | null;
  comment?: string | null;
  weekly_action?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

/**
 * Crea o actualiza una semana. Solo se tocan los campos presentes en `input`.
 * Registra cada cambio en audit_log. Devuelve si la semana era nueva.
 */
export async function upsertWeek(input: WeekInput, userId: number | null, source: "manual" | "import"): Promise<{ created: boolean; changes: number }> {
  const existing = await getWeek(input.year, input.week);
  const editable = ["start_date", "end_date", "is_closed", ...INPUT_FIELDS.map((f) => f.key), ...TEXT_FIELDS.map((f) => f.key)];
  const present = editable.filter((k) => k in input && (input as Record<string, unknown>)[k] !== undefined);
  const data: Record<string, unknown> = {};
  for (const k of present) data[k] = (input as Record<string, unknown>)[k];
  if (!existing) {
    data.start_date ??= toISODate(isoWeekStart(input.year, input.week));
    data.end_date ??= toISODate(isoWeekEnd(input.year, input.week));
  }
  const changed = Object.keys(data).filter((k) => {
    const before = existing ? (existing as Record<string, unknown>)[k] ?? null : null;
    const after = data[k] ?? null;
    return String(before) !== String(after);
  });
  if (existing && changed.length === 0) return { created: false, changes: 0 };

  const cols = ["year", "week", ...Object.keys(data), "data_source", "updated_by"];
  const vals = [input.year, input.week, ...Object.values(data), source, userId];
  const updates = [...Object.keys(data), "data_source", "updated_by"].map((c) => `${c} = excluded.${c}`).join(", ");
  await q(
    `insert into weeks (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})
     on conflict (year, week) do update set ${updates}, updated_at = now()`,
    vals,
  );
  for (const k of changed) {
    const before = existing ? (existing as Record<string, unknown>)[k] : null;
    await q(
      `insert into audit_log (entity, entity_key, field, old_value, new_value, user_id, source) values ('week', $1, $2, $3, $4, $5, $6)`,
      [`${input.year}-${input.week}`, k, before == null ? null : String(before), data[k] == null ? null : String(data[k]), userId, source],
    );
  }
  return { created: !existing, changes: changed.length };
}

export async function getAudit(entity: string, key: string) {
  return q<{ field: string; old_value: string | null; new_value: string | null; source: string; created_at: string; user_name: string | null }>(
    `select a.field, a.old_value, a.new_value, a.source, a.created_at, u.name as user_name
     from audit_log a left join users u on u.id = a.user_id
     where a.entity = $1 and a.entity_key = $2 order by a.created_at desc limit 200`,
    [entity, key],
  );
}

// ───────────── Foco semanal, comentarios y acciones

export type Focus = {
  year: number; week: number; kpi_key: string | null; problem: string | null; action: string | null;
  owner: string | null; review_date: string | null; ai_summary: string | null; ai_generated_at: string | null;
};

export async function getFocus(year: number, week: number): Promise<Focus | null> {
  return q1<Focus>(`select * from weekly_focus where year = $1 and week = $2`, [year, week]);
}

export type KpiComment = { id: number; year: number; week: number; kpi_key: string; text: string; created_at: string; author: string | null };

export async function getComments(year: number, week: number): Promise<KpiComment[]> {
  return q<KpiComment>(
    `select c.id, c.year, c.week, c.kpi_key, c.text, c.created_at, u.name as author
     from kpi_comments c left join users u on u.id = c.author_id
     where c.year = $1 and c.week = $2 order by c.created_at`,
    [year, week],
  );
}

export type Action = {
  id: number; title: string; description: string | null; kpi_key: string | null; year: number | null; week: number | null;
  owner: string | null; due_date: string | null; priority: string; status: string; result: string | null;
  closed_at: string | null; created_at: string; updated_at: string; created_by_name: string | null;
};

export const ACTION_STATUSES = [
  { key: "pendiente", label: "Pendiente" },
  { key: "en_curso", label: "En curso" },
  { key: "hecha", label: "Hecha" },
  { key: "descartada", label: "Descartada" },
] as const;

export async function getActions(filter: { year?: number; week?: number; kpi?: string } = {}): Promise<Action[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.year != null) { params.push(filter.year); where.push(`a.year = $${params.length}`); }
  if (filter.week != null) { params.push(filter.week); where.push(`a.week = $${params.length}`); }
  if (filter.kpi) { params.push(filter.kpi); where.push(`a.kpi_key = $${params.length}`); }
  return q<Action>(
    `select a.*, u.name as created_by_name from actions a left join users u on u.id = a.created_by
     ${where.length ? "where " + where.join(" and ") : ""}
     order by case a.status when 'en_curso' then 0 when 'pendiente' then 1 when 'hecha' then 2 else 3 end, a.due_date nulls last, a.id desc`,
    params,
  );
}

export function isOverdue(a: Pick<Action, "status" | "due_date">, today = toISODate(new Date())) {
  return (a.status === "pendiente" || a.status === "en_curso") && !!a.due_date && a.due_date < today;
}

/** KPIs en Alerta/Mal de una semana que aún no tienen comentario + acción (regla clave). */
export async function pendingAnalysis(year: number, week: number) {
  const ctx = await getKpiContext();
  const rows = ctx.rows.filter((r) => r.year === year && r.week === week);
  if (!rows.length) return [];
  const results = ctx.evalRows(rows, DASHBOARD_KPIS).filter((r) => r.status === "mal" || r.status === "alerta");
  const [comments, actions] = await Promise.all([getComments(year, week), getActions({ year, week })]);
  return results
    .map((r) => ({
      ...r,
      hasComment: comments.some((c) => c.kpi_key === r.key),
      hasAction: actions.some((a) => a.kpi_key === r.key),
    }))
    .filter((r) => !r.hasComment || !r.hasAction);
}
