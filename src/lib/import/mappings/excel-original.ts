// Mapeo del Excel original "Cuadro_de_Mandos_Semanal_Ventas.xlsx" (hoja "Datos Semanales",
// cabecera en la fila 4, datos desde la fila 5). Las columnas se localizan por su título,
// así que sigue funcionando aunque se añadan o muevan columnas.

import { norm, type Sheet } from "../workbook";
import { parseNumber } from "@/lib/format";
import type { Mapping, ImportIssue } from "./types";
import type { WeekInput } from "@/lib/data";

/** título de columna normalizado → campo de la app. El orden importa: la primera coincidencia gana. */
const COLUMNS: [string, string][] = [
  ["n de pedidos", "orders_count"],
  ["ventas 2024", "sales_prev_year_eur"],
  ["ventas ano anterior", "sales_prev_year_eur"],
  ["ventas", "sales_eur"],
  ["n presus enviados", "quotes_sent"],
  ["n presus confirmados", "quotes_confirmed"],
  ["presu confirm", "quotes_confirmed_eur"],
  ["pedidos servidos", "served_eur"],
  ["n pedidos servidos", "served_count"],
  ["n pedidos fuera de plazo", "late_orders_count"],
  ["pedidos atrasados", "late_orders_eur"],
  ["n incidencias fuera de plazo", "incidents_late_count"],
  ["n incidencias", "incidents_count"],
  ["n pedidos pendientes de servir", "pending_orders_count"],
  ["pedidos pendientes de servir", "pending_orders_eur"],
  ["leads generados", "leads_generated"],
  ["cpl", "cpl_eur"],
  ["% conversion landing", "landing_conversion_pct"],
  ["n conversion lead venta", "leads_to_sale"],
  ["n leads contactados", "leads_contacted"],
  ["leads reasignados", "leads_reassigned"],
  ["responsable resumen", "owner"],
  ["comentario causa principal", "comment"],
  ["accion de la semana", "weekly_action"],
];

const TEXT = new Set(["owner", "comment", "weekly_action"]);

function findSheet(sheets: Sheet[]) {
  return sheets.find((s) => norm(s.name) === "datos semanales");
}

function headerRowIndex(sheet: Sheet) {
  return sheet.rows.findIndex((r) => r && norm(r[0]) === "semana" && r.some((c) => norm(c).startsWith("ventas")));
}

export const excelOriginal: Mapping = {
  id: "excel-original",
  label: "Excel original (Datos Semanales)",
  description: "Hoja “Datos Semanales” del Cuadro_de_Mandos_Semanal_Ventas.xlsx: cabecera en la fila 4 y una fila por semana.",
  detect: (sheets) => {
    const s = findSheet(sheets);
    return !!s && headerRowIndex(s) >= 0;
  },
  map: (sheets, defaultYear) => {
    const sheet = findSheet(sheets)!;
    const h = headerRowIndex(sheet);
    // Se ignora el símbolo € para comparar ("Ventas (€)" → "ventas").
    const header = sheet.rows[h].map((c) => norm(c).replace(/€/g, "").replace(/\s+/g, " ").trim());
    const colOf = new Map<string, number>();
    for (const [title, field] of COLUMNS) {
      if (colOf.has(field)) continue;
      const idx = header.findIndex((c, i) => c === title && ![...colOf.values()].includes(i));
      if (idx >= 0) colOf.set(field, idx);
    }
    const startCol = header.findIndex((c) => c === "fecha inicio");
    const endCol = header.findIndex((c) => c === "fecha fin");
    const rows: WeekInput[] = [];
    const issues: ImportIssue[] = [];
    for (let i = h + 1; i < sheet.rows.length; i++) {
      const r = sheet.rows[i];
      if (!r) continue;
      const week = Number(r[0]);
      if (!Number.isInteger(week) || week < 1 || week > 53) continue;
      const start = startCol >= 0 ? r[startCol] : null;
      const year = typeof start === "string" && /^\d{4}-/.test(start) ? Number(start.slice(0, 4)) : defaultYear;
      const out: Record<string, unknown> = { year, week };
      let any = false;
      for (const [field, col] of colOf) {
        const raw = r[col];
        if (raw == null || raw === "" || (typeof raw === "string" && !raw.trim())) continue;
        if (TEXT.has(field)) {
          out[field] = String(raw).trim();
          any = true;
          continue;
        }
        const n = parseNumber(raw);
        if (n == null) {
          issues.push({ row: i + 1, message: `Semana ${week}: valor no numérico en "${sheet.rows[h][col]}" (${raw})` });
          continue;
        }
        if (n < 0) {
          issues.push({ row: i + 1, message: `Semana ${week}: valor negativo en "${sheet.rows[h][col]}"` });
          continue;
        }
        out[field] = n;
        any = true;
      }
      if (!any) continue;
      if (typeof start === "string") out.start_date = start;
      if (endCol >= 0 && typeof r[endCol] === "string") out.end_date = r[endCol];
      // Semana con pedidos y ventas a 0 = cerrada (vacaciones), como agosto en el Excel original.
      if (out.orders_count === 0 && out.sales_eur === 0) {
        out.is_closed = true;
        delete out.orders_count;
        delete out.sales_eur;
      }
      rows.push(out as WeekInput);
    }
    return { rows, issues };
  },
};
