// Carga inicial: datos históricos del Excel original (semanas 17-41 de 2026) y configuración por defecto.
// Solo se ejecuta si la tabla de semanas está vacía. Los usuarios NO se crean aquí: el primer
// administrador se crea desde /setup.

import seed from "@/data/seed-2026.json";
import { AREAS } from "@/config/areas";
import { DEFAULT_THRESHOLDS } from "@/lib/kpis/engine";

type Query = <T>(text: string, params?: unknown[]) => Promise<T[]>;

export const DEFAULT_SETTINGS = {
  capacity_eur: 45000,
  thresholds: DEFAULT_THRESHOLDS,
  kpi_thresholds: {} as Record<string, { alertLow: number; alertHigh: number }>,
  area_owners: Object.fromEntries(AREAS.map((a) => [a.key, a.defaultOwner])) as Record<string, string>,
  alert_recipients: [] as string[],
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function seedIfEmpty(query: Query) {
  const seeded = await query<{ key: string }>(`select key from settings where key = 'seeded'`);
  if (seeded.length) return;
  const count = await query<{ n: number }>(`select count(*)::int as n from weeks`);
  if (count[0].n === 0) {
    for (const row of seed as Record<string, unknown>[]) {
      const keys = Object.keys(row);
      const cols = [...keys, "data_source"];
      const vals = [...keys.map((k) => row[k]), "seed"];
      await query(
        `insert into weeks (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) on conflict do nothing`,
        vals,
      );
    }
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await query(`insert into settings (key, value) values ($1, $2::text::jsonb) on conflict do nothing`, [key, JSON.stringify(value)]);
  }
  await query(`insert into settings (key, value) values ('seeded', 'true'::jsonb) on conflict do nothing`);
}
