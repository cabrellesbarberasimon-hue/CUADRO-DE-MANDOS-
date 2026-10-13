// Plantilla propia de la app: la misma que genera "Datos → Excel". Hoja "Datos", cabecera en la fila 1
// con "Año", "Semana" y los nombres de los campos tal como aparecen en la app. Permite editar en Excel y reimportar.

import { norm, type Sheet } from "../workbook";
import { INPUT_FIELDS, TEXT_FIELDS } from "@/config/fields";
import { parseNumber } from "@/lib/format";
import type { Mapping, ImportIssue } from "./types";
import type { WeekInput } from "@/lib/data";

export const TEMPLATE_SHEET = "Datos";

const byLabel = new Map<string, { key: string; type: string }>([
  ...INPUT_FIELDS.map((f) => [norm(f.label), { key: f.key, type: f.type }] as const),
  ...TEXT_FIELDS.map((f) => [norm(f.label), { key: f.key, type: "text" }] as const),
  [norm("Cerrada"), { key: "is_closed", type: "bool" }],
]);

function find(sheets: Sheet[]) {
  return sheets.find((s) => norm(s.name) === norm(TEMPLATE_SHEET) && norm(s.rows[0]?.[0]) === "ano" && norm(s.rows[0]?.[1]) === "semana");
}

export const plantillaBocubi: Mapping = {
  id: "plantilla-bocubi",
  label: "Plantilla Bocubi (exportada desde la app)",
  description: "Archivo descargado desde Datos → Excel. Primera fila: Año, Semana y los campos.",
  detect: (sheets) => !!find(sheets),
  map: (sheets) => {
    const sheet = find(sheets)!;
    const header = sheet.rows[0].map((c) => byLabel.get(norm(c)) ?? null);
    const rows: WeekInput[] = [];
    const issues: ImportIssue[] = [];
    sheet.rows.slice(1).forEach((r, i) => {
      if (!r) return;
      const year = Number(r[0]);
      const week = Number(r[1]);
      if (!year || !week) return;
      const out: Record<string, unknown> = { year, week };
      let any = false;
      header.forEach((h, c) => {
        if (!h || c < 2) return;
        const raw = r[c];
        if (raw == null || raw === "") return;
        if (h.type === "text") { out[h.key] = String(raw); any = true; return; }
        if (h.type === "bool") { out[h.key] = ["si", "sí", "true", "1", "x"].includes(norm(raw)); any = true; return; }
        let n = parseNumber(raw);
        if (n == null || n < 0) { issues.push({ row: i + 2, message: `Semana ${week}: valor no válido en "${sheet.rows[0][c]}"` }); return; }
        // Porcentajes: admite 0,25 o 25
        if (h.type === "pct" && n > 1) n = n / 100;
        out[h.key] = n;
        any = true;
      });
      if (any) rows.push(out as WeekInput);
    });
    return { rows, issues };
  },
};
