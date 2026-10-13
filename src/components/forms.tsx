"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, Notice } from "./ui";
import type { FormState } from "@/app/actions/auth";

export function SubmitButton({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "outline" | "danger" | "pill"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

/** Formulario con estado (mensajes de error/ok) para server actions del tipo (state, formData) => state. */
export function StatefulForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <div className="mb-4"><Notice tone="bad">{state.error}</Notice></div>}
      {state?.ok && <div className="mb-4"><Notice tone="ok">{state.ok}</Notice></div>}
      {children}
    </form>
  );
}
