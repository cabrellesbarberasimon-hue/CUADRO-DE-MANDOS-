"use client";

import { useState, useTransition } from "react";
import { saveCell } from "@/app/actions/business";

/** Marca/desmarca una semana como cerrada (vacaciones, sin actividad). */
export function ClosedToggle({ year, week, closed, editable }: { year: number; week: number; closed: boolean; editable: boolean }) {
  const [value, setValue] = useState(closed);
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={`Semana ${week} cerrada`}
      checked={value}
      disabled={!editable || pending}
      onChange={(e) => {
        const next = e.target.checked;
        setValue(next);
        start(async () => {
          const res = await saveCell(year, week, "is_closed", String(next));
          if (res.error) setValue(!next);
        });
      }}
    />
  );
}
