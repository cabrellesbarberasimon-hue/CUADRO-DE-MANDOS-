import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { YearPicker } from "@/components/week-picker";
import { EditableCell } from "@/components/editable-cell";
import { ClosedToggle } from "@/components/closed-toggle";
import { can, requireUser } from "@/lib/auth";
import { getKpiContext, getYears } from "@/lib/data";
import { AREAS } from "@/config/areas";
import { INPUT_FIELDS, TEXT_FIELDS } from "@/config/fields";
import { KPI_BY_KEY } from "@/config/kpis";
import { completeness, hasAnyData } from "@/lib/kpis/engine";
import { MONTHS, monthOfWeek, weeksInYear } from "@/lib/calendar";
import { fmt } from "@/lib/format";

const CALCULATED = ["avg_ticket", "sales_vs_target", "sales_vs_prev_year", "quotes_rate", "late_pct", "incidents_pct", "avg_pending", "factory_load", "lead_conversion", "leads_contacted_pct", "leads_unworked"];

export default async function Datos({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = await getKpiContext();
  const years = await getYears();
  const year = Number(sp.y) || years.at(-1) || new Date().getFullYear();
  const editable = can.editData(user);
  const byWeek = new Map(ctx.rows.filter((r) => r.year === year).map((r) => [r.week, r]));
  const groups = [...AREAS.map((a) => ({ key: a.key, label: a.label, fields: INPUT_FIELDS.filter((f) => f.area === a.key) }))];
  const calc = CALCULATED.map((k) => KPI_BY_KEY[k]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datos semanales"
        subtitle={editable ? "Haz clic en una celda para editarla (Enter para guardar). Porcentajes en % (escribe 25 para 25 %). Las columnas grises se calculan solas." : "Solo lectura."}
        actions={
          <>
            <YearPicker year={year} years={years} />
            <LinkButton href={`/api/export/datos?y=${year}`} prefetch={false}><Download size={16} /> Excel</LinkButton>
          </>
        }
      />
      <Card className="overflow-x-auto">
        <table className="data-table text-[13px]">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10">Semana</th>
              <th rowSpan={2}>Mes</th>
              <th rowSpan={2}>Cerrada</th>
              <th rowSpan={2} className="num">Compl.</th>
              {groups.map((g) => <th key={g.key} colSpan={g.fields.length} className="text-center">{g.label}</th>)}
              <th colSpan={TEXT_FIELDS.length} className="text-center">Seguimiento</th>
              <th colSpan={calc.length} className="text-center !bg-line">Calculados</th>
            </tr>
            <tr>
              {groups.flatMap((g) => g.fields.map((f) => <th key={f.key} className="num normal-case">{f.label}</th>))}
              {TEXT_FIELDS.map((f) => <th key={f.key} className="normal-case">{f.label}</th>)}
              {calc.map((k) => <th key={k.key} className="num normal-case !bg-line">{k.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weeksInYear(year) }, (_, i) => i + 1).map((w) => {
              const r = byWeek.get(w);
              const results = r ? ctx.evalRows([r], calc) : null;
              const pct = r ? completeness(r) : 0;
              return (
                <tr key={w} className={r?.is_closed ? "bg-bone text-muted" : ""}>
                  <td className="sticky left-0 z-10 bg-white whitespace-nowrap">
                    <Link href={`/datos/${year}/${w}`} className="inline-flex items-center gap-1 font-medium hover:underline">S{w} <Pencil size={11} className="text-muted" /></Link>
                  </td>
                  <td className="whitespace-nowrap text-muted">{MONTHS[monthOfWeek(year, w) - 1].slice(0, 3)}</td>
                  <td className="text-center">
                    <ClosedToggle year={year} week={w} closed={!!r?.is_closed} editable={editable} />
                  </td>
                  <td className="num">{r && !r.is_closed && hasAnyData(r) ? <span className={pct < 0.5 ? "text-bad" : pct < 0.8 ? "text-warn" : "text-ok"}>{Math.round(pct * 100)}%</span> : ""}</td>
                  {groups.flatMap((g) => g.fields.map((f) => (
                    <td key={f.key} data-field={f.key} className="!px-1"><EditableCell year={year} week={w} field={f.key} type={f.type} value={r?.[f.key] ?? null} editable={editable} /></td>
                  )))}
                  {TEXT_FIELDS.map((f) => (
                    <td key={f.key} className="!px-1"><EditableCell year={year} week={w} field={f.key} type="text" value={r?.[f.key] ?? null} editable={editable} /></td>
                  ))}
                  {calc.map((k, i) => (
                    <td key={k.key} className="num bg-bone/60">
                      {results ? (
                        <span className="inline-flex items-center gap-1">
                          {fmt(results[i].value, k.unit).replace("Sin dato", "")}
                          {results[i].value != null && (results[i].status === "mal" || results[i].status === "alerta") && <StatusBadge status={results[i].status} />}
                        </span>
                      ) : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

