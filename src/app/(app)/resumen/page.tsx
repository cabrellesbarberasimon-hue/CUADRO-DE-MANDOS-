import Link from "next/link";
import clsx from "clsx";
import { Download, Printer } from "lucide-react";
import { Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { YearPicker } from "@/components/week-picker";
import { TrendChart } from "@/components/charts";
import { can, requireUser } from "@/lib/auth";
import { getKpiContext, getYears } from "@/lib/data";
import { q } from "@/lib/db/client";
import { KPI_BY_KEY, SUMMARY_KPIS } from "@/config/kpis";
import { aggregate } from "@/lib/kpis/engine";
import { periodView, type PeriodKind } from "@/lib/views";
import { fmt } from "@/lib/format";
import { savePeriodComment } from "@/app/actions/admin";

const KINDS: { key: Exclude<PeriodKind, "semana">; label: string }[] = [
  { key: "mes", label: "Mensual" },
  { key: "trimestre", label: "Trimestral" },
  { key: "año", label: "Anual" },
];

export default async function Resumen({ searchParams }: { searchParams: Promise<{ y?: string; p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = await getKpiContext();
  const years = await getYears();
  const year = Number(sp.y) || years.at(-1) || new Date().getFullYear();
  const kind = (KINDS.find((k) => k.key === sp.p)?.key ?? "mes") as Exclude<PeriodKind, "semana">;
  const defs = SUMMARY_KPIS.map((k) => KPI_BY_KEY[k]);
  const periods = periodView(ctx, year, kind, defs);
  const comments = await q<{ period: string; text: string }>(`select period, text from period_comments where year = $1 and kind = $2`, [year, kind]);
  const chart = periods.map((p) => ({
    label: p.label.slice(0, kind === "mes" ? 3 : 10),
    actual: p.results[0].value,
    target: p.reportedWeeks ? p.results[0].target.value : null,
    prevYear: p.prevYearResults?.[0].value ?? aggregate(p.rows).sales_prev_year_eur,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen"
        subtitle="Agregados por periodo. Los porcentajes se recalculan con los totales (no se promedian). Cartera y carga de fábrica: último dato del periodo."
        actions={
          <>
            <YearPicker year={year} years={years} />
            <LinkButton href={`/api/export/resumen?y=${year}&p=${kind}`} variant="outline" prefetch={false}><Download size={16} /> Excel</LinkButton>
            <LinkButton href={`/imprimir/resumen/${year}?p=${kind}`} variant="ghost"><Printer size={16} /> PDF</LinkButton>
          </>
        }
      />
      <nav className="flex gap-2">
        {KINDS.map((k) => (
          <Link key={k.key} href={`?y=${year}&p=${k.key}`} className={clsx("rounded-full px-4 py-1.5 text-sm", k.key === kind ? "bg-ink text-white" : "bg-bone hover:bg-line")}>{k.label}</Link>
        ))}
      </nav>

      <Card className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Periodo</th>
              <th className="num">Sem.</th>
              {defs.map((d) => <th key={d.key} className="num">{d.label}</th>)}
              <th>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.key} className={p.reportedWeeks ? "" : "text-muted"}>
                <td className="font-medium">{p.label}</td>
                <td className="num">{p.reportedWeeks}</td>
                {p.results.map((r) => (
                  <td key={r.key} className="num">
                    <div>{p.reportedWeeks || r.key === "late_eur" ? fmt(r.value, r.def.unit) : "—"}</div>
                    {p.reportedWeeks > 0 && r.status !== "info" && r.status !== "sin_dato" && <StatusBadge status={r.status} className="mt-0.5" />}
                  </td>
                ))}
                <td className="min-w-56">
                  {can.runMeeting(user) ? (
                    <form action={savePeriodComment} className="flex gap-1">
                      <input type="hidden" name="year" value={year} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="period" value={p.key} />
                      <input name="text" defaultValue={comments.find((c) => c.period === p.key)?.text ?? ""} className="input py-1 text-xs" />
                      <button className="rounded border border-line px-2 text-xs hover:border-ink">OK</button>
                    </form>
                  ) : (
                    <span className="text-xs">{comments.find((c) => c.period === p.key)?.text ?? ""}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {kind !== "año" && (
        <Card title={`Ventas por ${kind} · real vs objetivo vs año anterior`}>
          <TrendChart data={chart} unit="eur" height={300} targetStep={false} />
        </Card>
      )}
    </div>
  );
}
