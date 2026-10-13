"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "crypto";
import { q, q1 } from "@/lib/db/client";
import { can, hashPassword, requireUser, type Role } from "@/lib/auth";
import { setSetting, getSettings } from "@/lib/data";
import { KPI_BY_KEY } from "@/config/kpis";
import { AREAS } from "@/config/areas";
import { parseNumber } from "@/lib/format";
import { emailLayout, esc, sendEmail } from "@/lib/email";
import type { FormState } from "./auth";

const str = (form: FormData, k: string) => {
  const v = form.get(k);
  return v == null ? null : String(v).trim() || null;
};

// ───────────── Usuarios

const userSchema = z.object({
  name: z.string().trim().min(2, "Nombre obligatorio"),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  role: z.enum(["admin", "direccion", "editor", "lector"]),
  area: z.string().optional(),
  password: z.string().optional(),
  send_email: z.string().optional(),
});

const tempPassword = () => randomBytes(6).toString("base64url");

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  await requireUser(can.manageUsers);
  const parsed = userSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await q1(`select id from users where lower(email) = $1`, [d.email])) return { error: "Ya existe un usuario con ese email." };
  const password = d.password && d.password.length >= 8 ? d.password : tempPassword();
  await q(
    `insert into users (name, email, password_hash, role, area, must_change_password, notify)
     values ($1,$2,$3,$4,$5,true,'{"weekly_summary":true,"red_kpi":true,"actions":true,"reminder":true}'::jsonb)`,
    [d.name, d.email, await hashPassword(password), d.role, d.area || null],
  );
  let emailNote = "";
  if (d.send_email === "on") {
    const res = await sendEmail(
      [d.email],
      "Tu acceso al Cuadro de Mandos Bocubi",
      emailLayout(
        `Hola ${d.name}`,
        `<p style="font-size:14px">Te hemos dado acceso al cuadro de mandos semanal de Bocubi.</p>
         <p style="font-size:14px">Usuario: <b>${esc(d.email)}</b><br>Contraseña temporal: <b>${esc(password)}</b></p>
         <p style="font-size:13px;color:#6b6b6b">Cámbiala en "Mi perfil" al entrar.</p>`,
      ),
    );
    emailNote = res.sent ? " Se le ha enviado un email con el acceso." : ` (No se pudo enviar el email: ${res.error})`;
  }
  revalidatePath("/usuarios");
  return { ok: `Usuario creado. Contraseña temporal: ${password}${emailNote}` };
}

export async function updateUser(form: FormData) {
  const me = await requireUser(can.manageUsers);
  const id = Number(form.get("id"));
  const role = String(form.get("role")) as Role;
  const active = form.get("active") === "on";
  if (id === me.id && (role !== "admin" || !active)) return; // no te quites a ti mismo el acceso de admin
  await q(`update users set name = $2, role = $3, area = $4, active = $5 where id = $1`, [
    id, str(form, "name"), role, str(form, "area"), active,
  ]);
  revalidatePath("/usuarios");
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  await requireUser(can.manageUsers);
  const id = Number(form.get("id"));
  const password = tempPassword();
  await q(`update users set password_hash = $2, must_change_password = true where id = $1`, [id, await hashPassword(password)]);
  return { ok: `Nueva contraseña temporal: ${password}` };
}

// ───────────── Objetivos

export async function saveTarget(form: FormData) {
  await requireUser(can.configure);
  const kpi = String(form.get("kpi_key"));
  const def = KPI_BY_KEY[kpi];
  if (!def || def.fixedTarget) return;
  const scale = def.unit === "pct" ? 100 : 1;
  const rawValue = parseNumber(form.get("value"));
  const rawMax = parseNumber(form.get("value_max"));
  const year = form.get("year") ? Number(form.get("year")) : null;
  const month = form.get("month") ? Number(form.get("month")) : null;
  const week = form.get("week") ? Number(form.get("week")) : null;
  const scope = [kpi, year ?? 0, month ?? 0, week ?? 0];
  if (rawValue == null) {
    await q(`delete from targets where kpi_key = $1 and coalesce(year,0) = $2 and coalesce(month,0) = $3 and coalesce(week,0) = $4`, scope);
  } else {
    await q(`delete from targets where kpi_key = $1 and coalesce(year,0) = $2 and coalesce(month,0) = $3 and coalesce(week,0) = $4`, scope);
    await q(`insert into targets (kpi_key, year, month, week, value, value_max, note) values ($1,$2,$3,$4,$5,$6,$7)`, [
      kpi, year, month, week, rawValue / scale, rawMax == null ? null : rawMax / scale, str(form, "note"),
    ]);
  }
  revalidatePath("/", "layout");
}

export async function deleteTarget(form: FormData) {
  await requireUser(can.configure);
  await q(`delete from targets where id = $1`, [Number(form.get("id"))]);
  revalidatePath("/", "layout");
}

// ───────────── Configuración general

export async function saveGeneralSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireUser(can.configure);
  const capacity = parseNumber(form.get("capacity_eur"));
  const alertLow = parseNumber(form.get("alertLow"));
  const alertHigh = parseNumber(form.get("alertHigh"));
  if (!capacity || capacity <= 0) return { error: "La capacidad semanal debe ser mayor que 0." };
  if (!alertLow || !alertHigh || alertLow >= 100 || alertHigh <= 100) return { error: "Umbrales no válidos (p. ej. 85 y 120)." };
  await setSetting("capacity_eur", capacity);
  await setSetting("thresholds", { alertLow: alertLow / 100, alertHigh: alertHigh / 100 });
  const owners: Record<string, string> = {};
  for (const a of AREAS) owners[a.key] = str(form, `owner_${a.key}`) ?? a.defaultOwner;
  await setSetting("area_owners", owners);
  const recipients = String(form.get("alert_recipients") ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  await setSetting("alert_recipients", recipients);
  revalidatePath("/", "layout");
  return { ok: "Configuración guardada." };
}

export async function saveKpiThreshold(form: FormData) {
  await requireUser(can.configure);
  const kpi = String(form.get("kpi_key"));
  const settings = await getSettings();
  const map = { ...(settings.kpi_thresholds ?? {}) };
  const low = parseNumber(form.get("alertLow"));
  const high = parseNumber(form.get("alertHigh"));
  if (low == null && high == null) delete map[kpi];
  else map[kpi] = { alertLow: (low ?? 85) / 100, alertHigh: (high ?? 120) / 100 };
  await setSetting("kpi_thresholds", map);
  revalidatePath("/", "layout");
}

// ───────────── Comentarios de periodo (resumen mensual)

export async function savePeriodComment(form: FormData) {
  const user = await requireUser(can.runMeeting);
  await q(
    `insert into period_comments (year, kind, period, text, updated_by) values ($1,$2,$3,$4,$5)
     on conflict (year, kind, period) do update set text = excluded.text, updated_by = excluded.updated_by, updated_at = now()`,
    [Number(form.get("year")), String(form.get("kind")), String(form.get("period")), str(form, "text"), user.id],
  );
  revalidatePath("/resumen");
}
