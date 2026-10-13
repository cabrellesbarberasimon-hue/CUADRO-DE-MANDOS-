import { redirect } from "next/navigation";
import { AuthShell } from "@/components/brand";
import { StatefulForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { setupAdmin } from "@/app/actions/auth";
import { userCount } from "@/lib/auth";
import { missingDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (missingDatabase()) redirect("/sin-base-de-datos");
  if ((await userCount()) > 0) redirect("/login");
  const needsCode = Boolean(process.env.SETUP_CODE);
  return (
    <AuthShell title="Puesta en marcha" subtitle="Crea la cuenta del primer administrador. Después podrás crear el resto de usuarios.">
      <StatefulForm action={setupAdmin} className="space-y-4">
        <Field label="Nombre"><input name="name" required className="input" defaultValue="Simón" /></Field>
        <Field label="Email"><input name="email" type="email" required className="input" /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres."><input name="password" type="password" required minLength={8} className="input" /></Field>
        {needsCode && (
          <Field label="Código de instalación" hint="Variable SETUP_CODE configurada en Vercel.">
            <input name="code" required className="input" />
          </Field>
        )}
        <SubmitButton className="w-full">Crear administrador</SubmitButton>
      </StatefulForm>
    </AuthShell>
  );
}
