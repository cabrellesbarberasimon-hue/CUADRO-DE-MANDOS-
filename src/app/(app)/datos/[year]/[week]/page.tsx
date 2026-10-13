import { Card, LinkButton, PageHeader } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { WeekPicker } from "@/components/week-picker";
import { can, requireUser } from "@/lib/auth";
import { getAudit, getWeek, getYears } from "@/lib/data";
import { saveWeek } from "@/app/actions/business";
import { AREAS } from "@/config/areas";
import { FIELD_BY_KEY, INPUT_FIELDS, TEXT_FIELDS } from "@/config/fields";
import { isoWeekEnd, isoWeekStart } from "@/lib/calendar";
import { fmt, fmtDate, fmtDateTime } from "@/lib/format";
import { completeness } from "@/lib/kpis/engine";

const toInput = (v: number | null | undefined, pct: boolean) =>
  v == null ? "" : pct ? String(+(v * 100).toFixed(4)).replace(".", ",") : String(v).replace(".", ",");

export default async function WeekForm({ params }: { params: Promise<{ year: string; week: string }> }) {
  const p = await params;
  const year = Number(p.year);
  const week = Number(p.week);
  const user = await requireUser();
  const editable = can.editData(user);
  const [row, years, audit] = await Promise.all([getWeek(year, week), getYears(), getAudit("week", `${year}-${week}`)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cargar semana ${week} · ${year}`}
        subtitle={`${fmtDate(isoWeekStart(year, week))} – ${fmtDate(isoWeekEnd(year, week))} · ${row ? `${Math.round(completeness(row) * 100)} % completa` : "sin datos"}`}
        actions={
          <>
            <WeekPicker year={year} week={week} years={years} basePath="/datos" />
            <LinkButton href={`/?y=${year}&w=${week}`} variant="ghost">Ver dashboard</LinkButton>
          </>
        }
      />
      <StatefulForm action={saveWeek} className="space-y-6">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="week" value={week} />
        <Card>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_closed" defaultChecked={row?.is_closed} disabled={!editable} />
            Semana cerrada (vacaciones / sin actividad): no cuenta en semáforos, medias ni objetivos.
          </label>
        </Card>
        {AREAS.map((a) => {
          const fields = INPUT_FIELDS.filter((f) => f.area === a.key);
          return (
            <Card key={a.key} title={a.label}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="label">{f.label}{f.type === "pct" ? " (%)" : ""}</span>
                    <input
                      name={f.key}
                      inputMode="decimal"
                      defaultValue={toInput(row?.[f.key], f.type === "pct")}
                      className="input text-right tabular-nums"
                      disabled={!editable}
                      placeholder="Sin dato"
                    />
                    {"help" in f && f.help && <span className="mt-1 block text-xs text-muted">{f.help}</span>}
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
        <Card title="Seguimiento">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {TEXT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="label">{f.label}</span>
                {f.key === "owner" ? (
                  <input name={f.key} defaultValue={row?.owner ?? user.name} className="input" disabled={!editable} />
                ) : (
                  <textarea name={f.key} rows={3} defaultValue={row?.[f.key] ?? ""} className="input" disabled={!editable} />
                )}
              </label>
            ))}
          </div>
        </Card>
        {editable && <div className="flex justify-end"><SubmitButton>Guardar semana</SubmitButton></div>}
      </StatefulForm>

      <Card title="Historial de cambios">
        {audit.length === 0 ? (
          <p className="text-sm text-muted">Sin cambios registrados (los datos iniciales vienen del Excel original).</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Campo</th><th className="num">Antes</th><th className="num">Después</th><th>Origen</th></tr></thead>
            <tbody>
              {audit.map((a, i) => {
                const f = FIELD_BY_KEY[a.field];
                const show = (v: string | null) => (v == null ? "—" : f ? fmt(Number(v), f.type) : v);
                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                    <td>{a.user_name ?? "—"}</td>
                    <td>{f?.label ?? a.field}</td>
                    <td className="num">{show(a.old_value)}</td>
                    <td className="num">{show(a.new_value)}</td>
                    <td>{a.source === "import" ? "Importación" : "Manual"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
