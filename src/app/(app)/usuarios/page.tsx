import { Card, PageHeader, Badge, Field } from "@/components/ui";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { ROLES, can, requireUser } from "@/lib/auth";
import { q } from "@/lib/db/client";
import { fmtDateTime } from "@/lib/format";
import { AREAS } from "@/config/areas";
import { createUser, resetPassword, updateUser } from "@/app/actions/admin";
import { emailEnabled } from "@/lib/email";

export default async function Usuarios() {
  const me = await requireUser(can.manageUsers);
  const users = await q<{ id: number; name: string; email: string; role: string; area: string | null; active: boolean; last_login_at: string | null }>(
    `select id, name, email, role, area, active, last_login_at from users order by active desc, name`,
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" subtitle="Crea cuentas y asigna roles. Al crear un usuario se genera una contraseña temporal." />
      <Card title="Nuevo usuario">
        <StatefulForm action={createUser} className="grid grid-cols-1 items-end gap-3 md:grid-cols-6">
          <Field label="Nombre"><input name="name" required className="input" /></Field>
          <Field label="Email"><input name="email" type="email" required className="input" /></Field>
          <Field label="Rol">
            <select name="role" defaultValue="lector" className="input">{ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
          </Field>
          <Field label="Área">
            <select name="area" className="input"><option value="">—</option>{AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
          </Field>
          <Field label="Contraseña (opcional)"><input name="password" type="text" minLength={8} placeholder="Se genera sola" className="input" /></Field>
          <div className="space-y-2">
            {emailEnabled() && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="send_email" defaultChecked /> Enviar acceso por email</label>}
            <SubmitButton>Crear usuario</SubmitButton>
          </div>
        </StatefulForm>
        <ul className="mt-4 grid grid-cols-1 gap-1 text-xs text-muted md:grid-cols-2">
          {ROLES.map((r) => <li key={r.key}><b className="text-ink">{r.label}:</b> {r.description}</li>)}
        </ul>
      </Card>
      <Card title={`Usuarios (${users.length})`}>
        <table className="data-table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Activo</th><th>Último acceso</th><th></th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "text-muted"}>
                <td colSpan={5} className="!p-0">
                  <form action={updateUser} className="grid grid-cols-[1fr_1fr_140px_140px_60px_auto] items-center gap-2 px-3 py-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="name" defaultValue={u.name} className="input py-1" />
                    <span className="truncate text-sm">{u.email}</span>
                    <select name="role" defaultValue={u.role} className="input py-1" disabled={u.id === me.id}>{ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
                    {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
                    <select name="area" defaultValue={u.area ?? ""} className="input py-1"><option value="">—</option>{AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
                    <input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === me.id} aria-label="Activo" />
                    {u.id === me.id && <input type="hidden" name="active" value="on" />}
                    <button className="rounded border border-line px-2 py-1 text-xs hover:border-ink">Guardar</button>
                  </form>
                </td>
                <td className="whitespace-nowrap text-xs">{u.last_login_at ? fmtDateTime(u.last_login_at) : <Badge>Nunca</Badge>}</td>
                <td colSpan={2}>
                  <StatefulForm action={resetPassword}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="text-xs underline">Restablecer contraseña</button>
                  </StatefulForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
