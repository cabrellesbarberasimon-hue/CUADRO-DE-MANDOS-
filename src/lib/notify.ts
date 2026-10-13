// Avisos por email: resumen semanal, KPIs en rojo, recordatorios y acciones vencidas.

import { q } from "@/lib/db/client";
import { getActions, getKpiContext, getSettings, isOverdue } from "@/lib/data";
import { DASHBOARD_KPIS } from "@/config/kpis";
import { STATUS_LABEL, completeness, type KpiResult } from "@/lib/kpis/engine";
import { latestReportedWeek, weekView } from "@/lib/views";
import { emailLayout, emailTable, esc, sendEmail } from "@/lib/email";
import { fmt } from "@/lib/format";
import { currentIsoWeek, prevWeek, weekKey } from "@/lib/calendar";

export type NotifyKind = "weekly_summary" | "red_kpi" | "actions" | "reminder";

export async function recipients(kind: NotifyKind, roles?: string[]): Promise<string[]> {
  const users = await q<{ email: string; role: string; notify: Record<string, boolean> }>(
    `select email, role, notify from users where active = true`,
  );
  const list = users.filter((u) => u.notify?.[kind] !== false && (!roles || roles.includes(u.role))).map((u) => u.email);
  if (kind === "weekly_summary" || kind === "red_kpi") {
    const settings = await getSettings();
    list.push(...(settings.alert_recipients ?? []));
  }
  return list;
}

export async function sendWeeklySummary(year?: number, week?: number) {
  const ctx = await getKpiContext();
  const target = year && week ? { year, week } : latestReportedWeek(ctx.rows);
  if (!target) return { sent: false, error: "No hay semanas con datos" };
  const views = weekView(ctx, target.year, target.week, DASHBOARD_KPIS);
  const actions = (await getActions()).filter((a) => isOverdue(a));
  const table = emailTable(views.map((v) => [v.def.label, fmt(v.value, v.def.unit), STATUS_LABEL[v.status]]));
  const overdue = actions.length
    ? `<h2 style="font-size:15px;margin:20px 0 8px">Acciones vencidas (${actions.length})</h2><ul style="font-size:13px;padding-left:18px">${actions
        .map((a) => `<li>${esc(a.title)} — ${esc(a.owner ?? "sin responsable")} (vencía ${esc(a.due_date ?? "")})</li>`)
        .join("")}</ul>`
    : "";
  const html = emailLayout(`Resumen semana ${target.week} · ${target.year}`, table + overdue);
  return sendEmail(await recipients("weekly_summary", ["admin", "direccion"]), `Bocubi · Resumen semana ${target.week}`, html);
}

/** Avisa si algún KPI del dashboard ha pasado a "Mal" respecto al estado anterior. */
export async function notifyNewRedKpis(year: number, week: number, before: KpiResult[] | null) {
  const ctx = await getKpiContext();
  const row = ctx.rows.find((r) => r.year === year && r.week === week);
  if (!row) return;
  const after = ctx.evalRows([row], DASHBOARD_KPIS);
  const newlyRed = after.filter((r) => r.status === "mal" && before?.find((b) => b.key === r.key)?.status !== "mal");
  if (!newlyRed.length) return;
  const html = emailLayout(
    `KPIs en rojo · semana ${week}`,
    `<p style="font-size:14px">Estos indicadores han pasado a <b style="color:#b4432f">Mal</b>. Recuerda: cada KPI en Mal o Alerta necesita comentario y acción.</p>` +
      emailTable(newlyRed.map((r) => [r.def.label, fmt(r.value, r.def.unit), "Mal"])),
  );
  await sendEmail(await recipients("red_kpi", ["admin", "direccion"]), `Bocubi · KPIs en rojo (semana ${week})`, html);
}

/** Recordatorio a editores si la semana anterior no está cargada o está incompleta. */
export async function sendDataReminder() {
  const ctx = await getKpiContext();
  const now = currentIsoWeek();
  const last = prevWeek(now.year, now.week);
  const row = ctx.rows.find((r) => weekKey(r.year, r.week) === weekKey(last.year, last.week));
  if (row?.is_closed) return { sent: false, error: "Semana cerrada" };
  const pct = row ? completeness(row) : 0;
  if (row && pct >= 0.8) return { sent: false, error: "Semana completa" };
  const html = emailLayout(
    `Faltan datos de la semana ${last.week}`,
    `<p style="font-size:14px">La semana ${last.week} de ${last.year} está ${row ? `al ${Math.round(pct * 100)} %` : "sin cargar"}. Por favor, complétala o importa el Excel antes de la reunión.</p>`,
  );
  return sendEmail(await recipients("reminder", ["admin", "editor"]), `Bocubi · Faltan datos de la semana ${last.week}`, html);
}

export async function sendActionReminders() {
  const actions = await getActions();
  const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const relevant = actions.filter((a) => (a.status === "pendiente" || a.status === "en_curso") && a.due_date && a.due_date <= soon);
  if (!relevant.length) return { sent: false, error: "Nada pendiente" };
  const html = emailLayout(
    "Acciones vencidas o que vencen pronto",
    `<ul style="font-size:13px;padding-left:18px">${relevant
      .map((a) => `<li><b>${esc(a.title)}</b> — ${esc(a.owner ?? "sin responsable")} · ${isOverdue(a) ? "vencida" : "vence"} ${esc(a.due_date ?? "")}</li>`)
      .join("")}</ul>`,
  );
  return sendEmail(await recipients("actions"), "Bocubi · Acciones pendientes", html);
}
