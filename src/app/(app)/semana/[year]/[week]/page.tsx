import Link from "next/link";
import clsx from "clsx";
import { Card, Notice, PageHeader, StatusBadge, LinkButton } from "@/components/ui";
import { WeekPicker } from "@/components/week-picker";
import { ActionForm } from "@/components/action-form";
import { ActionItem } from "@/components/action-item";
import { SubmitButton } from "@/components/forms";
import { can, requireUser } from "@/lib/auth";
import { getActions, getComments, getKpiContext, getYears } from "@/lib/data";
import { AREAS } from "@/config/areas";
import { KPIS } from "@/config/kpis";
import { weekView } from "@/lib/views";
import { fmt, fmtDateTime } from "@/lib/format";
import { addComment, deleteComment } from "@/app/actions/business";
import { Trash2 } from "lucide-react";

export default async function WeekAnalysis({ params }: { params: Promise<{ year: string; week: string }> }) {
  const p = await params;
  const year = Number(p.year);
  const week = Number(p.week);
  const user = await requireUser();
  const ctx = await getKpiContext();
  const [years, comments, actions] = await Promise.all([getYears(), getComments(year, week), getActions({ year, week })]);
  const views = weekView(ctx, year, week, KPIS.filter((k) => k.direction !== "none"));
  const row = ctx.rows.find((r) => r.year === year && r.week === week);
  const owners = ctx.settings.area_owners ?? {};
  const needs = views.filter((v) => v.status === "mal" || v.status === "alerta");
  const incomplete = needs.filter((v) => !comments.some((c) => c.kpi_key === v.key) || !actions.some((a) => a.kpi_key === v.key));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Análisis · semana ${week}`}
        subtitle="Regla clave: si un KPI está en Mal o Alerta, debe tener comentario y acción concreta. Dato → decisión."
        actions={
          <>
            <WeekPicker year={year} week={week} years={years} basePath="/semana" />
            <LinkButton href={`/?y=${year}&w=${week}`} variant="ghost">Dashboard</LinkButton>
          </>
        }
      />
      {!row && <Notice tone="warn">Esta semana no tiene datos.</Notice>}
      {row && (incomplete.length ? (
        <Notice tone="bad">Faltan por analizar {incomplete.length} de {needs.length} KPIs en Alerta/Mal.</Notice>
      ) : needs.length ? (
        <Notice tone="ok">Todos los KPIs en Alerta/Mal tienen comentario y acción. ✔</Notice>
      ) : (
        <Notice tone="ok">Ningún KPI en Alerta o Mal esta semana.</Notice>
      ))}

      {AREAS.map((area) => {
        const list = views.filter((v) => v.def.area === area.key);
        if (!list.length) return null;
        return (
          <Card key={area.key} title={`${area.label} · resp. ${owners[area.key] ?? area.defaultOwner}`}>
            <div className="divide-y divide-line">
              {list.map((v) => {
                const kComments = comments.filter((c) => c.kpi_key === v.key);
                const kActions = actions.filter((a) => a.kpi_key === v.key);
                const flagged = (v.status === "mal" || v.status === "alerta") && (!kComments.length || !kActions.length);
                return (
                  <div key={v.key} id={v.key} className={clsx("grid scroll-mt-24 grid-cols-1 gap-4 py-4 lg:grid-cols-[280px_1fr_1fr]", flagged && "bg-bad-bg/30 -mx-5 px-5")}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{v.def.label}</h3>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="mt-1 text-2xl font-light tabular-nums">{fmt(v.value, v.def.unit)}</div>
                      <div className="text-xs text-muted">
                        Objetivo {v.def.direction === "range" ? `${fmt(v.target.value, "num")}–${fmt(v.target.max, "num")} sem.` : fmt(v.target.value, v.def.unit)} ·
                        Sem. ant. {fmt(v.prevWeekValue, v.def.unit)} · Año ant. {fmt(v.prevYearValue, v.def.unit)}
                      </div>
                      <p className="mt-1 text-xs text-muted">{v.def.description}</p>
                      {flagged && <p className="mt-2 text-xs font-medium text-bad">Pendiente: {!kComments.length ? "comentario" : ""}{!kComments.length && !kActions.length ? " + " : ""}{!kActions.length ? "acción" : ""}</p>}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Comentarios / causa</h4>
                      {kComments.map((c) => (
                        <div key={c.id} className="group rounded-md bg-bone px-3 py-2 text-sm">
                          <p>{c.text}</p>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted">
                            <span>{c.author ?? "—"} · {fmtDateTime(c.created_at)}</span>
                            {can.comment(user) && (
                              <form action={deleteComment}>
                                <input type="hidden" name="id" value={c.id} />
                                <button aria-label="Borrar comentario" className="opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                              </form>
                            )}
                          </div>
                        </div>
                      ))}
                      {can.comment(user) && (
                        <form action={addComment} className="flex gap-2">
                          <input type="hidden" name="year" value={year} />
                          <input type="hidden" name="week" value={week} />
                          <input type="hidden" name="kpi_key" value={v.key} />
                          <input name="text" placeholder="¿Por qué? Causa principal…" className="input" required />
                          <SubmitButton variant="outline">Añadir</SubmitButton>
                        </form>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Acciones</h4>
                      {kActions.map((a) => <ActionItem key={a.id} a={a} editable={can.manageActions(user)} showKpi={false} />)}
                      {can.manageActions(user) && <ActionForm kpiKey={v.key} year={year} week={week} defaultOwner={owners[area.key] ?? area.defaultOwner} compact />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-muted">Los KPIs informativos (sin objetivo) se consultan en las <Link href="/area/ventas" className="underline">vistas por área</Link>.</p>
    </div>
  );
}
