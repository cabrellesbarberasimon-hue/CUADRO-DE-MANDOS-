import clsx from "clsx";
import { Badge } from "./ui";
import { ACTION_STATUSES, isOverdue, type Action } from "@/lib/data";
import { KPI_BY_KEY } from "@/config/kpis";
import { fmtDate } from "@/lib/format";
import { updateAction } from "@/app/actions/business";

const statusTone = { pendiente: "neutral", en_curso: "walnut", hecha: "ok", descartada: "neutral" } as const;

export function ActionItem({ a, editable, showKpi = true }: { a: Action; editable: boolean; showKpi?: boolean }) {
  const overdue = isOverdue(a);
  return (
    <div className={clsx("rounded-md border p-3 text-sm", overdue ? "border-bad/40 bg-bad-bg/40" : "border-line")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className={clsx("font-medium", a.status === "hecha" || a.status === "descartada" ? "text-muted line-through" : "")}>{a.title}</div>
        <div className="flex items-center gap-1">
          {a.priority === "alta" && <Badge tone="bad">Alta</Badge>}
          <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? "neutral"}>
            {ACTION_STATUSES.find((s) => s.key === a.status)?.label ?? a.status}
          </Badge>
        </div>
      </div>
      {a.description && <p className="mt-1 text-muted">{a.description}</p>}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>Resp.: {a.owner ?? "—"}</span>
        <span className={overdue ? "font-medium text-bad" : ""}>Vence: {fmtDate(a.due_date)}{overdue ? " (vencida)" : ""}</span>
        {showKpi && a.kpi_key && <span>KPI: {KPI_BY_KEY[a.kpi_key]?.label ?? a.kpi_key}</span>}
        {a.week && <span>Origen: S{a.week}/{a.year}</span>}
      </div>
      {a.result && <p className="mt-1 text-xs"><span className="text-muted">Resultado:</span> {a.result}</p>}
      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ACTION_STATUSES.filter((s) => s.key !== a.status).map((s) => (
            <form key={s.key} action={updateAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value={s.key} />
              {s.key === "hecha" && (a.status === "pendiente" || a.status === "en_curso") && (
                <input name="result" placeholder="Resultado (opcional)" className="input w-44 py-1 text-xs" />
              )}
              <button className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-ink">→ {s.label}</button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
