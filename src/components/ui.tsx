import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABEL, type Status } from "@/lib/kpis/engine";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Info, Moon } from "lucide-react";

type Variant = "primary" | "outline" | "ghost" | "pill" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black border border-ink",
  outline: "border border-ink text-ink hover:bg-ink hover:text-white bg-white",
  ghost: "text-ink hover:bg-bone border border-transparent",
  pill: "rounded-full bg-bone text-ink hover:bg-line border border-transparent",
  danger: "border border-bad text-bad hover:bg-bad hover:text-white bg-white",
};

const base =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(base, variant === "pill" ? "" : "rounded-md", variants[variant], className)} {...props} />;
}

export function LinkButton({ variant = "outline", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={clsx(base, variant === "pill" ? "" : "rounded-md", variants[variant], className)} {...props} />;
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={clsx("rounded-lg border border-line bg-white", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          {title && <h2 className="text-sm font-medium uppercase tracking-nav text-ink">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-light tracking-wide">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<Status, string> = {
  bien: "bg-ok-bg text-ok",
  alerta: "bg-warn-bg text-warn",
  mal: "bg-bad-bg text-bad",
  sin_dato: "bg-none-bg text-none",
  cerrada: "bg-none-bg text-none",
  info: "bg-bone text-muted",
};

const statusIcons: Record<Status, typeof CheckCircle2> = {
  bien: CheckCircle2,
  alerta: AlertTriangle,
  mal: XCircle,
  sin_dato: MinusCircle,
  cerrada: Moon,
  info: Info,
};

/** Semáforo: siempre icono + texto, nunca solo color. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const Icon = statusIcons[status];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[status], className)}>
      <Icon size={12} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "walnut" }) {
  const tones = {
    neutral: "bg-bone text-muted",
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-bad",
    walnut: "bg-[#f1e9e2] text-walnut",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "ok" | "info"; children: ReactNode }) {
  const tones = {
    warn: "border-warn/30 bg-warn-bg text-[#6e500f]",
    bad: "border-bad/30 bg-bad-bg text-[#7a2c1f]",
    ok: "border-ok/30 bg-ok-bg text-[#2a5a3d]",
    info: "border-line bg-bone text-ink",
  };
  return <div className={clsx("rounded-md border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
