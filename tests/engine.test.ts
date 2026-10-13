import { describe, expect, it } from "vitest";
import { KPI_BY_KEY } from "@/config/kpis";
import { aggregate, evaluate, makeTargetResolver, statusOf, emptyTotals, completeness, DEFAULT_THRESHOLDS, type WeekRow } from "@/lib/kpis/engine";
import { isoWeekStart, monthOfWeek, weeksInYear, isoWeekOf } from "@/lib/calendar";
import { parseNumber } from "@/lib/format";

const row = (week: number, data: Partial<WeekRow> = {}): WeekRow =>
  ({ ...emptyTotals(), year: 2026, week, start_date: null, end_date: null, is_closed: false, owner: null, comment: null, weekly_action: null, ...data }) as WeekRow;

const opts = {
  capacity: 45000,
  resolveTarget: makeTargetResolver([], monthOfWeek),
  thresholds: () => DEFAULT_THRESHOLDS,
};

const value = (rows: WeekRow[], key: string) => evaluate(rows, opts, [KPI_BY_KEY[key]])[0];

describe("semáforo", () => {
  const sales = KPI_BY_KEY.sales;
  it("mayor es mejor: Bien / Alerta (≥85 %) / Mal", () => {
    expect(statusOf(sales, 46500, { value: 46500, max: null })).toBe("bien");
    expect(statusOf(sales, 40000, { value: 46500, max: null })).toBe("alerta");
    expect(statusOf(sales, 39000, { value: 46500, max: null })).toBe("mal");
  });
  it("menor es mejor: Bien / Alerta (≤120 %) / Mal", () => {
    const late = KPI_BY_KEY.late_pct;
    expect(statusOf(late, 0.1, { value: 0.1, max: null })).toBe("bien");
    expect(statusOf(late, 0.12, { value: 0.1, max: null })).toBe("alerta");
    expect(statusOf(late, 0.13, { value: 0.1, max: null })).toBe("mal");
  });
  it("rango (carga de fábrica 4-5 semanas)", () => {
    const fl = KPI_BY_KEY.factory_load;
    expect(statusOf(fl, 4.5, { value: 4, max: 5 })).toBe("bien");
    expect(statusOf(fl, 3.5, { value: 4, max: 5 })).toBe("alerta");
    expect(statusOf(fl, 5.8, { value: 4, max: 5 })).toBe("alerta");
    expect(statusOf(fl, 2.9, { value: 4, max: 5 })).toBe("mal");
    expect(statusOf(fl, 6.1, { value: 4, max: 5 })).toBe("mal");
  });
  it("sin dato no penaliza", () => {
    expect(statusOf(sales, null, { value: 46500, max: null })).toBe("sin_dato");
  });
  it("crecimiento vs año anterior usa banda absoluta", () => {
    const g = KPI_BY_KEY.sales_vs_prev_year;
    expect(statusOf(g, 0.02, { value: 0, max: null })).toBe("bien");
    expect(statusOf(g, -0.05, { value: 0, max: null })).toBe("alerta");
    expect(statusOf(g, -0.2, { value: 0, max: null })).toBe("mal");
  });
});

describe("fórmulas", () => {
  it("divisor 0 o vacío → null", () => {
    expect(value([row(1, { sales_eur: 1000, orders_count: 0 })], "avg_ticket").value).toBeNull();
    expect(value([row(1, { sales_eur: 1000 })], "avg_ticket").value).toBeNull();
  });
  it("% fuera de plazo se calcula sobre pedidos servidos (corrección)", () => {
    expect(value([row(1, { late_orders_count: 2, served_count: 32, pending_orders_count: 85 })], "late_pct").value).toBeCloseTo(2 / 32);
  });
  it("carga de fábrica = pendiente € / capacidad", () => {
    expect(value([row(1, { pending_orders_eur: 171736 })], "factory_load").value).toBeCloseTo(171736 / 45000);
  });
  it("semana cerrada → estado Cerrada", () => {
    expect(value([row(33, { is_closed: true })], "sales").status).toBe("cerrada");
  });
});

