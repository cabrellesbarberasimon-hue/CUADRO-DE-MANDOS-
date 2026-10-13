import { NextResponse } from "next/server";

/** Las tareas programadas de Vercel envían "Authorization: Bearer <CRON_SECRET>". */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export const unauthorized = () => new NextResponse("No autorizado", { status: 401 });
