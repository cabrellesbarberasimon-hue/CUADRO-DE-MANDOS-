import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Card, PageHeader } from "@/components/ui";
import { KpiCard } from "@/components/kpi-card";
import { WeekPicker } from "@/components/week-picker";
import { FunnelBars, TrendChart } from "@/components/charts";
import { requireUser } from "@/lib/auth";
import { getKpiContext, getYears } from "@/lib/data";
import { AREA_BY_KEY, AREAS, type AreaKey } from "@/config/areas";
import { KPI_BY_KEY, kpisOfArea } from "@/config/kpis";
import { resolveWeekParam, weekView, weeklySeries } from "@/lib/views";
import { prevWeek } from "@/lib/calendar";
import { aggregate } from "@/lib/kpis/engine";

const RANGES = [
  { key: "13", label: "Últimas 13 semanas" },
  { key: "26", label: "Últimas 26 semanas" },
  { key: "ano", label: "Año completo" },
];

export default async function AreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ y?: string; w?: string; r?: string }> }) {
  const { area } = await params;
  if (!(area in AREA_BY_KEY)) notFound();
  const sp = await searchParams;
  await requireUser();
  const ctx = await getKpiContext();
  const years = await getYears();
  const { year, week } = resolveWeekParam(ctx.rows, sp);
  const range = sp.r ?? "13";
  const meta = AREA_BY_KEY[area as AreaKey];
  const defs = kpisOfArea(area as AreaKey);
  const views = weekView(ctx, year, week, defs);

  // Semanas del gráfico (dentro del mismo año para comparar con año anterior)
  let from = 1;
  if (range !== "ano") {
    let cur = { year, week };
    for (let i = 1; i < Number(range); i++) {
      const p = prevWeek(cur.year, cur.week);
      if (p.year !== year) break;
      cur = p;
    }
    from = cur.week;
  }
  const to = range === "ano" ? Math.max(week, ...ctx.rows.filter((r) => r.year === year && r.sales_eur != null).map((r) => r.week)) : week;
  const charted = defs.filter((d) => d.direction !== "none" || ["orders", "pending_eur", "quotes_confirmed_eur", "incidents"].includes(d.key));
  const owner = ctx.settings.area_owners?.[area] ?? meta.defaultOwner;
  const funnel = area === "marketing" ? aggregate(ctx.rows.filter((r) => r.year === year && r.week >= from && r.week <= to)) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.label}
        subtitle={`${meta.description} Responsable: ${owner}.`}
        actions={<WeekPicker year={year} week={week} years={years} />}
      />
      <nav className="flex flex-wrap gap-2">
        {AREAS.map((a) => (
          <Link key={a.key} href={`/area/${a.key}?y=${year}&w=${week}&r=${range}`}
            className={clsx("rounded-full px-4 py-1.5 text-sm", a.key === area ? "bg-ink text-white" : "bg-bone hover:bg-line")}>
            {a.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {views.map((v) => <KpiCard key={v.key} view={v} href={`/semana/${year}/${week}#${v.key}`} />)}
      </div>

      <div className="flex items-center gap-2 no-print">
        <span className="text-sm text-muted">Rango:</span>
        {RANGES.map((r) => (
          <Link key={r.key} href={`?y=${year}&w=${week}&r=${r.key}`}
            className={clsx("rounded-full px-3 py-1 text-xs", r.key === range ? "bg-ink text-white" : "bg-bone hover:bg-line")}>
            {r.label}
          </Link>
        ))}
      </div>

      {area === "marketing" && funnel && funnel.leads_generated != null && (
        <Card title={`Embudo de leads · S${from}–S${to}`}>
          <FunnelBars
            steps={[
              { label: "Leads generados", value: funnel.leads_generated },
              { label: "Leads contactados", value: funnel.leads_contacted },
              { label: "Convertidos en venta", value: funnel.leads_to_sale },
            ]}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {charted.map((def) => {
          const series = weeklySeries(ctx, year, def, from, to);
          const band = def.direction === "range" ? ([ctx.opts.resolveTarget(def, year, week).value ?? 4, ctx.opts.resolveTarget(def, year, week).max ?? 5] as [number, number]) : null;
          return (
            <Card key={def.key} title={def.label}>
              {series.every((p) => p.actual == null) ? (
                <div className="flex h-[260px] items-center justify-center rounded-md bg-bone text-sm text-muted">
                  Sin datos en este rango.{" "}
                  {range !== "ano" && <Link className="ml-1 underline" href={`?y=${year}&w=${week}&r=ano`}>Ver año completo</Link>}
                </div>
              ) : (
              <TrendChart
                data={series}
                unit={def.unit}
                kind={def.unit === "pct" || def.unit === "weeks" || def.unit === "num" ? "line" : "bar"}
                band={band}
                showTarget={def.direction !== "range"}
              />
              )}
              <p className="mt-2 text-xs text-muted">{def.description}{def.key === "factory_load" ? " Banda verde = objetivo." : ""}</p>
            </Card>
          );
        })}
      </div>
      {area === "calidad" && (
        <Card title="Pareto de causas">
          <p className="text-sm text-muted">Preparado para cuando se registren las causas de cada incidencia. De momento usa los comentarios de la semana (<Link className="underline" href={`/semana/${year}/${week}#incidents_pct`}>Análisis</Link>).</p>
        </Card>
      )}
      {KPI_BY_KEY.factory_load && area === "operaciones" && (
        <p className="text-xs text-muted">Capacidad semanal de fábrica configurada: {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(ctx.opts.capacity)}.</p>
      )}
    </div>
  );
}
