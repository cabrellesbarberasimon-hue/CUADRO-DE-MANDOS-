import { Card, Notice, PageHeader, Field } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { ROLES, requireUser } from "@/lib/auth";
import { changePassword, saveNotifications } from "@/app/actions/auth";

const NOTIFS = [
  { key: "weekly_summary", label: "Resumen semanal (lunes)", roles: ["admin", "direccion"] },
  { key: "red_kpi", label: "Aviso cuando un KPI pasa a Mal", roles: ["admin", "direccion"] },
  { key: "reminder", label: "Recordatorio de carga de datos", roles: ["admin", "editor"] },
  { key: "actions", label: "Acciones vencidas o que vencen pronto", roles: ["admin", "direccion", "editor", "lector"] },
];

export default async function Perfil({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Mi perfil" subtitle={`${user.name} · ${user.email} · ${ROLES.find((r) => r.key === user.role)?.label}`} />
      {user.must_change_password && <Notice tone="warn">Estás usando una contraseña temporal. Cámbiala ahora.</Notice>}
      <Card title="Cambiar contraseña">
        <StatefulForm action={changePassword} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Contraseña actual"><input name="current" type="password" required className="input" /></Field>
          <Field label="Nueva contraseña"><input name="password" type="password" required minLength={8} className="input" /></Field>
          <Field label="Repetir nueva"><input name="confirm" type="password" required minLength={8} className="input" /></Field>
          <div className="md:col-span-3 flex justify-end"><SubmitButton>Cambiar</SubmitButton></div>
        </StatefulForm>
      </Card>
      <Card title="Avisos por email">
        {sp.ok && <div className="mb-3"><Notice tone="ok">Preferencias guardadas.</Notice></div>}
        <form action={saveNotifications} className="space-y-2">
          {NOTIFS.map((n) => (
            <label key={n.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={n.key} defaultChecked={user.notify?.[n.key] !== false} />
              {n.label}
              {!n.roles.includes(user.role) && <span className="text-xs text-muted">(no aplica a tu rol)</span>}
            </label>
          ))}
          <div className="flex justify-end"><SubmitButton variant="outline">Guardar</SubmitButton></div>
        </form>
      </Card>
    </div>
  );
}
