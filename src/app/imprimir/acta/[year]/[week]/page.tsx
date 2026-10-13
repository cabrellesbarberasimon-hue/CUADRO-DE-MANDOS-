import { getActions, getComments, getFocus, getKpiContext } from "@/lib/data";
import { q1 } from "@/lib/db/client";
import { weekView } from "@/lib/views";
import { AREAS } from "@/config/areas";
import { KPIS, KPI_BY_KEY } from "@/config/kpis";
import { PrintKpiTable } from "@/components/print-kpi-table";
import { fmtDate } from "@/lib/format";

export default async function PrintMinutes({ params }: { params: Promise<{ year: string; week: string }> }) {
  const p = await params;
  const year = Number(p.year);
  const week = Number(p.week);
  const ctx = await getKpiContext();
  const [comments, focus, actions, meeting] = await Promise.all([
    getComments(year, week),
    getFocus(year, week),
    getActions({ year, week }),
    q1<{ attendees: string | null; notes: string | null }>(`select attendees, notes from meetings where year = $1 and week = $2`, [year, week]),
  ]);
  const views = weekView(ctx, year, week, KPIS.filter((k) => k.direction !== "none"));
  const byKpi: Record<string, string[]> = {};
  for (const c of comments) (byKpi[c.kpi_key] ??= []).push(c.text);
  const owners = ctx.settings.area_owners ?? {};
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Acta de reunión · semana {week} de {year}</h1>
        <p className="mt-1 text-sm"><b>Asistentes:</b> {meeting?.attendees ?? "—"}</p>
      </div>
      {focus && (
        <div className="rounded-md border border-line p-4 text-sm">
          <h2 className="mb-2 font-medium">Foco semanal</h2>
          <p><b>KPI prioritario:</b> {focus.kpi_key ? KPI_BY_KEY[focus.kpi_key]?.label : "—"}</p>
          <p><b>Problema principal:</b> {focus.problem ?? "—"}</p>
          <p><b>Acción concreta:</b> {focus.action ?? "—"} ({focus.owner ?? "—"}, revisión {fmtDate(focus.review_date)})</p>
          {focus.ai_summary && <><h3 className="mt-3 font-medium">Resumen ejecutivo</h3><p className="whitespace-pre-line">{focus.ai_summary}</p></>}
        </div>
      )}
      {AREAS.map((a) => (
        <div key={a.key}>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-nav">{a.label} · {owners[a.key] ?? a.defaultOwner}</h2>
          <PrintKpiTable views={views.filter((v) => v.def.area === a.key)} comments={byKpi} />
        </div>
      ))}
      <div className="print-break">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-nav">Acciones acordadas</h2>
        <table className="data-table text-xs">
          <thead><tr><th>Acción</th><th>KPI</th><th>Responsable</th><th>Fecha límite</th><th>Prioridad</th><th>Estado</th></tr></thead>
          <tbody>
            {actions.map((x) => (
              <tr key={x.id}><td>{x.title}</td><td>{x.kpi_key ? KPI_BY_KEY[x.kpi_key]?.label : "—"}</td><td>{x.owner ?? "—"}</td><td>{fmtDate(x.due_date)}</td><td>{x.priority}</td><td>{x.status}</td></tr>
            ))}
            {!actions.length && <tr><td colSpan={6} className="text-muted">Sin acciones registradas esta semana.</td></tr>}
          </tbody>
        </table>
      </div>
      {meeting?.notes && (
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-nav">Notas y decisiones</h2>
          <p className="whitespace-pre-line text-sm">{meeting.notes}</p>
        </div>
      )}
    </div>
  );
}
