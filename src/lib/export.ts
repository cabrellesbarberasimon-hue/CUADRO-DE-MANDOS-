// Exportaciones a Excel con estilo Bocubi.

import ExcelJS from "exceljs";
import { INPUT_FIELDS, TEXT_FIELDS } from "@/config/fields";
import { KPI_BY_KEY, SUMMARY_KPIS } from "@/config/kpis";
import { TEMPLATE_SHEET } from "@/lib/import/mappings/plantilla-bocubi";
import { STATUS_LABEL } from "@/lib/kpis/engine";
import { MONTHS, monthOfWeek, weeksInYear } from "@/lib/calendar";
import { periodView, type PeriodKind } from "@/lib/views";
import type { getKpiContext } from "@/lib/data";

type Ctx = Awaited<ReturnType<typeof getKpiContext>>;

const numFmt = { eur: '#,##0 "€"', pct: "0.0%", int: "#,##0", num: "#,##0.00", weeks: "0.00", text: "@" } as const;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 32;
}

/** Datos semanales en formato "Plantilla Bocubi" (se puede editar y volver a importar). */
export async function exportWeeks(ctx: Ctx, year: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cuadro de Mandos Bocubi";
  const ws = wb.addWorksheet(TEMPLATE_SHEET, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const fields = [...INPUT_FIELDS];
  ws.columns = [
    { header: "Año", key: "year", width: 7 },
    { header: "Semana", key: "week", width: 8 },
    { header: "Mes", key: "month", width: 11 },
    { header: "Cerrada", key: "is_closed", width: 8 },
    ...fields.map((f) => ({ header: f.label, key: f.key, width: 16, style: { numFmt: numFmt[f.type] } })),
    ...TEXT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 30 })),
  ];
  styleHeader(ws.getRow(1));
  const byWeek = new Map(ctx.rows.filter((r) => r.year === year).map((r) => [r.week, r]));
  for (let w = 1; w <= weeksInYear(year); w++) {
    const r = byWeek.get(w);
    ws.addRow({
      year,
      week: w,
      month: MONTHS[monthOfWeek(year, w) - 1],
      is_closed: r?.is_closed ? "Sí" : "",
      ...Object.fromEntries(fields.map((f) => [f.key, r?.[f.key] ?? null])),
      ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, r?.[f.key] ?? null])),
    });
  }
  const info = wb.addWorksheet("Instrucciones");
  info.getColumn(1).width = 110;
  [
    "Plantilla de datos semanales · Cuadro de Mandos Bocubi",
    "",
    "• Una fila por semana ISO. No cambies los títulos de la primera fila de la hoja “Datos”.",
    "• Deja en blanco lo que no sepas: en la app aparecerá como “Sin dato” (no como 0).",
    "• Porcentajes: puedes escribir 0,25 o 25 (se entiende 25 %).",
    "• “Cerrada”: escribe Sí en semanas de vacaciones / sin actividad.",
    "• El mes y los KPIs calculados (ticket medio, % fuera de plazo, carga de fábrica…) los calcula la app.",
    "• Para cargarla: app → Importar → subir este archivo → revisar → Confirmar.",
  ].forEach((t, i) => (info.getCell(`A${i + 1}`).value = t));
  info.getCell("A1").font = { bold: true, size: 14 };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportSummary(ctx: Ctx, year: number, kind: Exclude<PeriodKind, "semana">): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const defs = SUMMARY_KPIS.map((k) => KPI_BY_KEY[k]);
  const ws = wb.addWorksheet(`Resumen ${kind}`, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  ws.columns = [
    { header: "Periodo", key: "p", width: 14 },
    { header: "Semanas", key: "n", width: 9 },
    ...defs.flatMap((d) => [
      { header: d.label, key: d.key, width: 16, style: { numFmt: numFmt[d.unit] } },
      ...(d.direction !== "none" ? [{ header: `Estado`, key: `${d.key}_st`, width: 9 }] : []),
    ]),
  ];
  styleHeader(ws.getRow(1));
  for (const p of periodView(ctx, year, kind, defs)) {
    const row: Record<string, unknown> = { p: p.label, n: p.reportedWeeks };
    for (const r of p.results) {
      row[r.key] = p.reportedWeeks ? r.value : null;
      if (r.def.direction !== "none") row[`${r.key}_st`] = p.reportedWeeks ? STATUS_LABEL[r.status] : "";
    }
    ws.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
