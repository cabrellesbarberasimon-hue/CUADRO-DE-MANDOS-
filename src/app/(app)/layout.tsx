import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { can, requireUser } from "@/lib/auth";
import { missingDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (missingDatabase()) redirect("/sin-base-de-datos");
  const user = await requireUser();
  return (
    <>
      <Header user={{ name: user.name, role: user.role, canConfigure: can.configure(user), canEdit: can.editData(user) }} />
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-[1400px] px-6 pb-8 text-xs text-muted">Bocubi · Cuadro de mandos semanal · Dato → decisión</footer>
    </>
  );
}
