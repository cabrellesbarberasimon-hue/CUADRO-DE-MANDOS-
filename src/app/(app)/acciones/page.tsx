import Link from "next/link";
import clsx from "clsx";
import { Card, PageHeader, Empty } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ActionItem } from "@/components/action-item";
import { can, requireUser } from "@/lib/auth";
import { ACTION_STATUSES, getActions, isOverdue, type Action } from "@/lib/data";
import { KPIS, KPI_BY_KEY } from "@/config/kpis";

const FILTERS = [
  { key: "abiertas", label: "Abiertas" },
  { key: "vencidas", label: "Vencidas" },
  { key: "todas", label: "Todas" },
];

export default async function Acciones({ searchParams }: { searchParams: Promise<{ f?: string; v?: string; owner?: string; kpi?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const all = await getActions();
  const filter = sp.f ?? "abiertas";
  const view = sp.v ?? "kanban";
  let list: Action[] = all;
  if (filter === "abiertas") list = list.filter((a) => a.status === "pendiente" || a.status === "en_curso");
  if (filter === "vencidas") list = list.filter((a) => isOverdue(a));
  if (sp.owner) list = list.filter((a) => (a.owner ?? "") === sp.owner);
  if (sp.kpi) list = list.filter((a) => a.kpi_key === sp.kpi);
  const owners = Array.from(new Set(all.map((a) => a.owner).filter(Boolean))) as string[];

  // KPI de gestión: % de acciones cerradas en plazo
  const closed = all.filter((a) => a.status === "hecha");
  const closedDay = (a: Action) => (a.closed_at ? new Date(a.closed_at).toISOString().slice(0, 10) : "");
  const onTime = closed.filter((a) => !a.due_date || closedDay(a) <= a.due_date);
  const onTimePct = closed.length ? Math.round((onTime.length / closed.length) * 100) : null;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ f: filter, v: view, owner: sp.owner, kpi: sp.kpi, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${p.toString()}`;
  };
  const columns = view === "kanban" ? ACTION_STATUSES.filter((s) => filter === "todas" || s.key === "pendiente" || s.key === "en_curso") : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Plan de acción" subtitle="Cada KPI en Mal o Alerta debe tener una acción concreta con responsable y fecha." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Abiertas", all.filter((a) => a.status === "pendiente" || a.status === "en_curso").length],
          ["Vencidas", all.filter((a) => isOverdue(a)).length],
          ["Hechas", closed.length],
          ["Cerradas en plazo", onTimePct == null ? "—" : `${onTimePct} %`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-light tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={qs({ f: f.key })} className={clsx("rounded-full px-4 py-1.5 text-sm", f.key === filter ? "bg-ink text-white" : "bg-bone hover:bg-line")}>{f.label}</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
        <Link href={qs({ v: "kanban" })} className={clsx("rounded-full px-3 py-1 text-xs", view === "kanban" ? "bg-ink text-white" : "bg-bone")}>Tablero</Link>
        <Link href={qs({ v: "lista" })} className={clsx("rounded-full px-3 py-1 text-xs", view === "lista" ? "bg-ink text-white" : "bg-bone")}>Lista</Link>
        <span className="mx-2 h-5 w-px bg-line" />
        {owners.map((o) => (
          <Link key={o} href={qs({ owner: sp.owner === o ? undefined : o })} className={clsx("rounded-full px-3 py-1 text-xs", sp.owner === o ? "bg-walnut text-white" : "bg-bone hover:bg-line")}>{o}</Link>
        ))}
        {sp.kpi && <Link href={qs({ kpi: undefined })} className="rounded-full bg-walnut px-3 py-1 text-xs text-white">KPI: {KPI_BY_KEY[sp.kpi]?.label} ✕</Link>}
      </div>

      {can.manageActions(user) && (
        <Card title="Nueva acción">
          <ActionForm kpiOptions={KPIS.filter((k) => k.direction !== "none").map((k) => ({ key: k.key, label: k.label }))} />
        </Card>
      )}

      {list.length === 0 ? (
        <Empty>No hay acciones con este filtro.</Empty>
      ) : view === "kanban" ? (
        <div className={clsx("grid gap-4", columns.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
          {columns.map((c) => (
            <div key={c.key} className="rounded-lg bg-bone p-3">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-nav text-muted">{c.label} · {list.filter((a) => a.status === c.key).length}</h2>
              <div className="space-y-2">
                {list.filter((a) => a.status === c.key).map((a) => (
                  <div key={a.id} className="bg-white"><ActionItem a={a} editable={can.manageActions(user)} /></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{list.map((a) => <ActionItem key={a.id} a={a} editable={can.manageActions(user)} />)}</div>
      )}
    </div>
  );
}
