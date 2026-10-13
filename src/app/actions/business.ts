"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { q } from "@/lib/db/client";
import { can, requireUser } from "@/lib/auth";
import { getActions, getFocus, getKpiContext, upsertWeek } from "@/lib/data";
import { INPUT_FIELDS, TEXT_FIELDS } from "@/config/fields";
import { DASHBOARD_KPIS } from "@/config/kpis";
import { parseNumber } from "@/lib/format";
import { aiEnabled, generateWeeklySummary } from "@/lib/ai";
import { weekView } from "@/lib/views";
import { notifyNewRedKpis, sendWeeklySummary } from "@/lib/notify";
import type { FormState } from "./auth";

const str = (form: FormData, k: string) => {
  const v = form.get(k);
  return v == null ? null : String(v).trim() || null;
};

// ───────────── Semanas

export async function saveWeek(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(can.editData);
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  if (!year || !week) return { error: "Semana no válida." };
  const input: Record<string, unknown> = { year, week, is_closed: form.get("is_closed") === "on" };
  for (const f of INPUT_FIELDS) {
    if (!form.has(f.key)) continue;
    const raw = form.get(f.key);
    let n = parseNumber(raw);
    if (n != null && f.type === "pct" && !String(raw).includes("%")) n = n / 100; // en el formulario se escribe 25 para 25 %
    if (n != null && n < 0) return { error: `"${f.label}" no puede ser negativo.` };
    if (n != null && f.type === "pct" && n > 1) return { error: `"${f.label}" debe estar entre 0 y 100 %.` };
    input[f.key] = n;
  }
  for (const f of TEXT_FIELDS) if (form.has(f.key)) input[f.key] = str(form, f.key);
  const before = await statusesOf(year, week);
  const res = await upsertWeek(input as never, user.id, "manual");
  await notifyNewRedKpis(year, week, before).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: res.changes ? `Semana ${week} guardada (${res.changes} cambios).` : "No había cambios." };
}

async function statusesOf(year: number, week: number) {
  const ctx = await getKpiContext();
  const row = ctx.rows.find((r) => r.year === year && r.week === week);
  return row ? ctx.evalRows([row], DASHBOARD_KPIS) : null;
}

/** Guardado rápido de una celda desde la tabla de datos. */
export async function saveCell(year: number, week: number, field: string, raw: string): Promise<{ error?: string; value?: number | string | null }> {
  const user = await requireUser(can.editData);
  const f = INPUT_FIELDS.find((x) => x.key === field);
  const t = TEXT_FIELDS.find((x) => x.key === field);
  if (!f && !t && field !== "is_closed") return { error: "Campo no válido" };
  let value: number | string | boolean | null;
  if (field === "is_closed") value = raw === "true";
  else if (t) value = raw.trim() || null;
  else {
    let n = parseNumber(raw);
    if (n != null && f!.type === "pct" && !raw.includes("%")) n = n / 100;
    if (n != null && n < 0) return { error: "No puede ser negativo" };
    if (n != null && f!.type === "pct" && n > 1) return { error: "Debe estar entre 0 y 100 %" };
    value = n;
  }
  const before = await statusesOf(year, week);
  await upsertWeek({ year, week, [field]: value } as never, user.id, "manual");
  await notifyNewRedKpis(year, week, before).catch(() => {});
  revalidatePath("/", "layout");
  return { value: typeof value === "boolean" ? String(value) : value };
}

// ───────────── Foco semanal e IA

export async function saveFocus(form: FormData) {
  const user = await requireUser(can.manageActions);
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  await q(
    `insert into weekly_focus (year, week, kpi_key, problem, action, owner, review_date, updated_by, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())
     on conflict (year, week) do update set kpi_key = excluded.kpi_key, problem = excluded.problem, action = excluded.action,
       owner = excluded.owner, review_date = excluded.review_date, updated_by = excluded.updated_by, updated_at = now()`,
    [year, week, str(form, "kpi_key"), str(form, "problem"), str(form, "action"), str(form, "owner"), str(form, "review_date"), user.id],
  );
  revalidatePath("/", "layout");
}

