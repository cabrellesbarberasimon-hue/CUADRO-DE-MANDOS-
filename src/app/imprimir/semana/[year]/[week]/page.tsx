import { getComments, getFocus, getKpiContext } from "@/lib/data";
import { weekView } from "@/lib/views";
import { DASHBOARD_KPIS, KPI_BY_KEY } from "@/config/kpis";
import { PrintKpiTable } from "@/components/print-kpi-table";
import { fmtDate } from "@/lib/format";
import { isoWeekEnd, isoWeekStart } from "@/lib/calendar";

export default async function PrintWeek({ params }: { params: Promise<{ year: string; week: string }> }) {
  const p = await params;
  const year = Number(p.year);
  const week = Number(p.week);
  const ctx = await getKpiContext();
  const [comments, focus] = await Promise.all([getComments(year, week), getFocus(year, week)]);
  const views = weekView(ctx, year, week, DASHBOARD_KPIS);
  const byKpi: Record<string, string[]> = {};
  for (const c of comments) (byKpi[c.kpi_key] ??= []).push(c.text);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light">Dashboard semana {week} · {year}</h1>
      <p className="text-sm text-muted">{fmtDate(isoWeekStart(year, week))} – {fmtDate(isoWeekEnd(year, week))}</p>
      <PrintKpiTable views={views} comments={byKpi} />
      {focus && (
        <div className="rounded-md border border-line p-4 text-sm">
          <h2 className="mb-2 font-medium">Foco semanal</h2>
          <p><b>KPI:</b> {focus.kpi_key ? KPI_BY_KEY[focus.kpi_key]?.label : "—"} · <b>Problema:</b> {focus.problem ?? "—"}</p>
          <p><b>Acción:</b> {focus.action ?? "—"} · <b>Responsable:</b> {focus.owner ?? "—"} · <b>Revisión:</b> {fmtDate(focus.review_date)}</p>
          {focus.ai_summary && <p className="mt-3 whitespace-pre-line">{focus.ai_summary}</p>}
        </div>
      )}
    </div>
  );
}
