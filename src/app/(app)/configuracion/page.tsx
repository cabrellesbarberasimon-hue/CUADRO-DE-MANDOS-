import { Card, PageHeader, Badge, Field } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { q } from "@/lib/db/client";
import { databaseUrl } from "@/lib/db/client";
import { AREAS } from "@/config/areas";
import { KPIS, type KpiDef } from "@/config/kpis";
import { MONTHS } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";
import { deleteTarget, saveGeneralSettings, saveKpiThreshold, saveTarget } from "@/app/actions/admin";

type TargetDb = { id: number; kpi_key: string; year: number | null; month: number | null; week: number | null; value: number; value_max: number | null; note: string | null };

/** Objetivos pendientes de confirmar por dirección. */
const TO_CONFIRM: Record<string, string> = {
  late_eur: "En el Excel ponía 5 (€). Se ha puesto 5.000 € provisionalmente: confírmalo.",
  quotes_rate: "Objetivo nuevo propuesto (30 %).",
  cpl: "Objetivo nuevo propuesto (15 €).",
  landing_conversion: "Objetivo nuevo propuesto (3 %).",
  leads_contacted_24h_pct: "Objetivo nuevo propuesto (80 %).",
  incidents_late_pct: "Objetivo nuevo propuesto (20 %).",
  book_to_bill: "Objetivo nuevo propuesto (1,0).",
};

const toInput = (v: number | null | undefined, def: KpiDef) => (v == null ? "" : String(def.unit === "pct" ? +(v * 100).toFixed(4) : v).replace(".", ","));