export async function generateAiSummary(form: FormData) {
  const user = await requireUser(can.manageActions);
  if (!aiEnabled()) return;
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  const ctx = await getKpiContext();
  const views = weekView(ctx, year, week, DASHBOARD_KPIS);
  const openActions = (await getActions()).filter((a) => a.status === "pendiente" || a.status === "en_curso");
  const row = ctx.rows.find((r) => r.year === year && r.week === week);
  let summary: string;
  try {
    summary = await generateWeeklySummary({ year, week, views, openActions, comment: row?.comment });
  } catch (e) {
    summary = `No se ha podido generar el resumen: ${e instanceof Error ? e.message : "error desconocido"}`;
  }
  await q(
    `insert into weekly_focus (year, week, ai_summary, ai_generated_at, updated_by) values ($1,$2,$3, now(), $4)
     on conflict (year, week) do update set ai_summary = excluded.ai_summary, ai_generated_at = now(), updated_by = excluded.updated_by`,
    [year, week, summary, user.id],
  );
  revalidatePath("/", "layout");
}

export async function saveAiSummary(form: FormData) {
  const user = await requireUser(can.manageActions);
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  const existing = await getFocus(year, week);
  if (!existing) return;
  await q(`update weekly_focus set ai_summary = $3, updated_by = $4, updated_at = now() where year = $1 and week = $2`, [
    year, week, str(form, "ai_summary"), user.id,
  ]);
  revalidatePath("/", "layout");
}

// ───────────── Comentarios por KPI

export async function addComment(form: FormData) {
  const user = await requireUser(can.comment);
  const text = str(form, "text");
  if (!text) return;
  await q(`insert into kpi_comments (year, week, kpi_key, text, author_id) values ($1,$2,$3,$4,$5)`, [
    Number(form.get("year")), Number(form.get("week")), String(form.get("kpi_key")), text, user.id,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteComment(form: FormData) {
  const user = await requireUser(can.comment);
  const id = Number(form.get("id"));
  if (user.role === "admin") await q(`delete from kpi_comments where id = $1`, [id]);
  else await q(`delete from kpi_comments where id = $1 and author_id = $2`, [id, user.id]);
  revalidatePath("/", "layout");
}

// ───────────── Plan de acción

const actionSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio"),
  description: z.string().trim().optional(),
  kpi_key: z.string().optional(),
  year: z.coerce.number().int().optional(),
  week: z.coerce.number().int().optional(),
  owner: z.string().trim().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["alta", "media", "baja"]).default("media"),
});

export async function createAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(can.manageActions);
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => v !== ""));
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await q(
    `insert into actions (title, description, kpi_key, year, week, owner, due_date, priority, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [d.title, d.description ?? null, d.kpi_key ?? null, d.year ?? null, d.week ?? null, d.owner ?? null, d.due_date ?? null, d.priority, user.id],
  );
  revalidatePath("/", "layout");
  return { ok: "Acción creada." };
}

export async function updateAction(form: FormData) {
  const user = await requireUser(can.manageActions);
  const id = Number(form.get("id"));
  const status = str(form, "status");
  const sets: string[] = [];
  const params: unknown[] = [id];
  const add = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  for (const col of ["title", "description", "owner", "due_date", "priority", "result"]) if (form.has(col)) add(col, str(form, col));
  if (status) {
    add("status", status);
    sets.push(status === "hecha" || status === "descartada" ? "closed_at = coalesce(closed_at, now())" : "closed_at = null");
  }
  if (!sets.length) return;
  await q(`update actions set ${sets.join(", ")}, updated_at = now() where id = $1`, params);
  await q(`insert into audit_log (entity, entity_key, field, new_value, user_id, source) values ('action', $1, 'update', $2, $3, 'manual')`, [
    String(id), status ?? "edición", user.id,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteAction(form: FormData) {
  await requireUser(can.runMeeting);
  await q(`delete from actions where id = $1`, [Number(form.get("id"))]);
  revalidatePath("/", "layout");
}

// ───────────── Reunión semanal

export async function saveMeeting(form: FormData) {
  const user = await requireUser(can.manageActions);
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  await q(
    `insert into meetings (year, week, attendees, notes, created_by) values ($1,$2,$3,$4,$5)
     on conflict (year, week) do update set attendees = excluded.attendees, notes = excluded.notes, updated_at = now()`,
    [year, week, str(form, "attendees"), str(form, "notes"), user.id],
  );
  revalidatePath("/", "layout");
}

export async function sendSummaryNow(form: FormData) {
  await requireUser(can.runMeeting);
  const year = Number(form.get("year"));
  const week = Number(form.get("week"));
  const res = await sendWeeklySummary(year, week);
  redirect(`/reunion/${year}/${week}?email=${res.sent ? "ok" : encodeURIComponent(res.error ?? "error")}`);
}
