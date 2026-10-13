import Link from "next/link";
import { AlertTriangle, ClipboardList, Presentation, Printer, Sparkles, Target } from "lucide-react";
import { Card, LinkButton, Notice, PageHeader, StatusBadge, Button, Field } from "@/components/ui";
import { KpiCard } from "@/components/kpi-card";
import { WeekPicker } from "@/components/week-picker";
import { TrendChart } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { can, requireUser } from "@/lib/auth";
import { getActions, getFocus, getKpiContext, getYears, isOverdue, pendingAnalysis } from "@/lib/data";
import { DASHBOARD_KPIS, KPI_BY_KEY } from "@/config/kpis";
import { dataWeekRange, resolveWeekParam, weekView, weeklySeries } from "@/lib/views";
import { completeness, forecastYear, isReported } from "@/lib/kpis/engine";
import { fmt, fmtDateTime } from "@/lib/format";
import { isoWeekEnd, isoWeekStart, weeksInYear } from "@/lib/calendar";
import { fmtDate } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { generateAiSummary, saveAiSummary, saveFocus } from "@/app/actions/business";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ y?: string; w?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = await getKpiContext();
  const { year, week } = resolveWeekParam(ctx.rows, sp);
  const [years, focus, actions, pending] = await Promise.all([getYears(), getFocus(year, week), getActions(), pendingAnalysis(year, week)]);
  const row = ctx.rows.find((r) => r.year === year && r.week === week);
  const views = weekView(ctx, year, week, DASHBOARD_KPIS);
  const overdue = actions.filter((a) => isOverdue(a));
  const filled = row ? completeness(row) : 0;

  // Acumulado del año (hasta la semana seleccionada)
  const ytdRows = ctx.rows.filter((r) => r.year === year && r.week <= week);
  const ytd = ctx.evalRows(ytdRows, [KPI_BY_KEY.sales, KPI_BY_KEY.sales_vs_target, KPI_BY_KEY.sales_vs_prev_year, KPI_BY_KEY.served, KPI_BY_KEY.leads]);
  const [ytdSales, ytdVsTarget, ytdVsPrev, ytdServed, ytdLeads] = ytd;
  const reported = ytdRows.filter(isReported);
  const lastWeek = reported.at(-1)?.week ?? week;
  const remaining = weeksInYear(year) - lastWeek;
  const futureRows = ctx.rows.filter((r) => r.year === year && r.week > lastWeek && r.sales_prev_year_eur != null);
  const prevSoFar = reported.reduce((s, r) => s + (r.sales_prev_year_eur ?? 0), 0) || null;
  const prevRemaining = futureRows.length >= remaining ? futureRows.reduce((s, r) => s + (r.sales_prev_year_eur ?? 0), 0) : null;
  const forecast = forecastYear(reported.map((r) => r.sales_eur as number), remaining, prevRemaining, prevSoFar);
  const annualTarget = Array.from({ length: weeksInYear(year) }, (_, i) => ctx.opts.resolveTarget(KPI_BY_KEY.sales, year, i + 1).value ?? 0)
    .reduce((a, b) => a + b, 0);

  const range = dataWeekRange(ctx.rows, year);
  const series = range ? weeklySeries(ctx, year, KPI_BY_KEY.sales, range[0], Math.max(range[1], week)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard semanal"
        subtitle={`Semana ${week} · ${fmtDate(isoWeekStart(year, week))} – ${fmtDate(isoWeekEnd(year, week))}`}
        actions={
          <>
            <WeekPicker year={year} week={week} years={years} />
            <LinkButton href={`/semana/${year}/${week}`} variant="outline"><ClipboardList size={16} /> Análisis</LinkButton>
            <LinkButton href={`/reunion/${year}/${week}`} variant="primary"><Presentation size={16} /> Reunión</LinkButton>
            <LinkButton href={`/imprimir/semana/${year}/${week}`} variant="ghost"><Printer size={16} /> PDF</LinkButton>
          </>
        }
      />

      {sp.error === "permiso" && <Notice tone="bad">No tienes permiso para acceder a esa sección.</Notice>}

      {/* Alertas */}
      <div className="space-y-2">
        {row?.is_closed && <Notice tone="info">Semana marcada como <b>cerrada</b> (vacaciones o sin actividad): no cuenta para semáforos ni medias.</Notice>}
        {!row && <Notice tone="warn">Esta semana todavía no tiene datos. {can.editData(user) && <Link className="underline" href={`/datos/${year}/${week}`}>Cargar datos</Link>}</Notice>}
        {row && !row.is_closed && filled < 0.8 && (
          <Notice tone="warn">
            Datos incompletos: {Math.round(filled * 100)} % de los campos rellenados.{" "}
            {can.editData(user) && <Link className="underline" href={`/datos/${year}/${week}`}>Completar</Link>}
          </Notice>
        )}
        {pending.length > 0 && (
          <Notice tone="bad">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <b>{pending.length} KPI{pending.length > 1 ? "s" : ""} en Alerta/Mal sin análisis completo</b> (regla: comentario + acción concreta):{" "}
                {pending.map((p) => p.def.label).join(", ")}.{" "}
                <Link className="underline" href={`/semana/${year}/${week}`}>Analizar ahora</Link>
              </div>
            </div>
          </Notice>
        )}
        {overdue.length > 0 && (
          <Notice tone="warn">
            {overdue.length} acción{overdue.length > 1 ? "es" : ""} vencida{overdue.length > 1 ? "s" : ""}. <Link className="underline" href="/acciones?f=vencidas">Ver acciones</Link>
          </Notice>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {views.map((v) => (
          <KpiCard key={v.key} view={v} href={`/semana/${year}/${week}#${v.key}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`Acumulado ${year} (hasta S${week})`} className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between"><dt className="text-muted">Ventas acumuladas</dt><dd className="text-xl font-light tabular-nums">{fmt(ytdSales.value, "eur")}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-muted">Objetivo acumulado</dt><dd className="tabular-nums">{fmt(ytdSales.target.value, "eur")}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">Cumplimiento</dt><dd className="flex items-center gap-2 tabular-nums">{fmt(ytdVsTarget.value, "pct")} <StatusBadge status={ytdVsTarget.status} /></dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted">vs año anterior</dt><dd className="flex items-center gap-2 tabular-nums">{fmt(ytdVsPrev.value, "pct")} <StatusBadge status={ytdVsPrev.status} /></dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-muted">Pedidos servidos</dt><dd className="tabular-nums">{fmt(ytdServed.value, "eur")}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-muted">Leads generados</dt><dd className="tabular-nums">{fmt(ytdLeads.value, "int")}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-muted">Semanas reportadas</dt><dd className="tabular-nums">{reported.length}</dd></div>
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><Target size={14} /> Previsión cierre de año</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Al ritmo de las últimas 8 semanas</dt><dd className="tabular-nums">{fmt(forecast.runRate, "eur")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Estacional (según año anterior)</dt><dd className="tabular-nums">{fmt(forecast.seasonal, "eur")}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Objetivo anual</dt><dd className="tabular-nums">{fmt(annualTarget, "eur")}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">Quedan {remaining} semanas. Las semanas cerradas futuras no se descuentan.</p>
          </div>
        </Card>
        <Card title={`Ventas semanales ${year}`} className="lg:col-span-2">
          <TrendChart data={series} unit="eur" height={320} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Foco semanal">
          <form action={saveFocus} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="week" value={week} />
            <Field label="KPI prioritario">
              <select name="kpi_key" defaultValue={focus?.kpi_key ?? ""} className="input" disabled={!can.manageActions(user)}>
                <option value="">—</option>
                {DASHBOARD_KPIS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Responsable"><input name="owner" defaultValue={focus?.owner ?? ""} className="input" disabled={!can.manageActions(user)} /></Field>
            <div className="sm:col-span-2"><Field label="Problema principal"><textarea name="problem" rows={2} defaultValue={focus?.problem ?? ""} className="input" disabled={!can.manageActions(user)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Acción concreta"><textarea name="action" rows={2} defaultValue={focus?.action ?? ""} className="input" disabled={!can.manageActions(user)} /></Field></div>
            <Field label="Fecha de revisión"><input type="date" name="review_date" defaultValue={focus?.review_date ?? ""} className="input" disabled={!can.manageActions(user)} /></Field>
            {can.manageActions(user) && <div className="flex items-end justify-end"><SubmitButton>Guardar foco</SubmitButton></div>}
          </form>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Sparkles size={14} /> Resumen ejecutivo (IA)</span>}
          actions={
            aiEnabled() && can.manageActions(user) && row ? (
              <form action={generateAiSummary}>
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="week" value={week} />
                <SubmitButton variant="pill">{focus?.ai_summary ? "Regenerar" : "Generar"}</SubmitButton>
              </form>
            ) : null
          }
        >
          {!aiEnabled() ? (
            <p className="text-sm text-muted">Para activarlo, añade la variable <code>ANTHROPIC_API_KEY</code> en Vercel.</p>
          ) : focus?.ai_summary ? (
            <form action={saveAiSummary} className="space-y-2">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="week" value={week} />
              <textarea name="ai_summary" rows={9} defaultValue={focus.ai_summary} className="input leading-relaxed" disabled={!can.manageActions(user)} />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Generado {fmtDateTime(focus.ai_generated_at)} · revísalo antes de usarlo</span>
                {can.manageActions(user) && <Button variant="ghost" type="submit">Guardar cambios</Button>}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted">Pulsa “Generar” para obtener un resumen de qué va bien, qué va mal, posibles causas y acciones sugeridas.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
