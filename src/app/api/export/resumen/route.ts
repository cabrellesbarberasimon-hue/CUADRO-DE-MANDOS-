import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getKpiContext } from "@/lib/data";
import { exportSummary } from "@/lib/export";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new NextResponse("No autorizado", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const year = Number(sp.get("y")) || new Date().getFullYear();
  const kind = (["mes", "trimestre", "año"].includes(sp.get("p") ?? "") ? sp.get("p") : "mes") as "mes" | "trimestre" | "año";
  const buf = await exportSummary(await getKpiContext(), year, kind);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bocubi_Resumen_${kind}_${year}.xlsx"`,
    },
  });
}
