import { redirect } from "next/navigation";
import { getKpiContext } from "@/lib/data";
import { latestReportedWeek } from "@/lib/views";
import { currentIsoWeek } from "@/lib/calendar";

export default async function ReunionIndex() {
  const ctx = await getKpiContext();
  const w = latestReportedWeek(ctx.rows) ?? currentIsoWeek();
  redirect(`/reunion/${w.year}/${w.week}`);
}