describe("agregados", () => {
  const rows = [
    row(19, { sales_eur: 100, orders_count: 2, incidents_count: 1, pending_orders_eur: 900, sales_prev_year_eur: 50 }),
    row(20, { sales_eur: 300, orders_count: 8, incidents_count: 1, pending_orders_eur: 450, sales_prev_year_eur: 150 }),
    row(21, { sales_prev_year_eur: 999 }), // sin ventas todavía: no entra en la comparación
    row(22, { is_closed: true, sales_eur: 5000 }),
  ];
  it("suma, último valor para stock y excluye semanas cerradas", () => {
    const t = aggregate(rows);
    expect(t.sales_eur).toBe(400);
    expect(t.pending_orders_eur).toBe(450);
    expect(t.sales_prev_year_eur).toBe(200);
  });
  it("porcentajes recalculados con totales (no media de %)", () => {
    expect(value(rows, "incidents_pct").value).toBeCloseTo(2 / 10);
  });
  it("objetivo sumable = suma de objetivos semanales reportados", () => {
    expect(value(rows, "sales").target.value).toBe(46500 * 2);
    expect(value(rows, "sales_vs_target").value).toBeCloseTo(400 / 93000);
  });
  it("completitud", () => {
    expect(completeness(row(1))).toBe(0);
    expect(completeness(row(1, { sales_eur: 1 }))).toBeGreaterThan(0);
  });
});

describe("objetivos", () => {
  it("prioridad semana > mes > general > por defecto", () => {
    const r = makeTargetResolver(
      [
        { kpi_key: "sales", year: null, month: null, week: null, value: 40000, value_max: null },
        { kpi_key: "sales", year: null, month: 8, week: null, value: 0, value_max: null },
        { kpi_key: "sales", year: 2026, month: null, week: 20, value: 50000, value_max: null },
      ],
      monthOfWeek,
    );
    expect(r(KPI_BY_KEY.sales, 2026, 10).value).toBe(40000);
    expect(r(KPI_BY_KEY.sales, 2026, 33).value).toBe(0);
    expect(r(KPI_BY_KEY.sales, 2026, 20).value).toBe(50000);
    expect(r(KPI_BY_KEY.leads, 2026, 20).value).toBe(75);
  });
});

describe("calendario ISO", () => {
  it("semanas del Excel original", () => {
    expect(isoWeekStart(2026, 19).toISOString().slice(0, 10)).toBe("2026-05-04");
    expect(isoWeekStart(2026, 36).toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(isoWeekOf(new Date("2026-10-13")).week).toBe(42);
  });
  it("semana entre dos meses → mes del jueves", () => {
    expect(monthOfWeek(2026, 27)).toBe(7); // 29/06–05/07: jueves 2 de julio
    expect(monthOfWeek(2026, 36)).toBe(9);
  });
  it("años de 52/53 semanas", () => {
    expect(weeksInYear(2026)).toBe(53);
    expect(weeksInYear(2027)).toBe(52);
  });
});

describe("números en español", () => {
  it("parsea formatos habituales", () => {
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("12,5 %")).toBe(0.125);
    expect(parseNumber("45000")).toBe(45000);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("% vs año anterior homogéneo", () => {
  it("solo compara semanas con dato en ambos años", () => {
    const rows = [row(40, { sales_eur: 45440 }), row(41, { sales_eur: 19905, sales_prev_year_eur: 44073.75 })];
    expect(value(rows, "sales_vs_prev_year").value).toBeCloseTo(19905 / 44073.75 - 1);
  });
});

describe("variable de base de datos", () => {
  it("acepta DATABASE_URL con prefijo de Neon", async () => {
    const { databaseUrl } = await import("@/lib/db/client");
    const saved = { ...process.env };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.CUADRO_DATABASE_URL_UNPOOLED = "postgres://unpooled";
    process.env.CUADRO_DATABASE_URL = "postgres://pooled";
    expect(databaseUrl()).toBe("postgres://pooled");
    process.env = saved;
  });
});
