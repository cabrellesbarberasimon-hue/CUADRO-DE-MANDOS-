// ★ DEFINICIÓN DE TODOS LOS KPIs.
// Dashboard, vistas por área, resúmenes, semáforos, reunión y exportaciones se generan a partir de esta lista.
// Para añadir un KPI: añade una entrada aquí. Si necesita un dato nuevo, añádelo en fields.ts (+ migración).
// Los objetivos aquí son solo los valores iniciales: se editan en la app (Configuración → Objetivos).

import type { AreaKey } from "./areas";
import type { NumericFieldKey } from "./fields";

export type Totals = Record<NumericFieldKey, number | null> & {
  /** Ventas solo de las semanas que tienen también dato del año anterior (comparación homogénea). */
  sales_matched_eur?: number | null;
};

export type KpiContext = {
  /** Capacidad semanal de fábrica en € (Configuración). */
  capacity: number;
  /** Objetivo de ventas del periodo (ya escalado por nº de semanas abiertas). */
  salesTarget: number | null;
  /** Nº de semanas abiertas del periodo (1 para una semana). */
  openWeeks: number;
};

export type Unit = "eur" | "pct" | "int" | "num" | "weeks";
/** higher: más es mejor · lower: menos es mejor · range: dentro de [objetivo, objetivoMax] · none: informativo */
export type Direction = "higher" | "lower" | "range" | "none";

export type KpiDef = {
  key: string;
  label: string;
  area: AreaKey;
  unit: Unit;
  direction: Direction;
  description: string;
  compute: (t: Totals, ctx: KpiContext) => number | null;
  /** Objetivo inicial (por semana). */
  defaultTarget?: number;
  /** Límite superior para direction = "range". */
  defaultTargetMax?: number;
  /** El objetivo es semanal y se suma al agregar periodos (p. ej. ventas €). */
  additive?: boolean;
  /** Banda de alerta absoluta (en vez del 85 % / 120 % relativo). Útil cuando el objetivo es 0. */
  alertBand?: number;
  /** Aparece en el dashboard ejecutivo. */
  dashboard?: boolean;
  /** El objetivo no se puede editar (p. ej. % vs objetivo = 100 %). */
  fixedTarget?: boolean;
};

const div = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : a / b;

