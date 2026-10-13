// Firma y verificación del token de sesión. Sin dependencias de base de datos para poder usarse en el middleware.

import { SignJWT, jwtVerify } from "jose";
import { databaseUrl } from "@/lib/env";

export const SESSION_COOKIE = "bocubi_session";
export const SESSION_DAYS = 14;

let cached: Uint8Array | null = null;

/**
 * Clave de firma: AUTH_SECRET si existe. Si no, se deriva (SHA-256) de la URL de la base de datos,
 * que también es secreta, para que la app funcione sin configurar nada más en Vercel.
 */
async function secret(): Promise<Uint8Array> {
  if (cached) return cached;
  const enc = new TextEncoder();
  const explicit = process.env.AUTH_SECRET;
  if (explicit) return (cached = enc.encode(explicit));
  const db = databaseUrl();
  if (db) {
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(`bocubi-session-v1|${db}`));
    return (cached = new Uint8Array(digest));
  }
  if (process.env.NODE_ENV === "production") throw new Error("Falta configurar AUTH_SECRET");
  return (cached = enc.encode("dev-secret-solo-para-desarrollo-local"));
}

export async function signSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await secret());
}

export async function verifySession(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, await secret());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}
