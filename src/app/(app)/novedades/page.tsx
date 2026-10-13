import { Card, PageHeader } from "@/components/ui";
import { CHANGELOG } from "@/config/changelog";
import { fmtDate } from "@/lib/format";

export default function Novedades() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Novedades" subtitle="Cambios de la app, del más reciente al más antiguo." />
      {CHANGELOG.map((c) => (
        <Card key={c.version} title={`Versión ${c.version} · ${fmtDate(c.date)}`}>
          <ul className="list-disc space-y-1 pl-5 text-sm">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </Card>
      ))}
    </div>
  );
}
