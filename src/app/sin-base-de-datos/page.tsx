import { AuthShell } from "@/components/brand";

export default function NoDatabase() {
  return (
    <AuthShell title="Falta conectar la base de datos" subtitle="La app está desplegada pero todavía no tiene dónde guardar los datos.">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Entra en vercel.com → tu proyecto → pestaña <b>Storage</b>.</li>
        <li>Pulsa <b>Create Database</b> → elige <b>Neon (Postgres)</b> → plan gratuito → región Frankfurt.</li>
        <li>Conéctala al proyecto (marca Production y Preview). Vercel crea la variable <code>DATABASE_URL</code>.</li>
        <li>Ve a <b>Deployments</b> → último despliegue → <b>Redeploy</b>.</li>
      </ol>
      <p className="mt-4 text-sm text-muted">Al volver a entrar, la app creará las tablas y cargará los datos históricos automáticamente.</p>
    </AuthShell>
  );
}
