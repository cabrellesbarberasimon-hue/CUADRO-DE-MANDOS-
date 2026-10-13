import { NextResponse } from "next/server";
import { cronAuthorized, unauthorized } from "@/lib/cron";
import { sendActionReminders } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return unauthorized();
  return NextResponse.json(await sendActionReminders());
}
