"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { q, q1 } from "@/lib/db/client";
import { checkPassword, createSession, destroySession, hashPassword, requireUser, userCount } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await q1<{ id: number; password_hash: string; active: boolean }>(
    `select id, password_hash, active from users where lower(email) = $1`,
    [email],
  );
  if (!user || !user.active || !(await checkPassword(password, user.password_hash))) {
    return { error: "Email o contraseña incorrectos." };
  }
  await q(`update users set last_login_at = now() where id = $1`, [user.id]);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const setupSchema = z.object({
  name: z.string().trim().min(2, "Indica tu nombre"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  code: z.string().optional(),
});

/** Crea el primer administrador. Solo funciona si no existe ningún usuario. */
export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  if ((await userCount()) > 0) return { error: "La app ya está configurada. Inicia sesión." };
  const parsed = setupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Si SETUP_CODE está configurado se exige; si no, el primero que entra crea el administrador
  // (la página se cierra en cuanto existe un usuario).
  const required = process.env.SETUP_CODE;
  if (required && parsed.data.code !== required) return { error: "Código de instalación incorrecto." };
  const hash = await hashPassword(parsed.data.password);
  const rows = await q<{ id: number }>(
    `insert into users (name, email, password_hash, role, notify) values ($1, $2, $3, 'admin', '{"weekly_summary":true,"red_kpi":true,"actions":true}'::jsonb) returning id`,
    [parsed.data.name, parsed.data.email, hash],
  );
  await createSession(rows[0].id);
  redirect("/");
}

const pwSchema = z
  .object({ current: z.string(), password: z.string().min(8, "Mínimo 8 caracteres"), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden" });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = pwSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = await q1<{ password_hash: string }>(`select password_hash from users where id = $1`, [user.id]);
  if (!row || !(await checkPassword(parsed.data.current, row.password_hash))) return { error: "La contraseña actual no es correcta." };
  await q(`update users set password_hash = $1, must_change_password = false where id = $2`, [await hashPassword(parsed.data.password), user.id]);
  return { ok: "Contraseña cambiada." };
}

export async function saveNotifications(form: FormData) {
  const user = await requireUser();
  const notify = {
    weekly_summary: form.get("weekly_summary") === "on",
    red_kpi: form.get("red_kpi") === "on",
    actions: form.get("actions") === "on",
    reminder: form.get("reminder") === "on",
  };
  await q(`update users set notify = $1::text::jsonb where id = $2`, [JSON.stringify(notify), user.id]);
  redirect("/perfil?ok=1");
}