export default async function Configuracion() {
  await requireUser(can.configure);
  const settings = await getSettings();
  const targets = await q<TargetDb>(`select id, kpi_key, year, month, week, value, value_max, note from targets order by kpi_key, year nulls first, month nulls first, week nulls first`);
  const editable = KPIS.filter((k) => k.direction !== "none" && !k.fixedTarget);
  const th = settings.thresholds;

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Objetivos, umbrales del semáforo, capacidad de fábrica, responsables y avisos." />

      <Card title="General">
        <StatefulForm action={saveGeneralSettings} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Capacidad semanal de fábrica (€)" hint="Carga de fábrica = cartera pendiente / capacidad.">
              <input name="capacity_eur" defaultValue={String(settings.capacity_eur)} className="input" />
            </Field>
            <Field label="Alerta si (mayor es mejor) ≥ % del objetivo" hint="Por debajo de esto: Mal. Por defecto 85.">
              <input name="alertLow" defaultValue={String(Math.round(th.alertLow * 100))} className="input" />
            </Field>
            <Field label="Alerta si (menor es mejor) ≤ % del objetivo" hint="Por encima de esto: Mal. Por defecto 120.">
              <input name="alertHigh" defaultValue={String(Math.round(th.alertHigh * 100))} className="input" />
            </Field>
          </div>
          <div>
            <h3 className="label">Responsables por área</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {AREAS.map((a) => (
                <Field key={a.key} label={a.label}><input name={`owner_${a.key}`} defaultValue={settings.area_owners?.[a.key] ?? a.defaultOwner} className="input" /></Field>
              ))}
            </div>
          </div>
          <Field label="Emails adicionales para el resumen semanal y KPIs en rojo" hint="Separados por comas. Los usuarios de la app ya lo reciben según su perfil.">
            <input name="alert_recipients" defaultValue={(settings.alert_recipients ?? []).join(", ")} className="input" />
          </Field>
          <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
        </StatefulForm>
      </Card>

      <Card title="Objetivos (valor general)">
        <p className="mb-4 text-sm text-muted">Valor semanal por defecto. Para KPIs en € o cantidades, al agregar meses/años se suma semana a semana. Deja vacío para volver al valor inicial.</p>
        <table className="data-table">
          <thead><tr><th>KPI</th><th>Dirección</th><th className="num">Inicial</th><th>Objetivo vigente</th><th></th></tr></thead>
          <tbody>
            {editable.map((def) => {
              const g = targets.find((t) => t.kpi_key === def.key && t.year == null && t.month == null && t.week == null);
              return (
                <tr key={def.key}>
                  <td>
                    <div className="font-medium">{def.label}</div>
                    {TO_CONFIRM[def.key] && !g && <div className="mt-0.5"><Badge tone="warn">Pendiente de confirmar</Badge> <span className="text-xs text-muted">{TO_CONFIRM[def.key]}</span></div>}
                  </td>
                  <td className="text-xs text-muted">{def.direction === "higher" ? "Mayor es mejor" : def.direction === "lower" ? "Menor es mejor" : "Rango"}</td>
                  <td className="num text-muted">{def.direction === "range" ? `${def.defaultTarget}–${def.defaultTargetMax}` : fmt(def.defaultTarget, def.unit)}</td>
                  <td colSpan={2}>
                    <form action={saveTarget} className="flex items-center gap-2">
                      <input type="hidden" name="kpi_key" value={def.key} />
                      <input name="value" defaultValue={toInput(g?.value ?? def.defaultTarget, def)} className="input w-32 text-right" aria-label="Objetivo" />
                      {def.direction === "range" && <><span>–</span><input name="value_max" defaultValue={toInput(g?.value_max ?? def.defaultTargetMax, def)} className="input w-24 text-right" aria-label="Máximo" /></>}
                      <span className="text-xs text-muted">{def.unit === "pct" ? "%" : def.unit === "eur" ? "€" : def.unit === "weeks" ? "semanas" : ""}</span>
                      <SubmitButton variant="outline">Guardar</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Objetivos específicos (estacionalidad)">
        <p className="mb-4 text-sm text-muted">Sustituyen al general en un mes (de todos los años o de un año concreto) o en una semana concreta. Prioridad: semana &gt; mes &gt; año &gt; general.</p>
        <form action={saveTarget} className="mb-4 grid grid-cols-2 items-end gap-2 md:grid-cols-6">
          <Field label="KPI">
            <select name="kpi_key" className="input">{editable.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          </Field>
          <Field label="Año (opcional)"><input name="year" type="number" className="input" placeholder="Todos" /></Field>
          <Field label="Mes">
            <select name="month" className="input"><option value="">—</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          </Field>
          <Field label="Semana (opcional)"><input name="week" type="number" min={1} max={53} className="input" /></Field>
          <Field label="Objetivo"><input name="value" className="input" required placeholder="En % si es porcentaje" /></Field>
          <SubmitButton variant="outline">Añadir</SubmitButton>
        </form>
        <table className="data-table">
          <thead><tr><th>KPI</th><th>Ámbito</th><th className="num">Objetivo</th><th></th></tr></thead>
          <tbody>
            {targets.filter((t) => t.year != null || t.month != null || t.week != null).map((t) => {
              const def = KPIS.find((k) => k.key === t.kpi_key);
              return (
                <tr key={t.id}>
                  <td>{def?.label ?? t.kpi_key}</td>
                  <td>{[t.year ?? "Todos los años", t.month ? MONTHS[t.month - 1] : null, t.week ? `Semana ${t.week}` : null].filter(Boolean).join(" · ")}</td>
                  <td className="num">{def ? fmt(t.value, def.unit) : t.value}</td>
                  <td className="text-right"><form action={deleteTarget}><input type="hidden" name="id" value={t.id} /><button className="text-xs text-bad underline">Quitar</button></form></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Umbrales del semáforo por KPI (opcional)">
        <p className="mb-4 text-sm text-muted">Por defecto se usan los generales ({Math.round(th.alertLow * 100)} % / {Math.round(th.alertHigh * 100)} %). KPIs con banda fija (% vs año anterior, book-to-bill, carga de fábrica) no usan estos umbrales.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {editable.filter((k) => k.alertBand == null).map((def) => {
            const o = settings.kpi_thresholds?.[def.key];
            return (
              <form key={def.key} action={saveKpiThreshold} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="kpi_key" value={def.key} />
                <span className="w-56 truncate">{def.label}</span>
                {def.direction === "higher" ? (
                  <input name="alertLow" defaultValue={o ? Math.round(o.alertLow * 100) : ""} placeholder={String(Math.round(th.alertLow * 100))} className="input w-20" aria-label="Alerta desde %" />
                ) : (
                  <input name="alertHigh" defaultValue={o ? Math.round(o.alertHigh * 100) : ""} placeholder={String(Math.round(th.alertHigh * 100))} className="input w-20" aria-label="Alerta hasta %" />
                )}
                <span className="text-xs text-muted">%</span>
                <button className="rounded border border-line px-2 py-1 text-xs hover:border-ink">OK</button>
              </form>
            );
          })}
        </div>
      </Card>

      <Card title="Estado del sistema">
        <ul className="space-y-1 text-sm">
          <li>Base de datos: {databaseUrl() ? <Badge tone="ok">Postgres conectado</Badge> : <Badge tone="warn">Local (PGlite)</Badge>}</li>
          <li>Emails (Resend): {emailEnabled() ? <Badge tone="ok">Activo</Badge> : <Badge tone="warn">Sin configurar (RESEND_API_KEY)</Badge>}</li>
          <li>Resumen con IA: {aiEnabled() ? <Badge tone="ok">Activo</Badge> : <Badge tone="warn">Sin configurar (ANTHROPIC_API_KEY)</Badge>}</li>
          <li>Tareas programadas: {process.env.CRON_SECRET ? <Badge tone="ok">Protegidas</Badge> : <Badge tone="warn">Falta CRON_SECRET</Badge>}</li>
        </ul>
      </Card>
    </div>
  );
}
