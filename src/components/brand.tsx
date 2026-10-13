export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-light tracking-tight text-2xl text-ink ${className}`} aria-label="Bocubi">
      Bocubi
    </span>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden w-1/2 lg:block"
        style={{ background: "linear-gradient(135deg, #3b2a1d 0%, #6b4a32 45%, #8e8c87 100%)" }}
      >
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-white">
          <p className="text-4xl font-light leading-tight">No vendemos muebles,<br />los fabricamos para ti</p>
          <p className="mt-4 max-w-md text-sm text-white/80">Cuadro de mandos semanal: del dato a la decisión.</p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Logo className="text-4xl" />
          <h1 className="mt-8 text-xl font-light tracking-wide">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
