// Firma y verificación del token de sesión. Sin dependencias de base de datos para poder usarse en el middleware.

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bocubi_session";
export const SESSION_DAYS = 14;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta configurar AUTH_SECRET");
    return new TextEncoder().encode("dev-secret-solo-para-desarrollo-local");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}
