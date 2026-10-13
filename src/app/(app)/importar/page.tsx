import { Download } from "lucide-react";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/import-wizard";
import { can, requireUser } from "@/lib/auth";
import { q } from "@/lib/db/client";
import { MAPPINGS } from "@/lib/import/mappings";
import { fmtDateTime } from "@/lib/format";
import { currentIsoWeek } from "@/lib/calendar";

export default async function Importar() {
  await requireUser(can.editData);
  const history = await q<{ id: number; filename: string; mapping: string; created_count: number; updated_count: number; rejected_count: number; created_at: string; user_name: string | null }>(
    `select i.*, u.name as user_name from imports i left join users u on u.id = i.user_id order by i.created_at desc limit 30`,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Excel"
        subtitle="Sube el archivo, revisa la previsualización y confirma. Solo se actualizan los campos que vienen en el archivo; todo queda registrado."
        actions={<LinkButton href={`/api/export/datos?y=${currentIsoWeek().year}`} prefetch={false}><Download size={16} /> Descargar plantilla</LinkButton>}
      />
      <Card title="1. Subir archivo"><ImportWizard defaultYear={currentIsoWeek().year} /></Card>
      <Card title="Formatos admitidos">
        <ul className="space-y-2 text-sm">
          {MAPPINGS.map((m) => <li key={m.id}><b>{m.label}</b> — <span className="text-muted">{m.description}</span></li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">¿Vas a usar otro archivo? Pásaselo a Claude Code y pídele: “añade un mapeo de importación para este archivo”.</p>
      </Card>
      <Card title="Historial de importaciones">
        {history.length === 0 ? <p className="text-sm text-muted">Todavía no se ha importado nada.</p> : (
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Archivo</th><th>Formato</th><th className="num">Nuevas</th><th className="num">Actualizadas</th><th className="num">Rechazados</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}><td>{fmtDateTime(h.created_at)}</td><td>{h.user_name ?? "—"}</td><td>{h.filename}</td><td>{MAPPINGS.find((m) => m.id === h.mapping)?.label ?? h.mapping}</td><td className="num">{h.created_count}</td><td className="num">{h.updated_count}</td><td className="num">{h.rejected_count}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
