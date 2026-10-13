import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { login } from "@/app/actions/auth";
import { getCurrentUser, userCount } from "@/lib/auth";
import { missingDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (missingDatabase()) redirect("/sin-base-de-datos");
  if ((await userCount()) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell title="Iniciar sesión" subtitle="Cuadro de mandos semanal">
      <StatefulForm action={login} className="space-y-4">
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className="input" autoFocus />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </Field>
        <SubmitButton className="w-full">Entrar</SubmitButton>
        <p className="text-xs text-muted">¿Has olvidado la contraseña? Pide a un administrador que la restablezca.</p>
      </StatefulForm>
    </AuthShell>
  );
}
