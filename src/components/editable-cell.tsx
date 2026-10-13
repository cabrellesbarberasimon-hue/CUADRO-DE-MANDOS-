"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { saveCell } from "@/app/actions/business";
import { fmt } from "@/lib/format";
import type { FieldType } from "@/config/fields";

/** Celda editable estilo Excel: clic para editar, Enter o salir para guardar, Esc para cancelar. */
export function EditableCell({
  year,
  week,
  field,
  type,
  value,
  editable,
}: {
  year: number;
  week: number;
  field: string;
  type: FieldType;
  value: number | string | null;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toInput = (v: number | string | null) => {
    if (v == null) return "";
    if (type === "text") return String(v);
    const n = Number(v);
    return type === "pct" ? String(+(n * 100).toFixed(4)).replace(".", ",") : String(n).replace(".", ",");
  };

  const commit = (raw: string) => {
    setEditing(false);
    if (raw === toInput(current)) return;
    start(async () => {
      const res = await saveCell(year, week, field, raw);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setCurrent(res.value ?? null);
      }
    });
  };

  if (editing) {
    return (
      <input
        autoFocus
        onFocus={(e) => e.target.select()}
        defaultValue={toInput(current)}
        className={clsx("w-full min-w-20 rounded border border-ink px-1 py-0.5 text-sm outline-none", type !== "text" && "text-right")}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={type === "pct" ? "%" : ""}
      />
    );
  }
  const display = current == null || current === "" ? "" : type === "text" ? String(current) : fmt(Number(current), type);
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => setEditing(true)}
      title={error ?? (editable ? "Clic para editar" : undefined)}
      className={clsx(
        "block w-full min-w-16 rounded px-1 py-0.5 text-left",
        type !== "text" && "text-right tabular-nums",
        editable && "hover:bg-bone",
        pending && "opacity-50",
        error && "ring-1 ring-bad",
        type === "text" && "max-w-60 truncate",
      )}
    >
      {display || <span className="text-line">·</span>}
    </button>
  );
}
