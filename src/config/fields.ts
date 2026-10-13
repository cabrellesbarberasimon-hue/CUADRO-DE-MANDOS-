// ★ Datos de ENTRADA de cada semana (lo que se rellena o importa).
// Si añades un campo aquí, añade también su columna en una migración nueva (src/lib/db/migrations.ts).
// Los porcentajes se guardan como fracción (0,25 = 25 %).

import type { AreaKey } from "./areas";

export type FieldType = "int" | "eur" | "pct" | "num" | "text";

export type FieldDef = {
  key: string;
  label: string;
  area: AreaKey | "general";
  type: FieldType;
  help?: string;
  /** Campo de "stock" (foto a final de semana): en periodos se toma el último valor, no la suma. */
  stock?: boolean;
};

export const INPUT_FIELDS = [
  { key: "orders_count", label: "Nº de pedidos", area: "ventas", type: "int" },
  { key: "sales_eur", label: "Ventas (€)", area: "ventas", type: "eur" },
  { key: "sales_prev_year_eur", label: "Ventas año anterior (€)", area: "ventas", type: "eur", help: "Si la app tiene datos de la misma semana del año anterior, se usan esos automáticamente." },
  { key: "quotes_sent", label: "Nº presupuestos enviados", area: "presupuestos", type: "int" },
  { key: "quotes_confirmed", label: "Nº presupuestos confirmados", area: "presupuestos", type: "int" },
  { key: "quotes_confirmed_eur", label: "Presupuestos confirmados (€)", area: "presupuestos", type: "eur" },
  { key: "served_eur", label: "Pedidos servidos (€)", area: "operaciones", type: "eur" },
  { key: "served_count", label: "Nº pedidos servidos", area: "operaciones", type: "int" },
  { key: "late_orders_count", label: "Nº pedidos fuera de plazo", area: "operaciones", type: "int" },
  { key: "late_orders_eur", label: "Pedidos atrasados (€)", area: "operaciones", type: "eur" },
  { key: "pending_orders_count", label: "Nº pedidos pendientes de servir", area: "operaciones", type: "int", stock: true },
  { key: "pending_orders_eur", label: "Pedidos pendientes de servir (€)", area: "operaciones", type: "eur", stock: true },
  { key: "incidents_count", label: "Nº incidencias", area: "calidad", type: "int" },
  { key: "incidents_late_count", label: "Nº incidencias fuera de plazo", area: "calidad", type: "int" },
  { key: "leads_generated", label: "Leads generados", area: "marketing", type: "int" },
  { key: "cpl_eur", label: "CPL (€)", area: "marketing", type: "eur", help: "Coste por lead." },
  { key: "landing_conversion_pct", label: "% conversión landing", area: "marketing", type: "pct" },
  { key: "leads_to_sale", label: "Nº leads convertidos en venta", area: "marketing", type: "int" },
  { key: "leads_contacted", label: "Nº leads contactados", area: "marketing", type: "int" },
  { key: "leads_contacted_24h", label: "Nº leads contactados en < 24 h", area: "marketing", type: "int" },
  { key: "leads_reassigned", label: "Leads reasignados", area: "marketing", type: "int" },
] as const satisfies readonly FieldDef[];

export type NumericFieldKey = (typeof INPUT_FIELDS)[number]["key"];

export const TEXT_FIELDS = [
  { key: "owner", label: "Responsable resumen" },
  { key: "comment", label: "Comentario / causa principal" },
  { key: "weekly_action", label: "Acción de la semana" },
] as const;

export type TextFieldKey = (typeof TEXT_FIELDS)[number]["key"];

export const FIELD_BY_KEY: Record<string, FieldDef> = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, f]));
