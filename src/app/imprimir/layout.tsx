import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { PrintButton } from "@/components/fullscreen-button";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8 print:p-0">
      <div className="mb-6 flex items-center justify-between border-b border-ink pb-3">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted">Cuadro de mandos semanal · generado {new Date().toLocaleDateString("es-ES")}</span>
          <PrintButton />
        </div>
      </div>
      {children}
    </div>
  );
}
