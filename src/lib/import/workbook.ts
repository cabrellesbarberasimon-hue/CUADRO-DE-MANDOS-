// Lectura de archivos Excel/CSV a una estructura simple: hojas → filas → celdas (valores ya resueltos).

import ExcelJS from "exceljs";

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; rows: Cell[][] };

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue); // fórmula → resultado guardado
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return null;
  }
  return String(v);
}

export async function readWorkbook(buffer: ArrayBuffer, filename: string): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows = text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim() || null));
    return [{ name: "CSV", rows }];
  }
  await wb.xlsx.load(buffer as never);
  return wb.worksheets.map((ws) => {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        cells[c - 1] = cellValue(cell.value);
      });
      rows[n - 1] = cells;
    });
    return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
  });
}

/** Normaliza un texto de cabecera para compararlo (minúsculas, sin acentos ni símbolos). */
export const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%€]+/g, " ")
    .trim();
