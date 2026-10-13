import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { StatusBadge } from "./ui";
import { Sparkline } from "./charts";
import { fmt, fmtDelta } from "@/lib/format";
import type { KpiWeekView } from "@/lib/views";

function Delta({ current, previous, view, label }: { current: number | null; previous: number | null; view: KpiWeekView; label: string }) {
  if (current == null || previous == null) return <span className="text-muted">{label}: —</span>;
  const diff = current - previous;
  const good = view.def.direction === "lower" ? diff < 0 : diff > 0;
  const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = view.def.direction === "none" || view.def.direction === "range" || diff === 0 ? "text-muted" : good ? "text-ok" : "text-bad";
  return (
    <span className={clsx("inline-flex items-center gap-0.5", tone)}>
      <Icon size={12} aria-hidden />
      {label}: {fmtDelta(diff, view.def.unit)}
    </span>
  );
}

export function KpiCard({ view, href }: { view: KpiWeekView; href?: string }) {
  const { def, value, target, status } = view;
  const targetText =
    def.direction === "range"
      ? `${fmt(target.value, "num")}–${fmt(target.max, "num")} sem.`
      : def.direction === "none"
        ? null
        : fmt(target.value, def.unit);
  const body = (
    <div className="flex h-full flex-col rounded-lg border border-line bg-white p-4 transition-colors hover:border-concrete">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{def.label}</h3>
        <StatusBadge status={status} />
      </div>
      <div className="mt-2 text-2xl font-light tabular-nums">{fmt(value, def.unit)}</div>
      {targetText && <div className="text-xs text-muted">Objetivo: {targetText}</div>}
      <div className="mt-2"><Sparkline values={view.spark} unit={def.unit} /></div>
      <div className="mt-auto flex flex-col gap-0.5 pt-2 text-xs">
        <Delta current={value} previous={view.prevWeekValue} view={view} label="vs sem. ant." />
        <Delta current={value} previous={view.prevYearValue} view={view} label="vs año ant." />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
