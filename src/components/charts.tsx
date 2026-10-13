"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Cell,
  LabelList,
} from "recharts";
import { CHART } from "@/config/theme";
import { fmt } from "@/lib/format";
import type { Unit } from "@/config/kpis";

export type TrendPoint = {
  label: string;
  actual: number | null;
  target?: number | null;
  prevYear?: number | null;
  closed?: boolean;
};

const axisTick = { fill: CHART.axis, fontSize: 11 };

function compact(v: number, unit: Unit) {
  if (unit === "pct") return `${Math.abs(v) < 0.1 && v !== 0 ? (v * 100).toFixed(1).replace(".", ",") : Math.round(v * 100)} %`;
  if (unit === "eur") return Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k €` : `${Math.round(v)} €`;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(v);
}

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number | null; color: string; dataKey: string }[]; label?: string; unit: Unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular-nums text-ink">{fmt(p.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

/** Evolución semanal/mensual: barras (real) + línea año anterior + objetivo discontinuo. Un solo eje. */
export function TrendChart({
  data,
  unit,
  kind = "bar",
  band,
  height = 260,
  showPrevYear = true,
  showTarget = true,
  targetStep = true,
}: {
  data: TrendPoint[];
  unit: Unit;
  kind?: "bar" | "line";
  band?: [number, number] | null;
  height?: number;
  showPrevYear?: boolean;
  showTarget?: boolean;
  /** Objetivo semanal en escalones; en meses/trimestres, línea con puntos. */
  targetStep?: boolean;
}) {
  const hasPrev = showPrevYear && data.some((d) => d.prevYear != null);
  const hasTarget = showTarget && data.some((d) => d.target != null);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => compact(v, unit)} />
          {band && <ReferenceArea y1={band[0]} y2={band[1]} fill={CHART.band} fillOpacity={0.08} stroke="none" />}
          {data.map((d) =>
            d.closed ? <ReferenceArea key={d.label} x1={d.label} x2={d.label} fill={CHART.closed} fillOpacity={0.9} /> : null,
          )}
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "#000", fillOpacity: 0.04 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: CHART.axis }} />
          {kind === "bar" ? (
            <Bar dataKey="actual" name="Real" fill={CHART.actual} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ) : (
            <Line dataKey="actual" name="Real" stroke={CHART.actual} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          )}
          {hasPrev && <Line dataKey="prevYear" name="Año anterior" stroke={CHART.prevYear} strokeWidth={2} dot={false} connectNulls />}
          {hasTarget && (
            <Line dataKey="target" name="Objetivo" stroke={CHART.target} strokeWidth={1.5} strokeDasharray="5 4" dot={targetStep ? false : { r: 3 }} type={targetStep ? "stepAfter" : "linear"} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, unit }: { values: { label: string; value: number | null }[]; unit: Unit }) {
  if (values.filter((v) => v.value != null).length < 2) return <div className="h-10" />;
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer>
        <LineChart data={values} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded border border-line bg-white px-2 py-1 text-[11px] shadow-sm">
                  {payload[0].payload.label}: <span className="tabular-nums">{fmt(payload[0].value as number, unit)}</span>
                </div>
              ) : null
            }
          />
          <Line dataKey="value" stroke={CHART.actual} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Embudo horizontal (leads → contactados → ventas). */
export function FunnelBars({ steps }: { steps: { label: string; value: number | null }[] }) {
  const data = steps.map((s) => ({ ...s, value: s.value ?? 0 }));
  return (
    <div style={{ height: 40 + steps.length * 44 }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={150} tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipBox unit="int" />} cursor={{ fill: "#000", fillOpacity: 0.04 }} />
          <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]} maxBarSize={26}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={CHART.actual} fillOpacity={1 - i * 0.2} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fill: "#1A1A1A", fontSize: 12 }} formatter={(v) => fmt(Number(v), "int")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
