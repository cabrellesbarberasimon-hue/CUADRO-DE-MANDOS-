// Prueba de integración con Postgres embebido en memoria: migraciones, carga inicial,
// cálculo de KPIs sobre los datos reales e importación del Excel original.
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

process.env.DB_MEMORY = "1";

import { q } from "@/lib/db/client";
import { getKpiContext, upsertWeek, getAudit, getWeek } from "@/lib/data";
import { readWorkbook } from "@/lib/import/workbook";
import { MAPPINGS } from "@/lib/import/mappings";
import { KPI_BY_KEY } from "@/config/kpis";
import { periodView } from "@/lib/views";

describe("base de datos + datos reales", () => {
  beforeAll(async () => {
    await q("select 1");
  });

  it("carga las 28 semanas del Excel original", async () => {
    const r = await q<{ n: number }>("select count(*)::int as n from weeks");
    expect(r[0].n).toBe(28);
  });

  it("golden: valores calculados coinciden con el Excel (con correcciones)", async () => {
    const ctx = await getKpiContext();
    const w = (n: number) => ctx.rows.filter((r) => r.year === 2026 && r.week === n);
    const v = (n: number, k: string) => ctx.evalRows(w(n), [KPI_BY_KEY[k]])[0];
    // Semana 20: ventas 19.513,76 € con objetivo 46.500 → 41,97 % → Mal
    expect(v(20, "sales_vs_target").value).toBeCloseTo(19513.76 / 46500, 5);
    expect(v(20, "sales").status).toBe("mal");
    // Ticket medio S20 = 19513,76 / 19
    expect(v(20, "avg_ticket").value).toBeCloseTo(19513.76 / 19, 4);
    // % fuera de plazo S20 corregido: 12 / 25 servidos (el Excel dividía entre 88 pendientes)
    expect(v(20, "late_pct").value).toBeCloseTo(12 / 25, 5);
    // Carga de fábrica S20 = 171.736 / 45.000
    expect(v(20, "factory_load").value).toBeCloseTo(171736 / 45000, 5);
    // % incidencias S21 = 8 / 27
    expect(v(21, "incidents_pct").value).toBeCloseTo(8 / 27, 5);
    // % vs año anterior S22: 52.167,44 / 90.461,71 − 1 (celda con fórmula =51666.71+38795)
    expect(v(22, "sales_vs_prev_year").value).toBeCloseTo(52167.44 / 90461.71 - 1, 4);
    // Agosto cerrado
    expect(v(33, "sales").status).toBe("cerrada");
  });

  it("resumen mensual: julio incluye la semana 27 (29/06–03/07) por su jueves", async () => {
    const ctx = await getKpiContext();
    const months = periodView(ctx, 2026, "mes", [KPI_BY_KEY.sales]);
    const july = months[6];
    expect(july.rows.map((r) => r.week)).toContain(27);
    expect(months[5].rows.map((r) => r.week)).not.toContain(27);
    expect(july.results[0].value).toBeCloseTo(34680 + 10860 + 15350 + 13995 + 20330, 2);
  });

  it("upsert registra auditoría", async () => {
    await upsertWeek({ year: 2026, week: 41, leads_generated: 60 }, null, "manual");
    const audit = await getAudit("week", "2026-41");
    expect(audit[0].field).toBe("leads_generated");
    expect((await getWeek(2026, 41))?.leads_generated).toBe(60);
  });

  it("importa el Excel original sin errores y sin cambios respecto a la carga inicial", async () => {
    const file = readFileSync(path.resolve(__dirname, "../data/Cuadro_de_Mandos_Semanal_Ventas.xlsx"));
    const sheets = await readWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, "x.xlsx");
    const mapping = MAPPINGS.find((m) => m.detect(sheets));
    expect(mapping?.id).toBe("excel-original");
    const { rows, issues } = mapping!.map(sheets, 2026);
    expect(issues).toEqual([]);
    const s20 = rows.find((r) => r.week === 20)!;
    expect(s20.sales_eur).toBe(19513.76);
    expect(s20.pending_orders_count).toBe(88);
    expect(s20.landing_conversion_pct).toBe(0.0232);
    expect(rows.find((r) => r.week === 18)?.orders_count).toBe(27); // fórmula =29-2
    expect(rows.find((r) => r.week === 33)?.is_closed).toBe(true);
    expect(rows.length).toBe(28);
  });
});
