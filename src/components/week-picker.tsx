"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isoWeekEnd, isoWeekStart, nextWeek, prevWeek, weeksInYear } from "@/lib/calendar";
import { fmtDate } from "@/lib/format";

export function WeekPicker({ year, week, years, basePath }: { year: number; week: number; years: number[]; basePath?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  // Con basePath navega a /basePath/año/semana; sin él, usa ?y=&w= en la página actual.
  const go = (y: number, w: number) => {
    if (basePath) return router.push(`${basePath}/${y}/${w}`);
    const params = new URLSearchParams(sp.toString());
    params.set("y", String(y));
    params.set("w", String(w));
    router.push(`${path}?${params.toString()}`);
  };
  const p = prevWeek(year, week);
  const n = nextWeek(year, week);
  const yearOptions = Array.from(new Set([...years, year, new Date().getFullYear()])).sort();
  return (
    <div className="flex items-center gap-2">
      <button aria-label="Semana anterior" onClick={() => go(p.year, p.week)} className="rounded-full border border-line p-2 hover:border-ink">
        <ChevronLeft size={16} />
      </button>
      <select value={year} onChange={(e) => go(Number(e.target.value), Math.min(week, weeksInYear(Number(e.target.value))))} className="input w-24 py-1.5">
        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={week} onChange={(e) => go(year, Number(e.target.value))} className="input w-auto min-w-56 py-1.5">
        {Array.from({ length: weeksInYear(year) }, (_, i) => i + 1).map((w) => (
          <option key={w} value={w}>Semana {w} · {fmtDate(isoWeekStart(year, w)).slice(0, 5)}–{fmtDate(isoWeekEnd(year, w)).slice(0, 5)}</option>
        ))}
      </select>
      <button aria-label="Semana siguiente" onClick={() => go(n.year, n.week)} className="rounded-full border border-line p-2 hover:border-ink">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function YearPicker({ year, years, param = "y" }: { year: number; years: number[]; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const yearOptions = Array.from(new Set([...years, year, new Date().getFullYear()])).sort();
  return (
    <select
      value={year}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString());
        params.set(param, e.target.value);
        router.push(`${path}?${params.toString()}`);
      }}
      className="input w-auto py-1.5"
    >
      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}
