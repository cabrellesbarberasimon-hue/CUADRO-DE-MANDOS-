"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, LogOut, User as UserIcon, Sparkles } from "lucide-react";
import { Logo } from "./brand";
import { AREAS } from "@/config/areas";
import { logout } from "@/app/actions/auth";

type NavUser = { name: string; role: string; canConfigure: boolean; canEdit: boolean };

export function Header({ user }: { user: NavUser }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const item = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={clsx(
        "border-b-2 py-1 text-[13px] tracking-nav transition-colors",
        active(href) ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6">
        <Link href="/" className="shrink-0"><Logo /></Link>
        <nav className="flex flex-1 items-center gap-6 overflow-x-auto">
          {item("/", "Inicio")}
          <details className="group relative">
            <summary
              className={clsx(
                "flex cursor-pointer list-none items-center gap-1 border-b-2 py-1 text-[13px] tracking-nav",
                active("/area") ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              Áreas <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-9 z-40 w-56 rounded-md border border-line bg-white py-2 shadow-sm">
              {AREAS.map((a) => (
                <Link key={a.key} href={`/area/${a.key}`} className="block px-4 py-2 text-sm hover:bg-bone">
                  {a.label}
                </Link>
              ))}
            </div>
          </details>
          {item("/resumen", "Resumen")}
          {item("/datos", "Datos")}
          {item("/acciones", "Acciones")}
          {item("/reunion", "Reunión")}
          {user.canEdit && item("/importar", "Importar")}
          {user.canConfigure && item("/configuracion", "Configuración")}
          {user.canConfigure && item("/usuarios", "Usuarios")}
        </nav>
        <details className="relative shrink-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-ink px-4 py-1.5 text-sm">
            <UserIcon size={14} /> {user.name.split(" ")[0]}
          </summary>
          <div className="absolute right-0 top-11 z-40 w-56 rounded-md border border-line bg-white py-2 shadow-sm">
            <Link href="/perfil" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-bone"><UserIcon size={14} /> Mi perfil</Link>
            <Link href="/novedades" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-bone"><Sparkles size={14} /> Novedades</Link>
            <form action={logout}>
              <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-bone"><LogOut size={14} /> Cerrar sesión</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
