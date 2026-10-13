"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAction } from "@/app/actions/business";
import { SubmitButton } from "./forms";
import { Notice } from "./ui";

export function ActionForm({
  kpiKey,
  year,
  week,
  defaultOwner,
  compact = false,
  kpiOptions,
}: {
  kpiKey?: string;
  year?: number;
  week?: number;
  defaultOwner?: string;
  compact?: boolean;
  kpiOptions?: { key: string; label: string }[];
}) {
  const [state, action] = useActionState(createAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
      {kpiKey && <input type="hidden" name="kpi_key" value={kpiKey} />}
      {year != null && <input type="hidden" name="year" value={year} />}
      {week != null && <input type="hidden" name="week" value={week} />}
      <input name="title" placeholder="Nueva acción concreta…" className="input" required minLength={3} />
      <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}>
        <input name="owner" placeholder="Responsable" defaultValue={defaultOwner} className="input" />
        <input name="due_date" type="date" className="input" aria-label="Fecha límite" />
        <select name="priority" defaultValue="media" className="input" aria-label="Prioridad">
          <option value="alta">Prioridad alta</option>
          <option value="media">Prioridad media</option>
          <option value="baja">Prioridad baja</option>
        </select>
        {kpiOptions && (
          <select name="kpi_key" defaultValue="" className="input" aria-label="KPI">
            <option value="">Sin KPI</option>
            {kpiOptions.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        )}
      </div>
      {!compact && <textarea name="description" rows={2} placeholder="Descripción (opcional)" className="input" />}
      <div className="flex justify-end"><SubmitButton variant="outline">Añadir acción</SubmitButton></div>
    </form>
  );
}
