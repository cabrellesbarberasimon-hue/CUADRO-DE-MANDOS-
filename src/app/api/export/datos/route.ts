import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getKpiContext } from "@/lib/data";
import { exportWeeks } from "@/lib/export";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new NextResponse("No autorizado", { status: 401 });
  const year = Number(new URL(req.url).searchParams.get("y")) || new Date().getFullYear();
  const buf = await exportWeeks(await getKpiContext(), year);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bocubi_Datos_Semanales_${year}.xlsx"`,
    },
  });
}
