"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { previewImport, confirmImport, type PreviewResult } from "@/app/actions/import";
import { Badge, Button, Notice } from "./ui";
import { SubmitButton } from "./forms";
import { fmt } from "@/lib/format";
import { FIELD_BY_KEY } from "@/config/fields";

const show = (field: string, v: unknown) => {
  if (v == null || v === "") return "—";
  const f = FIELD_BY_KEY[field];
  if (f && typeof v === "number") return fmt(v, f.type);
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
};

export function ImportWizard({ defaultYear }: { defaultYear: number }) {
  const [preview, action] = useActionState<PreviewResult | undefined, FormData>(previewImport, undefined);
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const [onlyChanges, setOnlyChanges] = useState(true);
  const router = useRouter();
  const rows = preview?.rows ?? [];
  const toApply = rows.filter((r) => r.status !== "sin_cambios");
  const visible = onlyChanges ? toApply : rows;

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3" onSubmit={() => setResult(null)}>
        <label className="block">
          <span className="label">Archivo (.xlsx o .csv)</span>
          <input type="file" name="file" accept=".xlsx,.csv" required className="input" />
        </label>
        <label className="block">
          <span className="label">Año (si el archivo no lo indica)</span>
          <input type="number" name="year" defaultValue={defaultYear} className="input w-28" />
        </label>
        <SubmitButton variant="outline"><Upload size={16} /> Previsualizar</SubmitButton>
      </form>

      {preview?.error && <Notice tone="bad">{preview.error}</Notice>}
      {result?.ok && <Notice tone="ok">{result.ok}</Notice>}
      {result?.error && <Notice tone="bad">{result.error}</Notice>}

      {preview?.rows && !result?.ok && (
        <div className="space-y-3">
          <Notice tone="info">
            <b>{preview.filename}</b> · formato detectado: <b>{preview.mapping?.label}</b> · {rows.length} semanas leídas ·{" "}
            {rows.filter((r) => r.status === "nueva").length} nuevas · {rows.filter((r) => r.status === "actualiza").length} con cambios ·{" "}
            {rows.filter((r) => r.status === "sin_cambios").length} sin cambios
          </Notice>
          {!!preview.issues?.length && (
            <Notice tone="warn">
              <b>{preview.issues.length} valores rechazados</b> (no se importarán):
              <ul className="mt-1 list-disc pl-5">{preview.issues.slice(0, 15).map((i, k) => <li key={k}>Fila {i.row}: {i.message}</li>)}</ul>
            </Notice>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} /> Mostrar solo semanas con cambios
          </label>
          <div className="max-h-[480px] overflow-auto rounded-md border border-line">
            <table className="data-table">
              <thead><tr><th>Semana</th><th>Estado</th><th>Cambios</th></tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={`${r.year}-${r.week}`}>
                    <td className="whitespace-nowrap font-medium">S{r.week} / {r.year}</td>
                    <td><Badge tone={r.status === "nueva" ? "ok" : r.status === "actualiza" ? "warn" : "neutral"}>{r.status === "nueva" ? "Nueva" : r.status === "actualiza" ? "Actualiza" : "Sin cambios"}</Badge></td>
                    <td className="text-xs">
                      {r.changes.map((c) => (
                        <span key={c.field} className="mr-3 inline-block">
                          {c.label}: <span className="text-muted line-through">{show(c.field, c.before)}</span> → <b>{show(c.field, c.after)}</b>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={pending || toApply.length === 0}
              onClick={() =>
                start(async () => {
                  const res = await confirmImport({
                    filename: preview.filename ?? "",
                    mapping: preview.mapping?.id ?? "",
                    rows: toApply.map((r) => r.data),
                    issues: preview.issues ?? [],
                  });
                  setResult(res);
                  router.refresh();
                })
              }
            >
              {pending ? "Importando…" : `Confirmar importación (${toApply.length} semanas)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
