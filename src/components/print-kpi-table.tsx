import { StatusBadge } from "./ui";
import { fmt } from "@/lib/format";
import type { KpiWeekView } from "@/lib/views";

export function PrintKpiTable({ views, comments }: { views: KpiWeekView[]; comments?: Record<string, string[]> }) {
  return (
    <table className="data-table text-xs">
      <thead>
        <tr><th>KPI</th><th className="num">Valor</th><th className="num">Objetivo</th><th className="num">Sem. ant.</th><th className="num">Año ant.</th><th>Estado</th>{comments && <th>Comentario</th>}</tr>
      </thead>
      <tbody>
        {views.map((v) => (
          <tr key={v.key}>
            <td>{v.def.label}</td>
            <td className="num font-medium">{fmt(v.value, v.def.unit)}</td>
            <td className="num">{v.def.direction === "none" ? "—" : v.def.direction === "range" ? `${fmt(v.target.value, "num")}–${fmt(v.target.max, "num")}` : fmt(v.target.value, v.def.unit)}</td>
            <td className="num">{fmt(v.prevWeekValue, v.def.unit)}</td>
            <td className="num">{fmt(v.prevYearValue, v.def.unit)}</td>
            <td><StatusBadge status={v.status} /></td>
            {comments && <td>{(comments[v.key] ?? []).join(" · ")}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