export const KPIS: KpiDef[] = [
  // ───────────── Ventas
  { key: "sales", label: "Ventas (€)", area: "ventas", unit: "eur", direction: "higher", additive: true, dashboard: true,
    defaultTarget: 46500, description: "Importe de pedidos vendidos en la semana.", compute: (t) => t.sales_eur },
  { key: "sales_vs_target", label: "% vs objetivo ventas", area: "ventas", unit: "pct", direction: "higher", dashboard: true, fixedTarget: true,
    defaultTarget: 1, description: "Ventas / objetivo de ventas.", compute: (t, c) => div(t.sales_eur, c.salesTarget) },
  { key: "sales_vs_prev_year", label: "% vs año anterior", area: "ventas", unit: "pct", direction: "higher", dashboard: true, alertBand: 0.1,
    defaultTarget: 0, description: "Crecimiento frente a la misma semana del año anterior.",
    compute: (t) => { const r = div(t.sales_matched_eur ?? t.sales_eur, t.sales_prev_year_eur); return r == null ? null : r - 1; } },
  { key: "orders", label: "Nº pedidos", area: "ventas", unit: "int", direction: "none", description: "Pedidos vendidos.", compute: (t) => t.orders_count },
  { key: "avg_ticket", label: "Ticket medio venta", area: "ventas", unit: "eur", direction: "none",
    description: "Ventas / nº de pedidos.", compute: (t) => div(t.sales_eur, t.orders_count) },
  { key: "book_to_bill", label: "Book-to-bill", area: "ventas", unit: "num", direction: "higher", defaultTarget: 1, alertBand: 0.15,
    description: "Ventas / pedidos servidos. Mayor que 1 = la cartera crece.", compute: (t) => div(t.sales_eur, t.served_eur) },

  // ───────────── Presupuestos
  { key: "quotes_sent", label: "Presupuestos enviados", area: "presupuestos", unit: "int", direction: "none", description: "Nº de presupuestos enviados.", compute: (t) => t.quotes_sent },
  { key: "quotes_confirmed", label: "Presupuestos confirmados", area: "presupuestos", unit: "int", direction: "none", description: "Nº de presupuestos confirmados.", compute: (t) => t.quotes_confirmed },
  { key: "quotes_rate", label: "% presupuestos confirmados", area: "presupuestos", unit: "pct", direction: "higher", defaultTarget: 0.3, dashboard: true,
    description: "Confirmados / enviados.", compute: (t) => div(t.quotes_confirmed, t.quotes_sent) },
  { key: "quotes_confirmed_eur", label: "Presupuestos confirmados (€)", area: "presupuestos", unit: "eur", direction: "none",
    description: "Importe confirmado.", compute: (t) => t.quotes_confirmed_eur },
  { key: "avg_quote", label: "Importe medio presupuesto confirmado", area: "presupuestos", unit: "eur", direction: "none",
    description: "€ confirmados / nº confirmados.", compute: (t) => div(t.quotes_confirmed_eur, t.quotes_confirmed) },

  // ───────────── Marketing y leads
  { key: "leads", label: "Leads generados", area: "marketing", unit: "int", direction: "higher", additive: true, dashboard: true,
    defaultTarget: 75, description: "Leads nuevos de la semana.", compute: (t) => t.leads_generated },
  { key: "lead_conversion", label: "% conversión lead→venta", area: "marketing", unit: "pct", direction: "higher", dashboard: true,
    defaultTarget: 0.1, description: "Leads convertidos en venta / leads generados.", compute: (t) => div(t.leads_to_sale, t.leads_generated) },
  { key: "leads_contacted_pct", label: "% leads contactados", area: "marketing", unit: "pct", direction: "higher", dashboard: true,
    defaultTarget: 0.8, description: "Leads contactados / leads generados.", compute: (t) => div(t.leads_contacted, t.leads_generated) },
  { key: "leads_contacted_24h_pct", label: "% leads contactados < 24 h", area: "marketing", unit: "pct", direction: "higher",
    defaultTarget: 0.8, description: "Leads contactados en menos de 24 h / leads generados.", compute: (t) => div(t.leads_contacted_24h, t.leads_generated) },
  { key: "leads_unworked", label: "Leads sin trabajar", area: "marketing", unit: "int", direction: "lower", additive: true, dashboard: true,
    defaultTarget: 10, description: "Leads generados − contactados.",
    compute: (t) => (t.leads_generated == null || t.leads_contacted == null ? null : t.leads_generated - t.leads_contacted) },
  { key: "cpl", label: "CPL (€)", area: "marketing", unit: "eur", direction: "lower", defaultTarget: 15,
    description: "Coste por lead.", compute: (t) => t.cpl_eur },
  { key: "landing_conversion", label: "% conversión landing", area: "marketing", unit: "pct", direction: "higher", defaultTarget: 0.03,
    description: "Visitas de la landing que dejan sus datos.", compute: (t) => t.landing_conversion_pct },
  { key: "marketing_spend", label: "Inversión marketing estimada (€)", area: "marketing", unit: "eur", direction: "none",
    description: "Leads × CPL.", compute: (t) => (t.leads_generated == null || t.cpl_eur == null ? null : t.leads_generated * t.cpl_eur) },
  { key: "cac", label: "Coste por venta (CAC)", area: "marketing", unit: "eur", direction: "none",
    description: "Inversión estimada / leads convertidos en venta.",
    compute: (t) => div(t.leads_generated == null || t.cpl_eur == null ? null : t.leads_generated * t.cpl_eur, t.leads_to_sale) },

  // ───────────── Operaciones
  { key: "served", label: "Pedidos servidos (€)", area: "operaciones", unit: "eur", direction: "higher", additive: true, dashboard: true,
    defaultTarget: 43000, description: "Importe servido en la semana.", compute: (t) => t.served_eur },
  { key: "served_count", label: "Nº pedidos servidos", area: "operaciones", unit: "int", direction: "none", description: "Pedidos servidos.", compute: (t) => t.served_count },
  { key: "late_pct", label: "% fuera de plazo", area: "operaciones", unit: "pct", direction: "lower", dashboard: true,
    defaultTarget: 0.1, description: "Pedidos fuera de plazo / pedidos servidos.", compute: (t) => div(t.late_orders_count, t.served_count) },
  { key: "late_eur", label: "Pedidos atrasados (€)", area: "operaciones", unit: "eur", direction: "lower", additive: true, dashboard: true,
    defaultTarget: 5000, description: "Importe de pedidos atrasados.", compute: (t) => t.late_orders_eur },
  { key: "pending_eur", label: "Cartera pendiente (€)", area: "operaciones", unit: "eur", direction: "none",
    description: "Pedidos pendientes de servir (€).", compute: (t) => t.pending_orders_eur },
  { key: "pending_count", label: "Nº pedidos pendientes", area: "operaciones", unit: "int", direction: "none",
    description: "Pedidos pendientes de servir.", compute: (t) => t.pending_orders_count },
  { key: "avg_pending", label: "Valor medio pedido pendiente", area: "operaciones", unit: "eur", direction: "none",
    description: "€ pendientes / nº pendientes.", compute: (t) => div(t.pending_orders_eur, t.pending_orders_count) },
  { key: "factory_load", label: "Carga de fábrica (semanas)", area: "operaciones", unit: "weeks", direction: "range", dashboard: true,
    defaultTarget: 4, defaultTargetMax: 5, alertBand: 1, description: "Cartera pendiente / capacidad semanal de fábrica.",
    compute: (t, c) => div(t.pending_orders_eur, c.capacity) },

  // ───────────── Calidad
  { key: "incidents_pct", label: "% incidencias", area: "calidad", unit: "pct", direction: "lower", dashboard: true,
    defaultTarget: 0.05, description: "Incidencias / nº de pedidos.", compute: (t) => div(t.incidents_count, t.orders_count) },
  { key: "incidents", label: "Nº incidencias", area: "calidad", unit: "int", direction: "none", description: "Incidencias registradas.", compute: (t) => t.incidents_count },
  { key: "incidents_late_pct", label: "% incidencias fuera de plazo", area: "calidad", unit: "pct", direction: "lower", defaultTarget: 0.2,
    description: "Incidencias resueltas fuera de plazo / incidencias.", compute: (t) => div(t.incidents_late_count, t.incidents_count) },
];

export const KPI_BY_KEY: Record<string, KpiDef> = Object.fromEntries(KPIS.map((k) => [k.key, k]));
export const DASHBOARD_KPIS = KPIS.filter((k) => k.dashboard);
export const kpisOfArea = (area: AreaKey) => KPIS.filter((k) => k.area === area);

/** Columnas del resumen mensual / trimestral / anual (y de su exportación). */
export const SUMMARY_KPIS = [
  "sales", "sales_vs_target", "sales_vs_prev_year", "orders", "avg_ticket", "served", "leads",
  "lead_conversion", "quotes_rate", "incidents_pct", "late_pct", "late_eur", "factory_load",
];
