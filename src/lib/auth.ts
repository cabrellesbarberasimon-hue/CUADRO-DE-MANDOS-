// Autenticación propia: email + contraseña (bcrypt) y sesión en cookie firmada (JWT HS256).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { q1 } from "@/lib/db/client";
import { signSession, verifySession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export type Role = "admin" | "direccion" | "editor" | "lector";

export const ROLES: { key: Role; label: string; description: string }[] = [
  { key: "admin", label: "Administrador", description: "Todo, incluida la gestión de usuarios y la configuración." },
  { key: "direccion", label: "Dirección", description: "Ve todo, comenta, crea y cierra acciones, dirige la reunión." },
  { key: "editor", label: "Editor", description: "Carga e importa datos, edita semanas, comenta y crea acciones." },
  { key: "lector", label: "Lector", description: "Solo lectura." },
];

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  area: string | null;
  active: boolean;
  notify: Record<string, boolean>;
  must_change_password: boolean;
};

export const can = {
  editData: (u: User) => u.role === "admin" || u.role === "editor",
  manageActions: (u: User) => u.role !== "lector",
  comment: (u: User) => u.role !== "lector",
  configure: (u: User) => u.role === "admin",
  manageUsers: (u: User) => u.role === "admin",
  runMeeting: (u: User) => u.role === "admin" || u.role === "direccion",
};

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: number) {
  const token = await signSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  const user = await q1<User>(
    `select id, name, email, role, area, active, notify, must_change_password from users where id = $1`,
    [userId],
  );
  return user && user.active ? user : null;
}

/** Exige sesión (y opcionalmente un permiso). Redirige a /login si no hay sesión. */
export async function requireUser(check?: (u: User) => boolean): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (check && !check(user)) redirect("/?error=permiso");
  return user;
}

export async function userCount(): Promise<number> {
  const r = await q1<{ n: number }>(`select count(*)::int as n from users`);
  return r?.n ?? 0;
}
