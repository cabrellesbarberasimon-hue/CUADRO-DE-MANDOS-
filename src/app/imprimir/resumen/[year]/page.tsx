import { getKpiContext } from "@/lib/data";
import { periodView, type PeriodKind } from "@/lib/views";
import { KPI_BY_KEY, SUMMARY_KPIS } from "@/config/kpis";
import { StatusBadge } from "@/components/ui";
import { fmt } from "@/lib/format";

export default async function PrintSummary({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<{ p?: string }> }) {
  const year = Number((await params).year);
  const kind = (((await searchParams).p as PeriodKind) ?? "mes") as Exclude<PeriodKind, "semana">;
  const ctx = await getKpiContext();
  const defs = SUMMARY_KPIS.map((k) => KPI_BY_KEY[k]);
  const periods = periodView(ctx, year, kind, defs);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-light">Resumen {kind} · {year}</h1>
      <table className="data-table text-[10px]">
        <thead><tr><th>Periodo</th>{defs.map((d) => <th key={d.key} className="num">{d.label}</th>)}</tr></thead>
        <tbody>
          {periods.filter((p) => p.reportedWeeks).map((p) => (
            <tr key={p.key}>
              <td className="font-medium">{p.label}</td>
              {p.results.map((r) => (
                <td key={r.key} className="num">{fmt(r.value, r.def.unit)}{r.status !== "info" && r.status !== "sin_dato" && <div><StatusBadge status={r.status} /></div>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
