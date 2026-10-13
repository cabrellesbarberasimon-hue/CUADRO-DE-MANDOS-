"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { q } from "@/lib/db/client";
import { can, requireUser } from "@/lib/auth";
import { getWeeks, upsertWeek, type WeekInput } from "@/lib/data";
import { readWorkbook } from "@/lib/import/workbook";
import { MAPPINGS } from "@/lib/import/mappings";
import { INPUT_FIELDS, TEXT_FIELDS, FIELD_BY_KEY } from "@/config/fields";
import { notifyNewRedKpis } from "@/lib/notify";
import { weekKey } from "@/lib/calendar";

export type PreviewRow = {
  year: number;
  week: number;
  status: "nueva" | "actualiza" | "sin_cambios";
  changes: { field: string; label: string; before: unknown; after: unknown }[];
  data: WeekInput;
};

export type PreviewResult = {
  error?: string;
  filename?: string;
  mapping?: { id: string; label: string };
  rows?: PreviewRow[];
  issues?: { row: number; message: string }[];
};

export async function previewImport(_: PreviewResult | undefined, form: FormData): Promise<PreviewResult> {
  await requireUser(can.editData);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo .xlsx o .csv." };
  if (file.size > 10 * 1024 * 1024) return { error: "El archivo supera 10 MB." };
  const defaultYear = Number(form.get("year")) || new Date().getFullYear();
  let sheets;
  try {
    sheets = await readWorkbook(await file.arrayBuffer(), file.name);
  } catch {
    return { error: "No se ha podido leer el archivo. ¿Es un Excel (.xlsx) válido?" };
  }
  const mapping = MAPPINGS.find((m) => m.detect(sheets));
  if (!mapping) {
    return {
      error: `Formato no reconocido. Hojas encontradas: ${sheets.map((s) => s.name).join(", ")}. Formatos admitidos: ${MAPPINGS.map((m) => m.label).join(" · ")}.`,
    };
  }
  const { rows, issues } = mapping.map(sheets, defaultYear);
  const existing = new Map((await getWeeks()).map((r) => [weekKey(r.year, r.week), r]));
  const preview: PreviewRow[] = rows.map((data) => {
    const before = existing.get(weekKey(data.year, data.week)) as Record<string, unknown> | undefined;
    const changes = Object.entries(data)
      .filter(([k]) => k !== "year" && k !== "week" && k !== "start_date" && k !== "end_date")
      .filter(([k, v]) => String(before?.[k] ?? null) !== String(v ?? null))
      .map(([k, v]) => ({
        field: k,
        label: FIELD_BY_KEY[k]?.label ?? TEXT_FIELDS.find((t) => t.key === k)?.label ?? (k === "is_closed" ? "Cerrada" : k),
        before: before?.[k] ?? null,
        after: v,
      }));
    return { year: data.year, week: data.week, status: !before ? "nueva" : changes.length ? "actualiza" : "sin_cambios", changes, data };
  });
  return { filename: file.name, mapping: { id: mapping.id, label: mapping.label }, rows: preview, issues };
}

const numeric = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, z.number().min(0).nullable().optional()]));
const text = Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, z.string().max(2000).nullable().optional()]));
const weekSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  week: z.number().int().min(1).max(53),
  is_closed: z.boolean().optional(),
  start_date: z.string().max(10).nullable().optional(),
  end_date: z.string().max(10).nullable().optional(),
  ...numeric,
  ...text,
});

export async function confirmImport(payload: { filename: string; mapping: string; rows: WeekInput[]; issues: unknown[] }) {
  const user = await requireUser(can.editData);
  const parsed = z.array(weekSchema).safeParse(payload.rows);
  if (!parsed.success) return { error: "Datos no válidos: " + parsed.error.issues[0].message };
  let created = 0, updated = 0;
  const touched: { year: number; week: number }[] = [];
  for (const row of parsed.data) {
    const res = await upsertWeek(row as WeekInput, user.id, "import");
    if (res.created) created++;
    else if (res.changes) updated++;
    if (res.created || res.changes) touched.push({ year: row.year, week: row.week });
  }
  await q(
    `insert into imports (filename, mapping, user_id, created_count, updated_count, rejected_count, log) values ($1,$2,$3,$4,$5,$6,$7::text::jsonb)`,
    [payload.filename, payload.mapping, user.id, created, updated, payload.issues.length, JSON.stringify(payload.issues)],
  );
  // Aviso de KPIs en rojo solo para la última semana importada (la relevante para la reunión)
  const last = touched.sort((a, b) => weekKey(a.year, a.week) - weekKey(b.year, b.week)).at(-1);
  if (last) await notifyNewRedKpis(last.year, last.week, null).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: `Importación completada: ${created} semanas nuevas, ${updated} actualizadas.` };
}
