import Link from "next/link";
import { FileText, Mail } from "lucide-react";
import { Card, Field, LinkButton, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { WeekPicker } from "@/components/week-picker";
import { FullscreenButton } from "@/components/fullscreen-button";
import { ActionForm } from "@/components/action-form";
import { ActionItem } from "@/components/action-item";
import { SubmitButton } from "@/components/forms";
import { can, requireUser } from "@/lib/auth";
import { getActions, getComments, getFocus, getKpiContext, getYears, isOverdue } from "@/lib/data";
import { q1 } from "@/lib/db/client";
import { AREAS } from "@/config/areas";
import { KPIS, KPI_BY_KEY } from "@/config/kpis";
import { weekView } from "@/lib/views";
import { fmt } from "@/lib/format";
import { addComment, saveMeeting, sendSummaryNow } from "@/app/actions/business";
import { emailEnabled } from "@/lib/email";

export default async function Reunion({ params, searchParams }: { params: Promise<{ year: string; week: string }>; searchParams: Promise<{ email?: string }> }) {
  const p = await params;
  const sp = await searchParams;
  const year = Number(p.year);
  const week = Number(p.week);
  const user = await requireUser();
  const ctx = await getKpiContext();
  const [years, comments, weekActions, allActions, focus, meeting] = await Promise.all([
    getYears(),
    getComments(year, week),
    getActions({ year, week }),
    getActions(),
    getFocus(year, week),
    q1<{ attendees: string | null; notes: string | null }>(`select attendees, notes from meetings where year = $1 and week = $2`, [year, week]),
  ]);
  const views = weekView(ctx, year, week, KPIS.filter((k) => k.direction !== "none"));
  const owners = ctx.settings.area_owners ?? {};
  const overdue = allActions.filter((a) => isOverdue(a));
  const row = ctx.rows.find((r) => r.year === year && r.week === week);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reunión semanal · semana ${week}`}
        subtitle="Recorre las áreas en orden. Si un KPI está en Mal o Alerta: comentario + acción concreta."
        actions={
          <>
            <WeekPicker year={year} week={week} years={years} basePath="/reunion" />
            <FullscreenButton />
            <LinkButton href={`/imprimir/acta/${year}/${week}`} variant="outline"><FileText size={16} /> Acta PDF</LinkButton>
            {can.runMeeting(user) && (
              <form action={sendSummaryNow}>
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="week" value={week} />
                <SubmitButton variant="outline"><Mail size={16} /> Enviar resumen</SubmitButton>
              </form>
            )}
          </>
        }
      />
      {sp.email && (sp.email === "ok" ? <Notice tone="ok">Resumen enviado por email.</Notice> : <Notice tone="warn">No se ha enviado el email: {sp.email}{!emailEnabled() && " — configura RESEND_API_KEY en Vercel."}</Notice>)}
      {!row && <Notice tone="warn">La semana {week} no tiene datos todavía.</Notice>}

      <nav className="no-print sticky top-16 z-20 -mx-6 flex gap-2 border-b border-line bg-white/95 px-6 py-2 backdrop-blur">
        <a href="#foco" className="rounded-full bg-bone px-3 py-1 text-xs hover:bg-line">Foco</a>
        {AREAS.map((a) => <a key={a.key} href={`#area-${a.key}`} className="rounded-full bg-bone px-3 py-1 text-xs hover:bg-line">{a.label}</a>)}
        <a href="#acciones" className="rounded-full bg-bone px-3 py-1 text-xs hover:bg-line">Acciones</a>
        <a href="#acta" className="rounded-full bg-bone px-3 py-1 text-xs hover:bg-line">Acta</a>
      </nav>

      <Card title="Foco semanal" className="scroll-mt-32" >
        <div id="foco" className="grid grid-cols-1 gap-4 text-sm md:grid-cols-5">
          <div><div className="label">KPI prioritario</div>{focus?.kpi_key ? KPI_BY_KEY[focus.kpi_key]?.label : "—"}</div>
          <div className="md:col-span-2"><div className="label">Problema principal</div>{focus?.problem ?? "—"}</div>
          <div className="md:col-span-2"><div className="label">Acción concreta</div>{focus?.action ?? "—"} {focus?.owner && <span className="text-muted">({focus.owner})</span>}</div>
        </div>
        {focus?.ai_summary && <div className="mt-4 whitespace-pre-line rounded-md bg-bone p-4 text-sm leading-relaxed">{focus.ai_summary}</div>}
        <p className="mt-3 text-xs text-muted"><Link className="underline" href={`/?y=${year}&w=${week}`}>Editar foco y resumen IA en el dashboard</Link></p>
      </Card>

      {AREAS.map((area) => {
        const list = views.filter((v) => v.def.area === area.key);
        return (
          <section key={area.key} id={`area-${area.key}`} className="scroll-mt-32">
            <Card title={`${area.label} · ${owners[area.key] ?? area.defaultOwner}`}>
              <table className="data-table">
                <thead>
                  <tr><th>KPI</th><th className="num">Valor</th><th className="num">Objetivo</th><th className="num">Sem. ant.</th><th>Estado</th><th>Comentario</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {list.map((v) => {
                    const kc = comments.filter((c) => c.kpi_key === v.key);
                    const ka = weekActions.filter((a) => a.kpi_key === v.key);
                    const needs = (v.status === "mal" || v.status === "alerta") && (!kc.length || !ka.length);
                    return (
                      <tr key={v.key} className={needs ? "bg-bad-bg/40" : ""}>
                        <td className="font-medium">{v.def.label}</td>
                        <td className="num text-base">{fmt(v.value, v.def.unit)}</td>
                        <td className="num text-muted">{v.def.direction === "range" ? `${fmt(v.target.value, "num")}–${fmt(v.target.max, "num")}` : fmt(v.target.value, v.def.unit)}</td>
                        <td className="num text-muted">{fmt(v.prevWeekValue, v.def.unit)}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td className="min-w-60 text-sm">
                          {kc.map((c) => <p key={c.id}>{c.text}</p>)}
                          {can.comment(user) && (v.status === "mal" || v.status === "alerta") && (
                            <form action={addComment} className="no-print mt-1 flex gap-1">
                              <input type="hidden" name="year" value={year} />
                              <input type="hidden" name="week" value={week} />
                              <input type="hidden" name="kpi_key" value={v.key} />
                              <input name="text" placeholder="Causa…" className="input py-1 text-xs" required />
                              <button className="rounded border border-line px-2 text-xs hover:border-ink">+</button>
                            </form>
                          )}
                        </td>
                        <td className="min-w-60 text-sm">
                          {ka.map((a) => <p key={a.id}>• {a.title} <span className="text-muted">({a.owner ?? "—"})</span></p>)}
                          {needs && !ka.length && <Link href={`/semana/${year}/${week}#${v.key}`} className="no-print text-xs text-bad underline">Crear acción</Link>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </section>
        );
      })}

      <section id="acciones" className="scroll-mt-32 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Acciones vencidas (${overdue.length})`}>
          <div className="space-y-2">
            {overdue.length ? overdue.map((a) => <ActionItem key={a.id} a={a} editable={can.manageActions(user)} />) : <p className="text-sm text-muted">Ninguna. 👍</p>}
          </div>
        </Card>
        <Card title="Nueva acción de la reunión">
          {can.manageActions(user) ? (
            <ActionForm year={year} week={week} kpiOptions={KPIS.filter((k) => k.direction !== "none").map((k) => ({ key: k.key, label: k.label }))} />
          ) : <p className="text-sm text-muted">Solo lectura.</p>}
        </Card>
      </section>

      <section id="acta" className="scroll-mt-32">
        <Card title="Acta de la reunión">
          <form action={saveMeeting} className="space-y-3">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="week" value={week} />
            <Field label="Asistentes"><input name="attendees" defaultValue={meeting?.attendees ?? ""} className="input" placeholder="Borja, Verónica, Mónica, Simón…" disabled={!can.manageActions(user)} /></Field>
            <Field label="Notas y decisiones"><textarea name="notes" rows={5} defaultValue={meeting?.notes ?? ""} className="input" disabled={!can.manageActions(user)} /></Field>
            {can.manageActions(user) && <div className="flex justify-end"><SubmitButton>Guardar acta</SubmitButton></div>}
          </form>
        </Card>
      </section>
    </div>
  );
}
